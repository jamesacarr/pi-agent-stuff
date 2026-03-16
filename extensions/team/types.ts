import type { spawn } from 'node:child_process';

import type { Message } from '@mariozechner/pi-ai';

import type { AgentConfig } from '../subagent/agents.ts';

export interface UsageStats {
  cacheRead: number;
  cacheWrite: number;
  contextTokens: number;
  cost: number;
  input: number;
  output: number;
  turns: number;
}

export interface TeamMember {
  agent: AgentConfig;
  name: string;
  /** Accumulated usage across all sends. */
  usage: UsageStats;
  /** Number of team_send calls completed. */
  sends: number;
  sessionFile: string;
  status: 'error' | 'idle' | 'running';
  /** Active child process — set while a send is in flight. */
  proc?: ReturnType<typeof spawn>;
}

export interface SendResult {
  elapsed: number;
  errorMessage?: string;
  exitCode: number;
  messages: Message[];
  model?: string;
  stderr: string;
  stopReason?: string;
  usage: UsageStats;
}

export interface TeamSendDetails {
  agentName: string;
  memberName: string;
  result: SendResult;
  totalUsage: UsageStats;
}

export type DisplayItem =
  | { text: string; type: 'text' }
  | { args: Record<string, unknown>; name: string; type: 'toolCall' };
