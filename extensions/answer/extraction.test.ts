import type { Api, Model } from '@mariozechner/pi-ai';
import type { SessionEntry } from '@mariozechner/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { ModelRegistry } from './extraction.ts';
import {
  extractTextFromContentParts,
  findLastAssistantText,
  parseExtractionResult,
  selectExtractionModel,
} from './extraction.ts';

// ── Helpers ───────────────────────────────────────────────────────────

const makeModel = (id: string): Model<Api> => ({ id }) as unknown as Model<Api>;

const makeRegistry = (
  available: Record<string, string | undefined>,
): ModelRegistry => ({
  find: (provider, modelId) => {
    const key = `${provider}/${modelId}`;
    return key in available ? makeModel(modelId) : undefined;
  },
  getApiKey: async model =>
    available[Object.keys(available).find(k => k.endsWith(model.id)) ?? ''],
});

const assistantEntry = (text: string, stopReason = 'stop'): SessionEntry =>
  ({
    id: crypto.randomUUID(),
    message: {
      api: 'messages',
      content: [{ text, type: 'text' }],
      model: 'test',
      provider: 'anthropic',
      role: 'assistant',
      stopReason,
      timestamp: Date.now(),
      usage: { inputTokens: 0, outputTokens: 0 },
    },
    parentId: undefined,
    timestamp: Date.now(),
    type: 'message',
  }) as unknown as SessionEntry;

const userEntry = (text: string): SessionEntry =>
  ({
    id: crypto.randomUUID(),
    message: {
      content: [{ text, type: 'text' }],
      role: 'user',
      timestamp: Date.now(),
    },
    parentId: undefined,
    timestamp: Date.now(),
    type: 'message',
  }) as unknown as SessionEntry;

const toolCallEntry = (): SessionEntry =>
  ({
    id: crypto.randomUUID(),
    parentId: undefined,
    thinkingLevel: 'none',
    timestamp: Date.now(),
    type: 'thinking_level_change',
  }) as unknown as SessionEntry;

// ── parseExtractionResult ─────────────────────────────────────────────

describe('parseExtractionResult', () => {
  it('parses valid JSON with questions', () => {
    const input = '{"questions": [{"question": "What colour?"}]}';
    const result = parseExtractionResult(input);
    expect(result).toEqual({ questions: [{ question: 'What colour?' }] });
  });

  it('parses JSON wrapped in a markdown code block', () => {
    const input =
      '```json\n{"questions": [{"question": "Which DB?", "context": "MySQL or Postgres"}]}\n```';
    const result = parseExtractionResult(input);
    expect(result).toEqual({
      questions: [{ context: 'MySQL or Postgres', question: 'Which DB?' }],
    });
  });

  it('parses a code block without the json language tag', () => {
    const input = '```\n{"questions": []}\n```';
    const result = parseExtractionResult(input);
    expect(result).toEqual({ questions: [] });
  });

  it('returns null for invalid JSON', () => {
    expect(parseExtractionResult('not json')).toBeNull();
  });

  it('returns null when questions field is missing', () => {
    expect(parseExtractionResult('{"answers": []}')).toBeNull();
  });

  it('returns null when questions is not an array', () => {
    expect(parseExtractionResult('{"questions": "none"}')).toBeNull();
  });
});

// ── extractTextFromContentParts ───────────────────────────────────────

describe('extractTextFromContentParts', () => {
  it('joins text parts with newlines', () => {
    const parts = [
      { text: 'Hello', type: 'text' },
      { text: 'World', type: 'text' },
    ];
    expect(extractTextFromContentParts(parts)).toBe('Hello\nWorld');
  });

  it('filters out non-text parts', () => {
    const parts = [
      { text: 'Keep', type: 'text' },
      { text: 'Discard', type: 'tool_use' },
      { type: 'image' },
    ];
    expect(extractTextFromContentParts(parts)).toBe('Keep');
  });

  it('returns empty string for no text parts', () => {
    expect(extractTextFromContentParts([{ type: 'image' }])).toBe('');
  });
});

// ── findLastAssistantText ─────────────────────────────────────────────

describe('findLastAssistantText', () => {
  it('returns text from the last assistant message', () => {
    const branch = [
      assistantEntry('First answer'),
      userEntry('Follow up'),
      assistantEntry('Second answer'),
    ];
    expect(findLastAssistantText(branch)).toEqual({ text: 'Second answer' });
  });

  it('skips non-message entries', () => {
    const branch = [assistantEntry('The answer'), toolCallEntry()];
    expect(findLastAssistantText(branch)).toEqual({ text: 'The answer' });
  });

  it('returns error when no assistant messages exist', () => {
    const branch = [userEntry('Hello')];
    expect(findLastAssistantText(branch)).toEqual({
      error: 'No assistant messages found',
    });
  });

  it('returns error for empty branch', () => {
    expect(findLastAssistantText([])).toEqual({
      error: 'No assistant messages found',
    });
  });

  it('returns error when last assistant message is incomplete', () => {
    const branch = [assistantEntry('Partial...', 'max_tokens')];
    const result = findLastAssistantText(branch);
    expect(result).toEqual({
      error: 'Last assistant message incomplete (max_tokens)',
    });
  });

  it('skips assistant messages with no text content', () => {
    const emptyAssistant = {
      id: crypto.randomUUID(),
      message: {
        api: 'messages',
        content: [{ type: 'tool_use' }],
        model: 'test',
        provider: 'anthropic',
        role: 'assistant',
        stopReason: 'stop',
        timestamp: Date.now(),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
      parentId: undefined,
      timestamp: Date.now(),
      type: 'message',
    } as unknown as SessionEntry;

    const branch = [assistantEntry('Has text'), emptyAssistant];
    expect(findLastAssistantText(branch)).toEqual({ text: 'Has text' });
  });
});

// ── selectExtractionModel ─────────────────────────────────────────────

describe('selectExtractionModel', () => {
  const currentModel = makeModel('current-model');

  it('prefers Codex mini when available with an API key', async () => {
    const registry = makeRegistry({
      'anthropic/claude-haiku-4-5': 'haiku-key',
      'openai-codex/gpt-5.1-codex-mini': 'codex-key',
    });
    const result = await selectExtractionModel(currentModel, registry);
    expect(result.id).toBe('gpt-5.1-codex-mini');
  });

  it('falls back to Haiku when Codex is unavailable', async () => {
    const registry = makeRegistry({
      'anthropic/claude-haiku-4-5': 'haiku-key',
    });
    const result = await selectExtractionModel(currentModel, registry);
    expect(result.id).toBe('claude-haiku-4-5');
  });

  it('falls back to Haiku when Codex has no API key', async () => {
    const registry = makeRegistry({
      'anthropic/claude-haiku-4-5': 'haiku-key',
      'openai-codex/gpt-5.1-codex-mini': undefined,
    });
    const result = await selectExtractionModel(currentModel, registry);
    expect(result.id).toBe('claude-haiku-4-5');
  });

  it('falls back to current model when no candidates are available', async () => {
    const registry = makeRegistry({});
    const result = await selectExtractionModel(currentModel, registry);
    expect(result.id).toBe('current-model');
  });

  it('falls back to current model when all candidates lack API keys', async () => {
    const registry = makeRegistry({
      'anthropic/claude-haiku-4-5': undefined,
      'openai-codex/gpt-5.1-codex-mini': undefined,
    });
    const result = await selectExtractionModel(currentModel, registry);
    expect(result.id).toBe('current-model');
  });
});
