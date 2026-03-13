import { describe, expect, test } from 'vitest';

import {
  addDaysLocal,
  countDaysInclusive,
  localMidnight,
  mondayIndex,
  parseSessionStartFromFilename,
  toLocalDayKey,
} from './date.ts';

describe('toLocalDayKey', () => {
  test('formats date as YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 5, 14, 30); // Jan 5, 2026
    expect(toLocalDayKey(date)).toBe('2026-01-05');
  });

  test('pads single-digit months and days', () => {
    const date = new Date(2025, 2, 9); // Mar 9
    expect(toLocalDayKey(date)).toBe('2025-03-09');
  });
});

describe('localMidnight', () => {
  test('strips time components', () => {
    const date = new Date(2026, 5, 15, 14, 30, 45, 123);
    const midnight = localMidnight(date);
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
    expect(midnight.getSeconds()).toBe(0);
    expect(midnight.getMilliseconds()).toBe(0);
    expect(midnight.getDate()).toBe(15);
  });
});

describe('addDaysLocal', () => {
  test('adds positive days', () => {
    const date = new Date(2026, 0, 1);
    const result = addDaysLocal(date, 5);
    expect(result.getDate()).toBe(6);
  });

  test('subtracts days with negative value', () => {
    const date = new Date(2026, 0, 10);
    const result = addDaysLocal(date, -3);
    expect(result.getDate()).toBe(7);
  });

  test('crosses month boundaries', () => {
    const date = new Date(2026, 0, 30);
    const result = addDaysLocal(date, 5);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });

  test('does not mutate original', () => {
    const date = new Date(2026, 0, 1);
    addDaysLocal(date, 5);
    expect(date.getDate()).toBe(1);
  });
});

describe('countDaysInclusive', () => {
  test('same day returns 1', () => {
    const date = new Date(2026, 0, 1);
    expect(countDaysInclusive(date, date)).toBe(1);
  });

  test('counts correctly across a week', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 7);
    expect(countDaysInclusive(start, end)).toBe(7);
  });

  test('returns 0 when start > end', () => {
    const start = new Date(2026, 0, 5);
    const end = new Date(2026, 0, 1);
    expect(countDaysInclusive(start, end)).toBe(0);
  });
});

describe('mondayIndex', () => {
  test('Monday returns 0', () => {
    // 2026-01-05 is a Monday
    expect(mondayIndex(new Date(2026, 0, 5))).toBe(0);
  });

  test('Sunday returns 6', () => {
    // 2026-01-04 is a Sunday
    expect(mondayIndex(new Date(2026, 0, 4))).toBe(6);
  });

  test('Wednesday returns 2', () => {
    // 2026-01-07 is a Wednesday
    expect(mondayIndex(new Date(2026, 0, 7))).toBe(2);
  });
});

describe('parseSessionStartFromFilename', () => {
  test('parses valid session filename', () => {
    const date = parseSessionStartFromFilename(
      '2026-02-02T21-52-28-774Z_abc123.jsonl',
    );
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe('2026-02-02T21:52:28.774Z');
  });

  test('returns null for invalid filename', () => {
    expect(parseSessionStartFromFilename('random.jsonl')).toBeNull();
  });

  test('returns null for partial match', () => {
    expect(parseSessionStartFromFilename('2026-02-02T21.jsonl')).toBeNull();
  });

  test('returns null for malformed date', () => {
    // Month 99 would produce NaN
    expect(
      parseSessionStartFromFilename('2026-99-99T21-52-28-774Z_abc.jsonl'),
    ).toBeNull();
  });
});
