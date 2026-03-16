import type { Message } from '@mariozechner/pi-ai';
import { describe, expect, it } from 'vitest';

import {
  formatTokens,
  formatToolCall,
  formatUsageStats,
  getDisplayItems,
  getFinalOutput,
  mapWithConcurrencyLimit,
} from './format.ts';

// ---------------------------------------------------------------------------
// Stub theme fg — returns `[color:text]` for assertion readability
// ---------------------------------------------------------------------------

type FgFn = Parameters<typeof formatToolCall>[2];
const fg: FgFn = (color, text) => `[${color}:${text}]`;

// ---------------------------------------------------------------------------
// formatTokens
// ---------------------------------------------------------------------------

describe('formatTokens', () => {
  const cases: [number, string][] = [
    [0, '0'],
    [999, '999'],
    [1000, '1.0k'],
    [1500, '1.5k'],
    [9999, '10.0k'],
    [10000, '10k'],
    [50000, '50k'],
    [999999, '1000k'],
    [1000000, '1.0M'],
    [1500000, '1.5M'],
  ];

  it.each(cases)('formats %d as "%s"', (input, expected) => {
    expect(formatTokens(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// formatUsageStats
// ---------------------------------------------------------------------------

describe('formatUsageStats', () => {
  it('returns empty string for zero usage', () => {
    expect(
      formatUsageStats({
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        input: 0,
        output: 0,
      }),
    ).toBe('');
  });

  it('formats all fields', () => {
    const result = formatUsageStats(
      {
        cacheRead: 5000,
        cacheWrite: 2000,
        contextTokens: 10000,
        cost: 0.0123,
        input: 1000,
        output: 500,
        turns: 3,
      },
      'claude-sonnet',
    );
    expect(result).toContain('3 turns');
    expect(result).toContain('↑1.0k');
    expect(result).toContain('↓500');
    expect(result).toContain('R5.0k');
    expect(result).toContain('W2.0k');
    expect(result).toContain('$0.0123');
    expect(result).toContain('ctx:10k');
    expect(result).toContain('claude-sonnet');
  });

  it('omits zero fields', () => {
    const result = formatUsageStats({
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      input: 100,
      output: 0,
      turns: 1,
    });
    expect(result).toBe('1 turn ↑100');
  });

  it('pluralises turns correctly', () => {
    expect(
      formatUsageStats({
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        input: 0,
        output: 0,
        turns: 1,
      }),
    ).toBe('1 turn');
    expect(
      formatUsageStats({
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        input: 0,
        output: 0,
        turns: 2,
      }),
    ).toBe('2 turns');
  });
});

// ---------------------------------------------------------------------------
// getFinalOutput
// ---------------------------------------------------------------------------

const assistantMsg = (text: string): Message =>
  ({
    content: [{ text, type: 'text' }],
    role: 'assistant',
    timestamp: Date.now(),
  }) as unknown as Message;

const userMsg = (text: string): Message =>
  ({
    content: [{ text, type: 'text' }],
    role: 'user',
    timestamp: Date.now(),
  }) as unknown as Message;

const toolResultMsg = (): Message =>
  ({
    content: [{ text: 'tool output', type: 'text' }],
    role: 'toolResult',
    timestamp: Date.now(),
  }) as unknown as Message;

describe('getFinalOutput', () => {
  it('returns empty string for no messages', () => {
    expect(getFinalOutput([])).toBe('');
  });

  it('returns empty string when no assistant messages', () => {
    expect(getFinalOutput([userMsg('hello')])).toBe('');
  });

  it('returns text from last assistant message', () => {
    const messages = [
      assistantMsg('first'),
      userMsg('follow up'),
      assistantMsg('second'),
    ];
    expect(getFinalOutput(messages)).toBe('second');
  });

  it('skips trailing non-assistant messages', () => {
    const messages = [
      assistantMsg('answer'),
      toolResultMsg(),
      userMsg('thanks'),
    ];
    expect(getFinalOutput(messages)).toBe('answer');
  });
});

// ---------------------------------------------------------------------------
// getDisplayItems
// ---------------------------------------------------------------------------

const assistantWithTools = (): Message =>
  ({
    content: [
      { text: 'thinking...', type: 'text' },
      {
        arguments: { command: 'ls -la' },
        id: '1',
        name: 'bash',
        type: 'toolCall',
      },
      { text: 'done', type: 'text' },
    ],
    role: 'assistant',
    timestamp: Date.now(),
  }) as unknown as Message;

describe('getDisplayItems', () => {
  it('returns empty array for no messages', () => {
    expect(getDisplayItems([])).toEqual([]);
  });

  it('ignores non-assistant messages', () => {
    expect(getDisplayItems([userMsg('hello'), toolResultMsg()])).toEqual([]);
  });

  it('extracts text and tool call items', () => {
    const items = getDisplayItems([assistantWithTools()]);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ text: 'thinking...', type: 'text' });
    expect(items[1]).toEqual({
      args: { command: 'ls -la' },
      name: 'bash',
      type: 'toolCall',
    });
    expect(items[2]).toEqual({ text: 'done', type: 'text' });
  });
});

// ---------------------------------------------------------------------------
// formatToolCall
// ---------------------------------------------------------------------------

describe('formatToolCall', () => {
  it('formats bash commands', () => {
    const result = formatToolCall('bash', { command: 'echo hello' }, fg);
    expect(result).toContain('[muted:$ ]');
    expect(result).toContain('[toolOutput:echo hello]');
  });

  it('truncates long bash commands', () => {
    const result = formatToolCall('bash', { command: 'a'.repeat(80) }, fg);
    expect(result).toContain('...');
  });

  it('formats read with path', () => {
    const result = formatToolCall('read', { path: 'src/index.ts' }, fg);
    expect(result).toContain('[muted:read ]');
    expect(result).toContain('[accent:src/index.ts]');
  });

  it('formats read with offset and limit', () => {
    const result = formatToolCall(
      'read',
      { limit: 20, offset: 10, path: 'file.ts' },
      fg,
    );
    expect(result).toContain('[warning::10-29]');
  });

  it('formats write with line count', () => {
    const result = formatToolCall(
      'write',
      { content: 'line1\nline2\nline3', path: 'out.ts' },
      fg,
    );
    expect(result).toContain('[muted:write ]');
    expect(result).toContain('[dim: (3 lines)]');
  });

  it('formats edit', () => {
    const result = formatToolCall('edit', { path: 'src/app.ts' }, fg);
    expect(result).toContain('[muted:edit ]');
    expect(result).toContain('[accent:src/app.ts]');
  });

  it('formats grep', () => {
    const result = formatToolCall(
      'grep',
      { path: 'src/', pattern: 'TODO' },
      fg,
    );
    expect(result).toContain('[accent:/TODO/]');
    expect(result).toContain('[dim: in src/]');
  });

  it('formats find', () => {
    const result = formatToolCall(
      'find',
      { path: 'src/', pattern: '*.ts' },
      fg,
    );
    expect(result).toContain('[accent:*.ts]');
  });

  it('formats ls', () => {
    const result = formatToolCall('ls', { path: 'src/' }, fg);
    expect(result).toContain('[muted:ls ]');
    expect(result).toContain('[accent:src/]');
  });

  it('formats unknown tools with JSON preview', () => {
    const result = formatToolCall('custom_tool', { key: 'value' }, fg);
    expect(result).toContain('[accent:custom_tool]');
    expect(result).toContain('key');
  });

  it('truncates long unknown tool args', () => {
    const result = formatToolCall('custom_tool', { data: 'x'.repeat(100) }, fg);
    expect(result).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// mapWithConcurrencyLimit
// ---------------------------------------------------------------------------

describe('mapWithConcurrencyLimit', () => {
  it('returns empty array for empty input', async () => {
    const result = await mapWithConcurrencyLimit([], 4, async x => x);
    expect(result).toEqual([]);
  });

  it('processes all items', async () => {
    const result = await mapWithConcurrencyLimit(
      [1, 2, 3],
      2,
      async x => x * 2,
    );
    expect(result).toEqual([2, 4, 6]);
  });

  it('preserves order regardless of completion time', async () => {
    const delays = [30, 10, 20];
    const result = await mapWithConcurrencyLimit(
      delays,
      3,
      async (delay, index) => {
        await new Promise(r => setTimeout(r, delay));
        return index;
      },
    );
    expect(result).toEqual([0, 1, 2]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrencyLimit([1, 2, 3, 4, 5], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 10));
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
