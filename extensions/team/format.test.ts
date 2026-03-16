import type { Message } from '@mariozechner/pi-ai';
import { describe, expect, it } from 'vitest';

import {
  addUsage,
  emptyUsage,
  formatTokens,
  formatToolCall,
  formatUsage,
  getDisplayItems,
  getFinalOutput,
} from './format.ts';
import type { UsageStats } from './types.ts';

// ---------------------------------------------------------------------------
// Stub theme fg — returns `[color:text]` for assertion readability
// ---------------------------------------------------------------------------

type FgFn = Parameters<typeof formatToolCall>[2];
const fg: FgFn = (color, text) => `[${color}:${text}]`;

// ---------------------------------------------------------------------------
// emptyUsage / addUsage
// ---------------------------------------------------------------------------

describe('emptyUsage', () => {
  it('returns zeroed stats', () => {
    const u = emptyUsage();
    expect(u).toEqual({
      cacheRead: 0,
      cacheWrite: 0,
      contextTokens: 0,
      cost: 0,
      input: 0,
      output: 0,
      turns: 0,
    });
  });
});

describe('addUsage', () => {
  it('sums all fields except contextTokens which takes max', () => {
    const a: UsageStats = {
      cacheRead: 10,
      cacheWrite: 20,
      contextTokens: 500,
      cost: 0.01,
      input: 100,
      output: 200,
      turns: 1,
    };
    const b: UsageStats = {
      cacheRead: 5,
      cacheWrite: 15,
      contextTokens: 800,
      cost: 0.02,
      input: 50,
      output: 100,
      turns: 2,
    };
    const result = addUsage(a, b);

    expect(result.input).toBe(150);
    expect(result.output).toBe(300);
    expect(result.cacheRead).toBe(15);
    expect(result.cacheWrite).toBe(35);
    expect(result.turns).toBe(3);
    expect(result.cost).toBeCloseTo(0.03);
    expect(result.contextTokens).toBe(800);
  });

  it('works with empty usage', () => {
    const a: UsageStats = {
      cacheRead: 10,
      cacheWrite: 20,
      contextTokens: 500,
      cost: 0.01,
      input: 100,
      output: 200,
      turns: 1,
    };
    const result = addUsage(a, emptyUsage());
    expect(result).toEqual(a);
  });
});

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
// formatUsage
// ---------------------------------------------------------------------------

describe('formatUsage', () => {
  it('returns empty string for empty usage', () => {
    expect(formatUsage(emptyUsage())).toBe('');
  });

  it('formats all fields', () => {
    const u: UsageStats = {
      cacheRead: 5000,
      cacheWrite: 2000,
      contextTokens: 10000,
      cost: 0.0123,
      input: 1000,
      output: 500,
      turns: 3,
    };
    const result = formatUsage(u, 'claude-sonnet');
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
    const u: UsageStats = {
      ...emptyUsage(),
      input: 100,
      turns: 1,
    };
    const result = formatUsage(u);
    expect(result).toBe('1 turn ↑100');
  });

  it('pluralises turns correctly', () => {
    expect(formatUsage({ ...emptyUsage(), turns: 1 })).toBe('1 turn');
    expect(formatUsage({ ...emptyUsage(), turns: 2 })).toBe('2 turns');
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

  it('extracts text and tool call items from assistant messages', () => {
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
    const longCmd = 'a'.repeat(80);
    const result = formatToolCall('bash', { command: longCmd }, fg);
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
