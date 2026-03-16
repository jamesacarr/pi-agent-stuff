import type { Message } from '@mariozechner/pi-ai';

import type { AgentScope } from './agents.ts';

export interface UsageStats {
  cacheRead: number;
  cacheWrite: number;
  contextTokens: number;
  cost: number;
  input: number;
  output: number;
  turns: number;
}

export interface SingleResult {
  agent: string;
  agentSource: 'project' | 'unknown' | 'user';
  errorMessage?: string;
  exitCode: number;
  messages: Message[];
  model?: string;
  stderr: string;
  step?: number;
  stopReason?: string;
  task: string;
  usage: UsageStats;
}

export interface SubagentDetails {
  agentScope: AgentScope;
  mode: 'chain' | 'parallel' | 'single';
  projectAgentsDir: string | null;
  results: SingleResult[];
}

export type DisplayItem =
  | { text: string; type: 'text' }
  | { args: Record<string, unknown>; name: string; type: 'toolCall' };
