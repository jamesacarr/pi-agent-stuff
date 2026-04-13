import * as os from 'node:os';

import type { Message } from '@mariozechner/pi-ai';
import type { ThemeColor } from '@mariozechner/pi-coding-agent';

import type { DisplayItem } from './types.ts';

// ---------------------------------------------------------------------------
// Token / usage formatting
// ---------------------------------------------------------------------------

export const formatTokens = (count: number): string => {
  if (count < 1000) {
    return count.toString();
  }
  if (count < 10000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  if (count < 1000000) {
    return `${Math.round(count / 1000)}k`;
  }
  return `${(count / 1000000).toFixed(1)}M`;
};

export const formatUsageStats = (
  usage: {
    cacheRead: number;
    cacheWrite: number;
    contextTokens?: number;
    cost: number;
    input: number;
    output: number;
    turns?: number;
  },
  model?: string,
): string => {
  const parts: string[] = [];
  if (usage.turns) {
    parts.push(`${usage.turns} turn${usage.turns > 1 ? 's' : ''}`);
  }
  if (usage.input) {
    parts.push(`↑${formatTokens(usage.input)}`);
  }
  if (usage.output) {
    parts.push(`↓${formatTokens(usage.output)}`);
  }
  if (usage.cacheRead) {
    parts.push(`R${formatTokens(usage.cacheRead)}`);
  }
  if (usage.cacheWrite) {
    parts.push(`W${formatTokens(usage.cacheWrite)}`);
  }
  if (usage.cost) {
    parts.push(`$${usage.cost.toFixed(4)}`);
  }
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) {
    parts.push(model);
  }
  return parts.join(' ');
};

// ---------------------------------------------------------------------------
// Message extraction
// ---------------------------------------------------------------------------

export const getFinalOutput = (messages: Message[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      for (const part of msg.content) {
        if (part.type === 'text') {
          return part.text;
        }
      }
    }
  }
  return '';
};

export const getDisplayItems = (messages: Message[]): DisplayItem[] => {
  const items: DisplayItem[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const part of msg.content) {
        if (part.type === 'text') {
          items.push({ text: part.text, type: 'text' });
        } else if (part.type === 'toolCall') {
          items.push({
            args: part.arguments as Record<string, unknown>,
            name: part.name,
            type: 'toolCall',
          });
        }
      }
    }
  }
  return items;
};

// ---------------------------------------------------------------------------
// Tool call formatting
// ---------------------------------------------------------------------------

const shortenPath = (p: string): string => {
  const home = os.homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
};

export const formatToolCall = (
  toolName: string,
  args: Record<string, unknown>,
  themeFg: (color: ThemeColor, text: string) => string,
): string => {
  switch (toolName) {
    case 'bash': {
      const command = (args.command as string) || '...';
      const preview =
        command.length > 60 ? `${command.slice(0, 60)}...` : command;
      return themeFg('muted', '$ ') + themeFg('toolOutput', preview);
    }
    case 'read': {
      const rawPath = (args.file_path || args.path || '...') as string;
      let text = themeFg('accent', shortenPath(rawPath));
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      if (offset !== undefined || limit !== undefined) {
        const startLine = offset ?? 1;
        const endLine = limit === undefined ? '' : startLine + limit - 1;
        text += themeFg(
          'warning',
          `:${startLine}${endLine ? `-${endLine}` : ''}`,
        );
      }
      return themeFg('muted', 'read ') + text;
    }
    case 'write': {
      const rawPath = (args.file_path || args.path || '...') as string;
      const content = (args.content || '') as string;
      const lines = content.split('\n').length;
      let text =
        themeFg('muted', 'write ') + themeFg('accent', shortenPath(rawPath));
      if (lines > 1) {
        text += themeFg('dim', ` (${lines} lines)`);
      }
      return text;
    }
    case 'edit': {
      const rawPath = (args.file_path || args.path || '...') as string;
      return (
        themeFg('muted', 'edit ') + themeFg('accent', shortenPath(rawPath))
      );
    }
    case 'ls': {
      const rawPath = (args.path || '.') as string;
      return themeFg('muted', 'ls ') + themeFg('accent', shortenPath(rawPath));
    }
    case 'find': {
      const pattern = (args.pattern || '*') as string;
      const rawPath = (args.path || '.') as string;
      return (
        themeFg('muted', 'find ') +
        themeFg('accent', pattern) +
        themeFg('dim', ` in ${shortenPath(rawPath)}`)
      );
    }
    case 'grep': {
      const pattern = (args.pattern || '') as string;
      const rawPath = (args.path || '.') as string;
      return (
        themeFg('muted', 'grep ') +
        themeFg('accent', `/${pattern}/`) +
        themeFg('dim', ` in ${shortenPath(rawPath)}`)
      );
    }
    default: {
      const argsStr = JSON.stringify(args);
      const preview =
        argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
      return themeFg('accent', toolName) + themeFg('dim', ` ${preview}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

export const mapWithConcurrencyLimit = async <TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> => {
  if (items.length === 0) {
    return [];
  }
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) {
        return;
      }
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
};
