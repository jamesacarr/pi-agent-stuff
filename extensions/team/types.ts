import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { AgentSession } from '@mariozechner/pi-coding-agent';

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

export interface ActivityItem {
  type:
    | 'tool_start'
    | 'tool_end'
    | 'text_delta'
    | 'agent_start'
    | 'agent_end'
    | 'error';
  timestamp: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  text?: string;
  /** Truncated tool output (from tool_execution_end result). */
  toolOutput?: string;
  isError?: boolean;
}

export interface AgentEndResult {
  messages: AgentMessage[];
  usage: UsageStats;
  elapsed: number;
  error?: string;
}

export interface TeamMember {
  agent: AgentConfig;
  name: string;
  /** Accumulated usage across all sends. */
  usage: UsageStats;
  /** Number of team_send calls completed. */
  sends: number;
  status: 'error' | 'idle' | 'running';
  /** In-process agent session for this member. */
  session?: AgentSession;
  /** Most recent activity (for collapsed widget view). */
  lastActivity?: ActivityItem;
  /** Recent activity items (for expanded widget view, capped at ~50). */
  activityLog: ActivityItem[];
  /** Result from last completed agent_end, consumed by sendMessage injection. */
  pendingResult?: AgentEndResult;
}

export interface TeamSendDetails {
  agentName: string;
  memberName: string;
}

export type DisplayItem =
  | { text: string; type: 'text' }
  | { args: Record<string, unknown>; name: string; type: 'toolCall' };
