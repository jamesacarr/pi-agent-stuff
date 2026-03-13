import { toLocalDayKey } from './date.ts';
import type { ParsedSession } from './types.ts';

/** Create a ParsedSession with sensible defaults, overridable per-field. */
export const makeSession = (
  date: Date,
  overrides: Partial<ParsedSession> = {},
): ParsedSession => ({
  costByModel: new Map(),
  dayKey: toLocalDayKey(date),
  filePath: '/test/session.jsonl',
  messages: 5,
  messagesByModel: new Map(),
  modelsUsed: new Set(),
  startedAt: date,
  tokens: 1000,
  tokensByModel: new Map(),
  totalCost: 0.05,
  ...overrides,
});
