import { describe, expect, test } from 'vitest';

import {
  extractCostTotal,
  extractMessageFields,
  extractTokensTotal,
  modelKeyFromParts,
} from './parse.ts';

describe('modelKeyFromParts', () => {
  test('combines provider and model', () => {
    expect(modelKeyFromParts('anthropic', 'claude-sonnet-4-20250514')).toBe(
      'anthropic/claude-sonnet-4-20250514',
    );
  });

  test('returns model when provider is empty', () => {
    expect(modelKeyFromParts('', 'gpt-4o')).toBe('gpt-4o');
  });

  test('returns provider when model is empty', () => {
    expect(modelKeyFromParts('openai', '')).toBe('openai');
  });

  test('returns null when both are empty', () => {
    expect(modelKeyFromParts('', '')).toBeNull();
  });

  test('returns null when both are undefined', () => {
    expect(modelKeyFromParts(undefined, undefined)).toBeNull();
  });

  test('handles non-string inputs', () => {
    expect(modelKeyFromParts(123, 456)).toBeNull();
  });

  test('trims whitespace', () => {
    expect(modelKeyFromParts(' anthropic ', ' claude ')).toBe(
      'anthropic/claude',
    );
  });
});

describe('extractMessageFields', () => {
  test('extracts top-level fields', () => {
    const obj = {
      model: 'gpt-4o',
      provider: 'openai',
      usage: { tokens: 100 },
    };
    const result = extractMessageFields(obj);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.usage).toEqual({ tokens: 100 });
  });

  test('falls back to nested message fields', () => {
    const obj = {
      message: {
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        usage: { total_tokens: 500 },
      },
    };
    const result = extractMessageFields(obj as Record<string, unknown>);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.usage).toEqual({ total_tokens: 500 });
  });

  test('top-level fields take precedence over nested', () => {
    const obj = {
      message: { model: 'old-model', provider: 'old-provider' },
      model: 'new-model',
      provider: 'new-provider',
    };
    const result = extractMessageFields(obj as Record<string, unknown>);
    expect(result.provider).toBe('new-provider');
    expect(result.model).toBe('new-model');
  });

  test('handles missing fields', () => {
    const result = extractMessageFields({});
    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.usage).toBeUndefined();
  });
});

describe('extractCostTotal', () => {
  test('returns direct numeric cost', () => {
    expect(extractCostTotal({ cost: 0.05 })).toBe(0.05);
  });

  test('returns nested cost.total', () => {
    expect(extractCostTotal({ cost: { total: 0.12 } })).toBe(0.12);
  });

  test('returns 0 for undefined', () => {
    expect(extractCostTotal(undefined)).toBe(0);
  });

  test('returns 0 for zero cost', () => {
    expect(extractCostTotal({ cost: 0 })).toBe(0);
  });

  test('returns 0 for missing cost key', () => {
    expect(extractCostTotal({ other: 'value' })).toBe(0);
  });

  test('handles string cost', () => {
    expect(extractCostTotal({ cost: '0.05' })).toBe(0.05);
  });
});

describe('extractTokensTotal', () => {
  test('reads totalTokens', () => {
    expect(extractTokensTotal({ totalTokens: 1000 })).toBe(1000);
  });

  test('reads total_tokens', () => {
    expect(extractTokensTotal({ total_tokens: 500 })).toBe(500);
  });

  test('reads tokens (number)', () => {
    expect(extractTokensTotal({ tokens: 200 })).toBe(200);
  });

  test('reads nested tokens.total', () => {
    expect(extractTokensTotal({ tokens: { total: 300 } })).toBe(300);
  });

  test('sums input + output tokens', () => {
    expect(
      extractTokensTotal({ completionTokens: 200, promptTokens: 100 }),
    ).toBe(300);
  });

  test('sums input_tokens + output_tokens', () => {
    expect(extractTokensTotal({ input_tokens: 150, output_tokens: 350 })).toBe(
      500,
    );
  });

  test('returns 0 for undefined', () => {
    expect(extractTokensTotal(undefined)).toBe(0);
  });

  test('returns 0 for empty object', () => {
    expect(extractTokensTotal({})).toBe(0);
  });

  test('prefers direct total over sum', () => {
    expect(
      extractTokensTotal({
        completionTokens: 200,
        promptTokens: 100,
        totalTokens: 999,
      }),
    ).toBe(999);
  });

  test('reads tokenCount', () => {
    expect(extractTokensTotal({ tokenCount: 42 })).toBe(42);
  });

  test('reads token_count', () => {
    expect(extractTokensTotal({ token_count: 77 })).toBe(77);
  });
});
