import * as os from 'node:os';

import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { Message } from '@mariozechner/pi-ai';
import type { ThemeColor } from '@mariozechner/pi-coding-agent';

import { emptyProcessUsage } from '../shared/pi-process.ts';
import type { DisplayItem, UsageStats } from './types.ts';

// ---------------------------------------------------------------------------
// Usage helpers
// ---------------------------------------------------------------------------

export const emptyUsage = emptyProcessUsage as () => UsageStats;

export const addUsage = (a: UsageStats, b: UsageStats): UsageStats => ({
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  contextTokens: Math.max(a.contextTokens, b.contextTokens),
  cost: a.cost + b.cost,
  input: a.input + b.input,
  output: a.output + b.output,
  turns: a.turns + b.turns,
});

// ---------------------------------------------------------------------------
// Token / usage formatting
// ---------------------------------------------------------------------------

export const formatTokens = (n: number): string => {
  if (n < 1000) {
    return n.toString();
  }
  if (n < 10000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  if (n < 1000000) {
    return `${Math.round(n / 1000)}k`;
  }
  return `${(n / 1000000).toFixed(1)}M`;
};

export const formatUsage = (u: UsageStats, model?: string): string => {
  const parts: string[] = [];
  if (u.turns) {
    parts.push(`${u.turns} turn${u.turns > 1 ? 's' : ''}`);
  }
  if (u.input) {
    parts.push(`↑${formatTokens(u.input)}`);
  }
  if (u.output) {
    parts.push(`↓${formatTokens(u.output)}`);
  }
  if (u.cacheRead) {
    parts.push(`R${formatTokens(u.cacheRead)}`);
  }
  if (u.cacheWrite) {
    parts.push(`W${formatTokens(u.cacheWrite)}`);
  }
  if (u.cost) {
    parts.push(`$${u.cost.toFixed(4)}`);
  }
  if (u.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(u.contextTokens)}`);
  }
  if (model) {
    parts.push(model);
  }
  return parts.join(' ');
};

// ---------------------------------------------------------------------------
// Message extraction
// ---------------------------------------------------------------------------

/** Extract final assistant text from AgentMessage[] (filters to Message first). */
export const getFinalAgentOutput = (messages: AgentMessage[]): string => {
  const msgs = messages.filter(
    (m): m is Message => 'role' in m && typeof m.role === 'string',
  );
  return getFinalOutput(msgs);
};

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
  fg: (color: ThemeColor, text: string) => string,
): string => {
  switch (toolName) {
    case 'bash': {
      const cmd = (args.command as string) || '...';
      const preview = cmd.length > 60 ? `${cmd.slice(0, 60)}...` : cmd;
      return `${fg('muted', '$ ')}${fg('toolOutput', preview)}`;
    }
    case 'read': {
      const raw = (args.file_path || args.path || '...') as string;
      let text = fg('accent', shortenPath(raw));
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 1;
        const end = limit === undefined ? '' : start + limit - 1;
        text += fg('warning', `:${start}${end ? `-${end}` : ''}`);
      }
      return `${fg('muted', 'read ')}${text}`;
    }
    case 'write': {
      const raw = (args.file_path || args.path || '...') as string;
      const content = (args.content || '') as string;
      const lines = content.split('\n').length;
      let text = `${fg('muted', 'write ')}${fg('accent', shortenPath(raw))}`;
      if (lines > 1) {
        text += fg('dim', ` (${lines} lines)`);
      }
      return text;
    }
    case 'edit': {
      const raw = (args.file_path || args.path || '...') as string;
      return `${fg('muted', 'edit ')}${fg('accent', shortenPath(raw))}`;
    }
    case 'grep': {
      const pattern = (args.pattern || '') as string;
      const raw = (args.path || '.') as string;
      return `${fg('muted', 'grep ')}${fg('accent', `/${pattern}/`)}${fg('dim', ` in ${shortenPath(raw)}`)}`;
    }
    case 'find': {
      const pattern = (args.pattern || '*') as string;
      const raw = (args.path || '.') as string;
      return `${fg('muted', 'find ')}${fg('accent', pattern)}${fg('dim', ` in ${shortenPath(raw)}`)}`;
    }
    case 'ls': {
      const raw = (args.path || '.') as string;
      return `${fg('muted', 'ls ')}${fg('accent', shortenPath(raw))}`;
    }
    default: {
      const s = JSON.stringify(args);
      const preview = s.length > 50 ? `${s.slice(0, 50)}...` : s;
      return `${fg('accent', toolName)}${fg('dim', ` ${preview}`)}`;
    }
  }
};
