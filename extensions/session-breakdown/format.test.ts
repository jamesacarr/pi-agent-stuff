import { describe, expect, test } from 'vitest';

import {
  ansiBg,
  ansiFg,
  bold,
  clamp01,
  dim,
  EMPTY_CELL,
  formatCount,
  formatUsd,
  lerp,
  mixRgb,
  padLeft,
  padRight,
  weightedMixRgb,
} from './format.ts';

describe('formatCount', () => {
  test('zero', () => expect(formatCount(0)).toBe('0'));
  test('small number', () => expect(formatCount(42)).toBe('42'));
  test('thousands', () => expect(formatCount(1_234)).toBe('1,234'));
  test('ten thousands uses K', () => expect(formatCount(12_345)).toBe('12.3K'));
  test('millions uses M', () => expect(formatCount(1_500_000)).toBe('1.5M'));
  test('billions uses B', () =>
    expect(formatCount(2_300_000_000)).toBe('2.3B'));
  test('NaN returns 0', () => expect(formatCount(Number.NaN)).toBe('0'));
  test('Infinity returns 0', () =>
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0'));
});

describe('formatUsd', () => {
  test('zero', () => expect(formatUsd(0)).toBe('$0.0000'));
  test('large cost', () => expect(formatUsd(12.5)).toBe('$12.50'));
  test('medium cost (0.1-1)', () => expect(formatUsd(0.456)).toBe('$0.456'));
  test('small cost (<0.1)', () => expect(formatUsd(0.0123)).toBe('$0.0123'));
  test('NaN returns $0.00', () => expect(formatUsd(Number.NaN)).toBe('$0.00'));
});

describe('padRight', () => {
  test('pads shorter string', () => expect(padRight('ab', 5)).toBe('ab   '));
  test('returns string when already at width', () =>
    expect(padRight('abcde', 5)).toBe('abcde'));
  test('returns string when longer than width', () =>
    expect(padRight('abcdef', 5)).toBe('abcdef'));
});

describe('padLeft', () => {
  test('pads shorter string', () => expect(padLeft('ab', 5)).toBe('   ab'));
  test('returns string when at width', () =>
    expect(padLeft('abcde', 5)).toBe('abcde'));
});

describe('clamp01', () => {
  test('clamps below 0', () => expect(clamp01(-0.5)).toBe(0));
  test('clamps above 1', () => expect(clamp01(1.5)).toBe(1));
  test('passes through mid value', () => expect(clamp01(0.5)).toBe(0.5));
});

describe('lerp', () => {
  test('t=0 returns a', () => expect(lerp(10, 20, 0)).toBe(10));
  test('t=1 returns b', () => expect(lerp(10, 20, 1)).toBe(20));
  test('t=0.5 returns midpoint', () => expect(lerp(10, 20, 0.5)).toBe(15));
});

describe('mixRgb', () => {
  test('t=0 returns first colour', () => {
    const a = { b: 0, g: 0, r: 0 };
    const b = { b: 255, g: 255, r: 255 };
    expect(mixRgb(a, b, 0)).toEqual(a);
  });

  test('t=1 returns second colour', () => {
    const a = { b: 0, g: 0, r: 0 };
    const b = { b: 255, g: 255, r: 255 };
    expect(mixRgb(a, b, 1)).toEqual(b);
  });

  test('t=0.5 returns midpoint', () => {
    const result = mixRgb({ b: 0, g: 0, r: 0 }, { b: 50, g: 200, r: 100 }, 0.5);
    expect(result).toEqual({ b: 25, g: 100, r: 50 });
  });
});

describe('weightedMixRgb', () => {
  test('single colour returns that colour', () => {
    const colour = { b: 50, g: 200, r: 100 };
    expect(weightedMixRgb([{ color: colour, weight: 1 }])).toEqual(colour);
  });

  test('equal weights returns average', () => {
    const result = weightedMixRgb([
      { color: { b: 0, g: 0, r: 0 }, weight: 1 },
      { color: { b: 100, g: 200, r: 100 }, weight: 1 },
    ]);
    expect(result).toEqual({ b: 50, g: 100, r: 50 });
  });

  test('empty input returns EMPTY_CELL', () => {
    expect(weightedMixRgb([])).toEqual(EMPTY_CELL);
  });

  test('zero weights returns EMPTY_CELL', () => {
    expect(
      weightedMixRgb([{ color: { b: 0, g: 0, r: 255 }, weight: 0 }]),
    ).toEqual(EMPTY_CELL);
  });

  test('ignores negative weights', () => {
    expect(
      weightedMixRgb([
        { color: { b: 100, g: 100, r: 100 }, weight: -1 },
        { color: { b: 200, g: 200, r: 200 }, weight: 2 },
      ]),
    ).toEqual({ b: 200, g: 200, r: 200 });
  });
});

describe('ANSI helpers', () => {
  test('ansiFg wraps with foreground code', () => {
    const result = ansiFg({ b: 0, g: 128, r: 255 }, 'X');
    expect(result).toBe('\x1b[38;2;255;128;0mX\x1b[0m');
  });

  test('ansiBg wraps with background code', () => {
    const result = ansiBg({ b: 30, g: 20, r: 10 }, 'Y');
    expect(result).toBe('\x1b[48;2;10;20;30mY\x1b[0m');
  });

  test('dim wraps with dim code', () => {
    expect(dim('text')).toBe('\x1b[2mtext\x1b[0m');
  });

  test('bold wraps with bold code', () => {
    expect(bold('text')).toBe('\x1b[1mtext\x1b[0m');
  });
});
