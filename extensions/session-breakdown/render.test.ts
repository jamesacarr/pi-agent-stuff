import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, test } from 'vitest';

import { addSessionToRange, buildRange, choosePalette } from './aggregate.ts';
import { ansiFg } from './format.ts';
import {
  fitRight,
  rangeSummary,
  renderGraph,
  renderLeftRight,
  renderLegendItems,
  renderModelTable,
} from './render.ts';
import { makeSession } from './test-helpers.ts';
import type { ModelPalette } from './types.ts';

const emptyPalette: ModelPalette = {
  modelColors: new Map(),
  orderedModels: [],
  otherColor: { b: 160, g: 160, r: 160 },
};

describe('renderGraph', () => {
  test('returns 7 rows (Mon-Sun)', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    const lines = renderGraph(range, emptyPalette, 'sessions');
    expect(lines).toHaveLength(7);
  });

  test('includes day labels Mon/Wed/Fri', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    const lines = renderGraph(range, emptyPalette, 'sessions');
    expect(lines[0]).toMatch(/^Mon/);
    expect(lines[2]).toMatch(/^Wed/);
    expect(lines[4]).toMatch(/^Fri/);
  });

  test('contains ANSI codes for active days', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(range, makeSession(new Date(2026, 0, 8)));
    const palette = choosePalette(range);

    const lines = renderGraph(range, palette, 'sessions');
    const combined = lines.join('\n');
    // Should contain ANSI escape codes
    expect(combined).toContain('\x1b[');
  });
});

describe('renderModelTable', () => {
  test('includes header and separator', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    const lines = renderModelTable(range, 'sessions');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toMatch(/model/);
    expect(lines[1]).toMatch(/^-+/);
  });

  test('shows no data message for empty range', () => {
    const range = buildRange(7, new Date(2026, 0, 10));
    const lines = renderModelTable(range, 'sessions');
    expect(lines.join('\n')).toContain('no model data');
  });

  test('shows model rows when data exists', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), {
        costByModel: new Map([['anthropic/claude', 0.1]]),
        messagesByModel: new Map([['anthropic/claude', 5]]),
        modelsUsed: new Set(['anthropic/claude']),
        tokensByModel: new Map([['anthropic/claude', 1000]]),
        totalCost: 0.1,
      }),
    );

    const lines = renderModelTable(range, 'sessions');
    const combined = lines.join('\n');
    expect(combined).toContain('anthropic/claude');
  });

  test('respects maxRows', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);

    // Add sessions with many models
    for (let i = 0; i < 10; i++) {
      addSessionToRange(
        range,
        makeSession(new Date(2026, 0, 8), {
          modelsUsed: new Set([`model-${i}`]),
          tokensByModel: new Map([[`model-${i}`, 100 * (i + 1)]]),
        }),
      );
    }

    // header + separator + maxRows
    const lines = renderModelTable(range, 'tokens', 3);
    expect(lines).toHaveLength(2 + 3); // header, separator, 3 rows
  });
});

describe('renderLegendItems', () => {
  test('includes model names and other', () => {
    const palette: ModelPalette = {
      modelColors: new Map([
        ['anthropic/claude', { b: 99, g: 196, r: 64 }],
        ['openai/gpt-4o', { b: 247, g: 129, r: 47 }],
      ]),
      orderedModels: ['anthropic/claude', 'openai/gpt-4o'],
      otherColor: { b: 160, g: 160, r: 160 },
    };

    const items = renderLegendItems(palette);
    expect(items).toHaveLength(3); // 2 models + other
    expect(items[0]).toContain('claude');
    expect(items[1]).toContain('gpt-4o');
    expect(items[2]).toContain('other');
  });

  test('strips provider prefix from display name', () => {
    const palette: ModelPalette = {
      modelColors: new Map([
        ['provider/model-name', { b: 100, g: 100, r: 100 }],
      ]),
      orderedModels: ['provider/model-name'],
      otherColor: { b: 160, g: 160, r: 160 },
    };

    const items = renderLegendItems(palette);
    expect(items[0]).toContain('model-name');
    expect(items[0]).not.toContain('provider/');
  });
});

describe('rangeSummary', () => {
  test('includes session count and cost', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(30, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 5), { totalCost: 1.5 }),
    );

    const summary = rangeSummary(range, 30, 'sessions');
    expect(summary).toContain('Last 30 days');
    expect(summary).toContain('1 sessions');
    expect(summary).toContain('$1.50');
  });

  test('shows tokens when mode is tokens', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), { tokens: 5000 }),
    );

    const summary = rangeSummary(range, 7, 'tokens');
    expect(summary).toContain('tokens');
  });

  test('shows messages when mode is messages', () => {
    const now = new Date(2026, 0, 10);
    const range = buildRange(7, now);
    addSessionToRange(
      range,
      makeSession(new Date(2026, 0, 8), { messages: 42 }),
    );

    const summary = rangeSummary(range, 7, 'messages');
    expect(summary).toContain('messages');
  });
});

describe('fitRight', () => {
  test('right-aligns short text', () => {
    const result = fitRight('hi', 10);
    expect(result).toMatch(/^\s+hi$/);
    expect(visibleWidth(result)).toBe(10);
  });

  test('returns empty for zero width', () => {
    expect(fitRight('hello', 0)).toBe('');
  });

  test('trims plain text longer than width', () => {
    const result = fitRight('abcdefghij', 5);
    expect(visibleWidth(result)).toBe(5);
  });

  test('trims ANSI text longer than width', () => {
    const coloured = ansiFg({ b: 0, g: 255, r: 0 }, 'abcdefghij');
    const result = fitRight(coloured, 5);
    expect(visibleWidth(result)).toBe(5);
  });

  test('preserves ANSI text that already fits', () => {
    const coloured = ansiFg({ b: 0, g: 255, r: 0 }, 'hi');
    const result = fitRight(coloured, 10);
    expect(visibleWidth(result)).toBe(10);
    expect(result).toContain('hi');
  });
});

describe('renderLeftRight', () => {
  test('places left and right text with gap', () => {
    const result = renderLeftRight('LEFT', 'RIGHT', 20);
    expect(result).toContain('LEFT');
    expect(result).toContain('RIGHT');
    expect(visibleWidth(result)).toBeLessThanOrEqual(20);
  });

  test('returns empty for zero width', () => {
    expect(renderLeftRight('a', 'b', 0)).toBe('');
  });

  test('truncates left when wider than available', () => {
    const result = renderLeftRight('very long left text', 'r', 5);
    expect(visibleWidth(result)).toBeLessThanOrEqual(5);
  });

  test('trims right text when left takes most of the width', () => {
    const result = renderLeftRight('AAAA', 'BBBBBBBBBB', 8);
    expect(result).toContain('AAAA');
    expect(visibleWidth(result)).toBeLessThanOrEqual(8);
  });

  test('handles ANSI right text', () => {
    const right = ansiFg({ b: 0, g: 255, r: 0 }, 'coloured');
    const result = renderLeftRight('L', right, 6);
    expect(visibleWidth(result)).toBeLessThanOrEqual(6);
  });
});
