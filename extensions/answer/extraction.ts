import type { Api, AssistantMessage, Model } from '@mariozechner/pi-ai';
import type { SessionEntry } from '@mariozechner/pi-coding-agent';

import type { ExtractionResult } from './types.ts';

const CODEX_MODEL_ID = 'gpt-5.1-codex-mini';
const HAIKU_MODEL_ID = 'claude-haiku-4-5';

export const EXTRACTION_SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return {"questions": []}

Example output:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;

export interface ModelRegistry {
  find: (provider: string, modelId: string) => Model<Api> | undefined;
  getApiKey: (model: Model<Api>) => Promise<string | undefined>;
}

/**
 * Select the cheapest capable model for question extraction.
 * Preference order: Codex mini → Haiku → current model.
 */
export const selectExtractionModel = async (
  currentModel: Model<Api>,
  registry: ModelRegistry,
): Promise<Model<Api>> => {
  const candidates = [
    { id: CODEX_MODEL_ID, provider: 'openai-codex' },
    { id: HAIKU_MODEL_ID, provider: 'anthropic' },
  ];

  for (const candidate of candidates) {
    const model = registry.find(candidate.provider, candidate.id);
    if (model) {
      const apiKey = await registry.getApiKey(model);
      if (apiKey) {
        return model;
      }
    }
  }

  return currentModel;
};

/**
 * Parse a JSON extraction result from LLM output.
 * Handles both raw JSON and JSON wrapped in markdown code blocks.
 */
export const parseExtractionResult = (
  text: string,
): ExtractionResult | null => {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text;

    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed as ExtractionResult;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Extract text content from an LLM response's content parts.
 */
export const extractTextFromContentParts = (
  parts: Array<{ type: string; text?: string }>,
): string =>
  parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map(part => part.text)
    .join('\n');

const isAssistantMessage = (
  message: SessionEntry & { type: 'message' },
): message is SessionEntry & { type: 'message'; message: AssistantMessage } =>
  message.message.role === 'assistant';

/**
 * Find the last complete assistant message text from a session branch.
 */
export const findLastAssistantText = (
  branch: SessionEntry[],
): { text: string } | { error: string } => {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== 'message') {
      continue;
    }
    if (!isAssistantMessage(entry)) {
      continue;
    }

    const message = entry.message;
    if (message.stopReason !== 'stop') {
      return {
        error: `Last assistant message incomplete (${message.stopReason})`,
      };
    }

    const text = extractTextFromContentParts(message.content);
    if (text.length > 0) {
      return { text };
    }
  }

  return { error: 'No assistant messages found' };
};
