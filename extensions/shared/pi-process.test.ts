import type { Message } from '@mariozechner/pi-ai';
import { describe, expect, it } from 'vitest';

import {
  accumulateUsage,
  emptyProcessUsage,
  processJsonLine,
} from './pi-process.ts';

// ---------------------------------------------------------------------------
// emptyProcessUsage
// ---------------------------------------------------------------------------

describe('emptyProcessUsage', () => {
  it('returns zeroed stats', () => {
    expect(emptyProcessUsage()).toEqual({
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

// ---------------------------------------------------------------------------
// accumulateUsage
// ---------------------------------------------------------------------------

describe('accumulateUsage', () => {
  it('increments turns and token counts from assistant message', () => {
    const usage = emptyProcessUsage();
    const msg = {
      content: [{ text: 'hello', type: 'text' }],
      role: 'assistant',
      usage: {
        cacheRead: 10,
        cacheWrite: 5,
        cost: { total: 0.01 },
        input: 100,
        output: 50,
        totalTokens: 200,
      },
    } as unknown as Message;

    accumulateUsage(usage, msg);

    expect(usage.turns).toBe(1);
    expect(usage.input).toBe(100);
    expect(usage.output).toBe(50);
    expect(usage.cacheRead).toBe(10);
    expect(usage.cacheWrite).toBe(5);
    expect(usage.cost).toBeCloseTo(0.01);
    expect(usage.contextTokens).toBe(200);
  });

  it('accumulates across multiple messages', () => {
    const usage = emptyProcessUsage();
    const msg = {
      content: [{ text: 'hello', type: 'text' }],
      role: 'assistant',
      usage: { input: 100, output: 50 },
    } as unknown as Message;

    accumulateUsage(usage, msg);
    accumulateUsage(usage, msg);

    expect(usage.turns).toBe(2);
    expect(usage.input).toBe(200);
    expect(usage.output).toBe(100);
  });

  it('ignores non-assistant messages', () => {
    const usage = emptyProcessUsage();
    const msg = {
      content: [{ text: 'hello', type: 'text' }],
      role: 'user',
      usage: { input: 100 },
    } as unknown as Message;

    accumulateUsage(usage, msg);

    expect(usage.turns).toBe(0);
    expect(usage.input).toBe(0);
  });

  it('handles missing usage field', () => {
    const usage = emptyProcessUsage();
    const msg = {
      content: [{ text: 'hello', type: 'text' }],
      role: 'assistant',
    } as unknown as Message;

    accumulateUsage(usage, msg);

    expect(usage.turns).toBe(1);
    expect(usage.input).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processJsonLine
// ---------------------------------------------------------------------------

describe('processJsonLine', () => {
  it('ignores empty lines', () => {
    const messages: Message[] = [];
    processJsonLine('', {
      onMessage: msg => messages.push(msg),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(0);
  });

  it('ignores whitespace-only lines', () => {
    const messages: Message[] = [];
    processJsonLine('   \t  ', {
      onMessage: msg => messages.push(msg),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(0);
  });

  it('ignores invalid JSON', () => {
    const messages: Message[] = [];
    processJsonLine('not json', {
      onMessage: msg => messages.push(msg),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(0);
  });

  it('ignores events without message_end or tool_result_end type', () => {
    const messages: Message[] = [];
    processJsonLine(JSON.stringify({ type: 'turn_start' }), {
      onMessage: msg => messages.push(msg),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(0);
  });

  it('calls onMessage for message_end events', () => {
    const messages: Message[] = [];
    const msg = { content: [], role: 'assistant', timestamp: 1 };
    processJsonLine(JSON.stringify({ message: msg, type: 'message_end' }), {
      onMessage: m => messages.push(m),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
  });

  it('calls onMessage for tool_result_end events', () => {
    const messages: Message[] = [];
    const msg = { content: [], role: 'toolResult', timestamp: 1 };
    processJsonLine(JSON.stringify({ message: msg, type: 'tool_result_end' }), {
      onMessage: m => messages.push(m),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(1);
  });

  it('ignores message_end without message field', () => {
    const messages: Message[] = [];
    processJsonLine(JSON.stringify({ type: 'message_end' }), {
      onMessage: m => messages.push(m),
      onStderr: () => {},
    });
    expect(messages).toHaveLength(0);
  });
});
