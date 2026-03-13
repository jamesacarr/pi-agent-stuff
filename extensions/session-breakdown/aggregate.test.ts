import { describe, expect, test } from 'vitest';

import {
  addSessionToRange,
  buildRange,
  choosePalette,
  resolveGraphMetric,
  sortMapDescending,
} from './aggregate.ts';
import { makeSession } from './test-helpers.ts';

describe('buildRange', () => {
  test('creates correct number of days', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    expect(range.days).toHaveLength(7);
  });

  test('starts from correct date', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    expect(range.days[0].dayKey).toBe('2026-01-04');
    expect(range.days[6].dayKey).toBe('2026-01-10');
  });

  test('initialises totals at zero', () => {
    const range = buildRange(30, new Date());
    expect(range.sessions).toBe(0);
    expect(range.totalMessages).toBe(0);
    expect(range.totalTokens).toBe(0);
    expect(range.totalCost).toBe(0);
  });

  test('dayByKey maps all days', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    expect(range.dayByKey.size).toBe(7);
    expect(range.dayByKey.has('2026-01-04')).toBe(true);
  });
});

describe('addSessionToRange', () => {
  test('increments range totals', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    const session = makeSession(new Date(2026, 0, 8), {
      messages: 10,
      tokens: 500,
      totalCost: 0.1,
    });
    addSessionToRange(range, session);

    expect(range.sessions).toBe(1);
    expect(range.totalMessages).toBe(10);
    expect(range.totalTokens).toBe(500);
    expect(range.totalCost).toBeCloseTo(0.1);
  });

  test('increments day aggregates', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    const session = makeSession(new Date(2026, 0, 8));
    addSessionToRange(range, session);

    const day = range.dayByKey.get('2026-01-08');
    expect(day?.sessions).toBe(1);
    expect(day?.messages).toBe(5);
    expect(day?.tokens).toBe(1000);
  });

  test('ignores sessions outside range', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    const session = makeSession(new Date(2025, 11, 1)); // way before
    addSessionToRange(range, session);

    expect(range.sessions).toBe(0);
  });

  test('tracks per-model breakdowns', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    const session = makeSession(new Date(2026, 0, 8), {
      costByModel: new Map([['anthropic/claude', 0.05]]),
      messagesByModel: new Map([['anthropic/claude', 3]]),
      modelsUsed: new Set(['anthropic/claude']),
      tokensByModel: new Map([['anthropic/claude', 200]]),
    });
    addSessionToRange(range, session);

    expect(range.modelSessions.get('anthropic/claude')).toBe(1);
    expect(range.modelMessages.get('anthropic/claude')).toBe(3);
    expect(range.modelTokens.get('anthropic/claude')).toBe(200);
    expect(range.modelCost.get('anthropic/claude')).toBeCloseTo(0.05);
  });

  test('accumulates across multiple sessions', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(range, makeSession(new Date(2026, 0, 8)));
    addSessionToRange(range, makeSession(new Date(2026, 0, 8)));
    addSessionToRange(range, makeSession(new Date(2026, 0, 9)));

    expect(range.sessions).toBe(3);
    const day8 = range.dayByKey.get('2026-01-08');
    expect(day8?.sessions).toBe(2);
  });
});

describe('sortMapDescending', () => {
  test('sorts by value descending', () => {
    const map = new Map<string, number>([
      ['a', 10],
      ['b', 30],
      ['c', 20],
    ]);
    const sorted = sortMapDescending(map);
    expect(sorted.map(x => x.key)).toEqual(['b', 'c', 'a']);
  });

  test('handles empty map', () => {
    expect(sortMapDescending(new Map())).toEqual([]);
  });
});

describe('choosePalette', () => {
  test('assigns colours to top models by cost', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(30, now);
    for (let i = 0; i < 5; i++) {
      addSessionToRange(
        range,
        makeSession(new Date(2026, 0, 5), {
          costByModel: new Map([
            ['anthropic/claude', 0.1],
            ['openai/gpt-4o', 0.2],
            ['google/gemini', 0.05],
          ]),
          modelsUsed: new Set([
            'anthropic/claude',
            'openai/gpt-4o',
            'google/gemini',
          ]),
          totalCost: 0.35,
        }),
      );
    }

    const palette = choosePalette(range, 2);
    expect(palette.orderedModels).toHaveLength(2);
    // Highest cost first
    expect(palette.orderedModels[0]).toBe('openai/gpt-4o');
    expect(palette.orderedModels[1]).toBe('anthropic/claude');
    expect(palette.modelColors.has('openai/gpt-4o')).toBe(true);
    expect(palette.otherColor).toBeDefined();
  });

  test('falls back to tokens when no cost', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(30, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 5), {
        modelsUsed: new Set(['a']),
        tokensByModel: new Map([['a', 1000]]),
        totalCost: 0,
      }),
    );

    const palette = choosePalette(range);
    expect(palette.orderedModels).toContain('a');
  });

  test('handles empty range', () => {
    const range = buildRange(30, new Date());
    const palette = choosePalette(range);
    expect(palette.orderedModels).toHaveLength(0);
    expect(palette.otherColor).toBeDefined();
  });
});

describe('resolveGraphMetric', () => {
  test('returns tokens metric when data exists', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), { tokens: 500 }),
    );

    const metric = resolveGraphMetric(range, 'tokens');
    expect(metric.kind).toBe('tokens');
    expect(metric.max).toBe(500);
  });

  test('falls back from tokens to messages', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), { messages: 10, tokens: 0 }),
    );

    const metric = resolveGraphMetric(range, 'tokens');
    expect(metric.kind).toBe('messages');
  });

  test('falls back from messages to sessions', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), { messages: 0, tokens: 0 }),
    );

    const metric = resolveGraphMetric(range, 'messages');
    expect(metric.kind).toBe('sessions');
    expect(metric.max).toBe(1);
  });

  test('sessions mode returns sessions directly', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(range, makeSession(new Date(2026, 0, 8)));
    addSessionToRange(range, makeSession(new Date(2026, 0, 8)));

    const metric = resolveGraphMetric(range, 'sessions');
    expect(metric.kind).toBe('sessions');
    expect(metric.max).toBe(2);
  });
});
