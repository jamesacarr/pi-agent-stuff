import type { Dirent } from 'node:fs';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
  localMidnight,
  parseSessionStartFromFilename,
  toLocalDayKey,
} from './date.ts';
import type { ModelKey, ParsedSession } from './types.ts';

// ---------------------------------------------------------------------------
// Model key extraction
// ---------------------------------------------------------------------------

export const modelKeyFromParts = (
  provider?: unknown,
  model?: unknown,
): ModelKey | null => {
  const providerName = typeof provider === 'string' ? provider.trim() : '';
  const modelName = typeof model === 'string' ? model.trim() : '';
  if (!providerName && !modelName) {
    return null;
  }
  if (!providerName) {
    return modelName;
  }
  if (!modelName) {
    return providerName;
  }
  return `${providerName}/${modelName}`;
};

// ---------------------------------------------------------------------------
// Usage extraction from varying session formats
// ---------------------------------------------------------------------------

const readNum = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

interface MessageFields {
  provider?: unknown;
  model?: unknown;
  modelId?: unknown;
  usage?: Record<string, unknown>;
}

/**
 * Extract provider, model, and usage from a session entry.
 * Handles both newer (top-level) and older (nested `.message`) formats.
 */
export const extractMessageFields = (
  obj: Record<string, unknown>,
): MessageFields => {
  const msg = obj?.message as Record<string, unknown> | undefined;
  return {
    model: obj?.model ?? msg?.model,
    modelId: obj?.modelId ?? msg?.modelId,
    provider: obj?.provider ?? msg?.provider,
    usage: (obj?.usage ?? msg?.usage) as Record<string, unknown> | undefined,
  };
};

export const extractCostTotal = (
  usage: Record<string, unknown> | undefined,
): number => {
  if (!usage) {
    return 0;
  }
  const cost = usage.cost;
  const direct = readNum(cost);
  if (direct > 0) {
    return direct;
  }
  if (cost && typeof cost === 'object') {
    return readNum((cost as Record<string, unknown>).total);
  }
  return 0;
};

export const extractTokensTotal = (
  usage: Record<string, unknown> | undefined,
): number => {
  if (!usage) {
    return 0;
  }

  // Direct total fields — uses || (not ??) because readNum returns 0 for
  // missing/invalid values, and we want to skip zeros to try the next field.
  const directTotal =
    readNum(usage.totalTokens) ||
    readNum(usage.total_tokens) ||
    readNum(usage.tokens) ||
    readNum(usage.tokenCount) ||
    readNum(usage.token_count);
  if (directTotal > 0) {
    return directTotal;
  }

  // Nested tokens object
  if (usage.tokens && typeof usage.tokens === 'object') {
    const tokensObj = usage.tokens as Record<string, unknown>;
    const nested =
      readNum(tokensObj.total) ||
      readNum(tokensObj.totalTokens) ||
      readNum(tokensObj.total_tokens);
    if (nested > 0) {
      return nested;
    }
  }

  // Sum of input + output parts
  const input =
    readNum(usage.promptTokens) ||
    readNum(usage.prompt_tokens) ||
    readNum(usage.inputTokens) ||
    readNum(usage.input_tokens);
  const output =
    readNum(usage.completionTokens) ||
    readNum(usage.completion_tokens) ||
    readNum(usage.outputTokens) ||
    readNum(usage.output_tokens);
  const sum = input + output;
  return sum > 0 ? sum : 0;
};

// ---------------------------------------------------------------------------
// Session file walking
// ---------------------------------------------------------------------------

export const walkSessionFiles = async (
  root: string,
  startCutoff: Date,
  signal?: AbortSignal,
  onFound?: (count: number) => void,
): Promise<string[]> => {
  const results: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    if (signal?.aborted) {
      break;
    }

    const dir = stack.pop();
    if (!dir) {
      break;
    }
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (signal?.aborted) {
        break;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }

      const startedAt = parseSessionStartFromFilename(entry.name);
      if (startedAt) {
        if (localMidnight(startedAt) >= startCutoff) {
          results.push(fullPath);
          if (onFound && results.length % 10 === 0) {
            onFound(results.length);
          }
        }
        continue;
      }

      // Fall back to mtime for files without timestamp in the filename
      try {
        const stat = await fs.stat(fullPath);
        if (localMidnight(new Date(stat.mtimeMs)) >= startCutoff) {
          results.push(fullPath);
          if (onFound && results.length % 10 === 0) {
            onFound(results.length);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  onFound?.(results.length);
  return results;
};

// ---------------------------------------------------------------------------
// Session file parsing
// ---------------------------------------------------------------------------

export const parseSessionFile = async (
  filePath: string,
  signal?: AbortSignal,
): Promise<ParsedSession | null> => {
  const fileName = path.basename(filePath);
  let startedAt = parseSessionStartFromFilename(fileName);
  let currentModel: ModelKey | null = null;

  const modelsUsed = new Set<ModelKey>();
  let messages = 0;
  let tokens = 0;
  let totalCost = 0;
  const costByModel = new Map<ModelKey, number>();
  const messagesByModel = new Map<ModelKey, number>();
  const tokensByModel = new Map<ModelKey, number>();

  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const reader = readline.createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input: stream,
  });

  try {
    for await (const line of reader) {
      if (signal?.aborted) {
        reader.close();
        stream.destroy();
        return null;
      }

      if (!line) {
        continue;
      }

      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      // Session header — extract start time if not from filename
      if (
        !startedAt &&
        obj.type === 'session' &&
        typeof obj.timestamp === 'string'
      ) {
        const date = new Date(obj.timestamp);
        if (Number.isFinite(date.getTime())) {
          startedAt = date;
        }
        continue;
      }

      // Model change entry
      if (obj.type === 'model_change') {
        const key = modelKeyFromParts(obj.provider, obj.modelId);
        if (key) {
          currentModel = key;
          modelsUsed.add(key);
        }
        continue;
      }

      if (obj.type !== 'message') {
        continue;
      }

      const { provider, model, modelId, usage } = extractMessageFields(obj);
      const modelKey =
        modelKeyFromParts(provider, model) ??
        modelKeyFromParts(provider, modelId) ??
        currentModel ??
        'unknown';
      modelsUsed.add(modelKey);

      messages += 1;
      messagesByModel.set(modelKey, (messagesByModel.get(modelKey) ?? 0) + 1);

      const tokenCount = extractTokensTotal(usage);
      if (tokenCount > 0) {
        tokens += tokenCount;
        tokensByModel.set(
          modelKey,
          (tokensByModel.get(modelKey) ?? 0) + tokenCount,
        );
      }

      const cost = extractCostTotal(usage);
      if (cost > 0) {
        totalCost += cost;
        costByModel.set(modelKey, (costByModel.get(modelKey) ?? 0) + cost);
      }
    }
  } finally {
    reader.close();
    stream.destroy();
  }

  if (!startedAt) {
    return null;
  }

  return {
    costByModel,
    dayKey: toLocalDayKey(startedAt),
    filePath,
    messages,
    messagesByModel,
    modelsUsed,
    startedAt,
    tokens,
    tokensByModel,
    totalCost,
  };
};
