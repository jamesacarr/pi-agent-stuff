import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { sumSessionUsage } from './session.ts';

// Helpers ----------------------------------------------------------------

const assistantEntry = (usage: {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: { total: number };
}) => ({
  message: {
    role: 'assistant' as const,
    usage: {
      cacheRead: usage.cacheRead ?? 0,
      cacheWrite: usage.cacheWrite ?? 0,
      cost: { total: usage.cost?.total ?? 0 },
      input: usage.input,
      output: usage.output,
    },
  },
  type: 'message' as const,
});

const stubCtx = (
  entries: Array<{ type: string; message?: unknown }>,
): ExtensionCommandContext =>
  ({
    sessionManager: { getEntries: () => entries },
  }) as unknown as ExtensionCommandContext;

// Tests ------------------------------------------------------------------

describe('sumSessionUsage', () => {
  it('sums usage across multiple assistant messages', () => {
    const ctx = stubCtx([
      assistantEntry({ cost: { total: 0.01 }, input: 100, output: 50 }),
      assistantEntry({
        cacheRead: 10,
        cacheWrite: 20,
        cost: { total: 0.02 },
        input: 200,
        output: 100,
      }),
    ]);

    const usage = sumSessionUsage(ctx);
    expect(usage.input).toBe(300);
    expect(usage.output).toBe(150);
    expect(usage.cacheRead).toBe(10);
    expect(usage.cacheWrite).toBe(20);
    expect(usage.totalTokens).toBe(480);
    expect(usage.totalCost).toBeCloseTo(0.03);
  });

  it('ignores non-message entries', () => {
    const ctx = stubCtx([
      { type: 'compaction' },
      assistantEntry({ input: 100, output: 50 }),
      { type: 'model_change' },
    ]);

    const usage = sumSessionUsage(ctx);
    expect(usage.input).toBe(100);
    expect(usage.output).toBe(50);
  });

  it('ignores non-assistant messages', () => {
    const ctx = stubCtx([
      { message: { role: 'user' }, type: 'message' },
      { message: { role: 'toolResult' }, type: 'message' },
      assistantEntry({ input: 50, output: 25 }),
    ]);

    const usage = sumSessionUsage(ctx);
    expect(usage.input).toBe(50);
    expect(usage.output).toBe(25);
  });

  it('returns zeros for empty session', () => {
    const ctx = stubCtx([]);
    const usage = sumSessionUsage(ctx);
    expect(usage.input).toBe(0);
    expect(usage.output).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.totalCost).toBe(0);
  });
});
