/**
 * Shared utilities for spawning pi subprocesses and parsing their JSON output.
 * Used by both the subagent and team extensions.
 */

import type { ChildProcess } from 'node:child_process';

import type { Message } from '@mariozechner/pi-ai';

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

export interface ProcessUsage {
  cacheRead: number;
  cacheWrite: number;
  contextTokens: number;
  cost: number;
  input: number;
  output: number;
  turns: number;
}

export const emptyProcessUsage = (): ProcessUsage => ({
  cacheRead: 0,
  cacheWrite: 0,
  contextTokens: 0,
  cost: 0,
  input: 0,
  output: 0,
  turns: 0,
});

// ---------------------------------------------------------------------------
// JSON line parsing
// ---------------------------------------------------------------------------

export interface LineProcessorCallbacks {
  onMessage: (msg: Message) => void;
  onStderr: (chunk: string) => void;
}

/**
 * Accumulates usage stats from an assistant message.
 */
export const accumulateUsage = (usage: ProcessUsage, msg: Message): void => {
  if (msg.role !== 'assistant') {
    return;
  }
  usage.turns++;
  const u = msg.usage;
  if (u) {
    usage.input += u.input || 0;
    usage.output += u.output || 0;
    usage.cacheRead += u.cacheRead || 0;
    usage.cacheWrite += u.cacheWrite || 0;
    usage.cost += u.cost?.total || 0;
    usage.contextTokens = u.totalTokens || 0;
  }
};

/**
 * Parses a single JSON line from pi's `--mode json` output.
 * Calls `onMessage` for `message_end` and `tool_result_end` events.
 */
export const processJsonLine = (
  line: string,
  callbacks: LineProcessorCallbacks,
): void => {
  if (!line.trim()) {
    return;
  }
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return;
  }

  if (event.type === 'message_end' && event.message) {
    callbacks.onMessage(event.message as Message);
  }

  if (event.type === 'tool_result_end' && event.message) {
    callbacks.onMessage(event.message as Message);
  }
};

/**
 * Attaches a buffered JSON line reader to a child process's stdout.
 * Handles line splitting across chunk boundaries.
 */
export const attachLineReader = (
  proc: ChildProcess,
  onLine: (line: string) => void,
  onStderr: (chunk: string) => void,
): { flush: () => void } => {
  let buffer = '';

  proc.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      onLine(line);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    onStderr(data.toString());
  });

  return {
    flush: () => {
      if (buffer.trim()) {
        onLine(buffer);
        buffer = '';
      }
    },
  };
};

// ---------------------------------------------------------------------------
// Abort signal wiring
// ---------------------------------------------------------------------------

/**
 * Wires an AbortSignal to kill a child process (SIGTERM then SIGKILL fallback).
 * Returns whether the process was aborted.
 */
export const wireAbortSignal = (
  proc: ChildProcess,
  signal: AbortSignal | undefined,
): { wasAborted: () => boolean } => {
  let aborted = false;

  if (!signal) {
    return { wasAborted: () => false };
  }

  const kill = () => {
    aborted = true;
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 5000);
  };

  if (signal.aborted) {
    kill();
  } else {
    signal.addEventListener('abort', kill, { once: true });
  }

  return { wasAborted: () => aborted };
};
