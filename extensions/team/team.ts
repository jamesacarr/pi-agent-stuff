/**
 * Team Extension — persistent async subagent orchestration via SDK sessions
 *
 * Spawns named agents as persistent AgentSession instances with two-way communication.
 * Results are pushed into the main conversation via pi.sendMessage().
 * A live widget shows team member activity (ctrl+shift+t to expand/collapse).
 *
 * Tools:
 *   team_spawn     — create a named agent with a persistent session
 *   team_send      — send a message to a team member (response arrives separately)
 *   team_steer     — interrupt a running member with new directions
 *   team_follow_up — queue a message for after the member finishes
 *   team_list      — list all team members and their status
 *   team_dismiss   — remove a team member (aborts if running, disposes session)
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StringEnum } from '@mariozechner/pi-ai';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Text, truncateToWidth, visibleWidth } from '@mariozechner/pi-tui';
import { Type } from '@sinclair/typebox';

import type { AgentScope } from '../subagent/agents.ts';
import { discoverAgents } from '../subagent/agents.ts';
import {
  addUsage,
  emptyUsage,
  formatUsage,
  getFinalAgentOutput,
} from './format.ts';
import {
  createMemberSession,
  destroyMemberSession,
  pushActivity,
} from './session.ts';
import type { TeamMember, UsageStats } from './types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACKAGE_AGENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../agents',
);

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default (pi: ExtensionAPI) => {
  // -- Team orchestration ---------------------------------------------------

  const members = new Map<string, TeamMember>();

  // Saved ctx reference for widget updates from any context
  let widgetCtx:
    | { ui: { setWidget: (key: string, ...args: unknown[]) => void } }
    | undefined;

  // Per-member expansion state
  const expandedMembers = new Set<string>();

  // Max visible lines in expanded view (auto-scrolls to latest)
  const EXPANDED_MAX_LINES = 20;
  // Max columns for compact grid
  const MAX_COLUMNS = 4;
  // Min column width before reducing column count
  const MIN_COLUMN_WIDTH = 25;

  // ---------------------------------------------------------------------------
  // Widget rendering
  // ---------------------------------------------------------------------------

  const statusIcon = (m: TeamMember): string =>
    m.status === 'running' ? '⏳' : m.status === 'error' ? '✗' : '✓';

  const summariseArgs = (args?: Record<string, unknown>): string => {
    if (!args) {
      return '';
    }
    const val = args.command ?? args.path ?? args.file_path ?? args.pattern;
    if (typeof val === 'string') {
      return val.length > 40 ? `${val.slice(0, 40)}…` : val;
    }
    return '';
  };

  /** Build compact one-liner text (used inside the box). */
  const buildCompactBody = (m: TeamMember): string => {
    if (!m.lastActivity) {
      return '(no activity yet)';
    }

    let text = `${statusIcon(m)}`;

    if (m.lastActivity.type === 'tool_start' && m.lastActivity.toolName) {
      const args = summariseArgs(m.lastActivity.toolArgs);
      text += ` → ${m.lastActivity.toolName}${args ? `: ${args}` : ''}`;
    } else if (m.lastActivity.type === 'text_delta' && m.lastActivity.text) {
      text += ` ${m.lastActivity.text.split('\n')[0]}`;
    } else if (m.lastActivity.type === 'agent_end') {
      text += ' done';
    } else if (m.lastActivity.type === 'error' && m.lastActivity.text) {
      text += ` ✗ ${m.lastActivity.text}`;
    }

    return text;
  };

  /**
   * Wrap content lines in a box with the member name in the top border.
   *
   *   ┌─ name ─────────┐
   *   │ content line 1  │
   *   │ content line 2  │
   *   └─────────────────┘
   */
  const wrapInBox = (
    name: string,
    contentLines: string[],
    colWidth: number,
    fg: (color: string, text: string) => string,
  ): string[] => {
    // Inner width = colWidth minus the 2 border chars and 2 padding spaces
    const innerWidth = Math.max(1, colWidth - 4);
    const lines: string[] = [];

    // Top border: ┌─ name ───┐
    const nameText = ` ${name} `;
    const nameLen = visibleWidth(nameText);
    const dashesAfter = Math.max(0, colWidth - 2 - nameLen);
    lines.push(
      fg('dim', '┌─') +
        fg('accent', name) +
        fg('dim', ` ${'─'.repeat(dashesAfter)}┐`),
    );

    // Content lines: │ content │
    for (const cl of contentLines) {
      const truncated = truncateToWidth(cl, innerWidth);
      const vw = visibleWidth(truncated);
      const pad = Math.max(0, innerWidth - vw);
      lines.push(
        fg('dim', '│ ') + truncated + ' '.repeat(pad) + fg('dim', ' │'),
      );
    }

    // Bottom border: └───────┘
    lines.push(fg('dim', `└${'─'.repeat(Math.max(0, colWidth - 2))}┘`));

    return lines;
  };

  /** Build expanded activity lines for a member. */
  /** Build expanded activity lines. No truncation — wrapInBox handles that. */
  const buildExpandedLines = (
    m: TeamMember,
    fg: (color: string, text: string) => string,
  ): string[] => {
    const lines: string[] = [];

    for (const item of m.activityLog) {
      if (item.type === 'tool_start' && item.toolName) {
        const args = summariseArgs(item.toolArgs);
        lines.push(fg('muted', `→ ${item.toolName}${args ? `: ${args}` : ''}`));
      } else if (item.type === 'tool_end' && item.toolOutput) {
        const outputLines = item.toolOutput.split('\n');
        const maxOutputLines = 8;
        const shown = outputLines.slice(0, maxOutputLines);
        for (const ol of shown) {
          lines.push(fg('dim', `  ${ol}`));
        }
        if (outputLines.length > maxOutputLines) {
          lines.push(
            fg(
              'dim',
              `  ... ${outputLines.length - maxOutputLines} more lines`,
            ),
          );
        }
      } else if (item.type === 'text_delta' && item.text) {
        const textLines = item.text.split('\n').slice(0, 4);
        for (const tl of textLines) {
          lines.push(tl);
        }
        const totalLines = item.text.split('\n').length;
        if (totalLines > 4) {
          lines.push(fg('dim', `... ${totalLines - 4} more lines`));
        }
      } else if (item.type === 'error' && item.text) {
        lines.push(fg('error', `✗ ${item.text}`));
      } else if (item.type === 'agent_end') {
        const usageStr = formatUsage(m.usage, m.agent.model);
        lines.push(
          fg('success', `✓ completed${usageStr ? `  ${usageStr}` : ''}`),
        );
      }
    }

    // Auto-scroll: show last EXPANDED_MAX_LINES
    if (lines.length > EXPANDED_MAX_LINES) {
      const visible = lines.slice(-EXPANDED_MAX_LINES);
      return [
        fg('dim', `... ${lines.length - EXPANDED_MAX_LINES} earlier items`),
        ...visible,
      ];
    }

    return lines;
  };

  /** Build expanded lines for a member constrained to a column width. */
  const buildExpandedColumn = (
    m: TeamMember,
    colWidth: number,
    fg: (color: string, text: string) => string,
    _bold: (text: string) => string,
  ): string[] => {
    const activity = buildExpandedLines(m, fg);
    const content =
      activity.length === 0 ? [fg('dim', '(no activity yet)')] : activity;

    return wrapInBox(m.name, content, colWidth, fg);
  };

  /** Render the team widget. Called from setWidget factory. */
  const renderWidget = (
    width: number,
    fg: (color: string, text: string) => string,
    bold: (text: string) => string,
  ): string[] => {
    if (members.size === 0) {
      return [];
    }

    const allMembers = Array.from(members.values());
    const lines: string[] = [];

    const cols = Math.min(
      allMembers.length,
      MAX_COLUMNS,
      Math.max(1, Math.floor(width / MIN_COLUMN_WIDTH)),
    );
    const colWidth = Math.floor(width / cols);

    // Process members in rows of `cols`
    for (let row = 0; row < allMembers.length; row += cols) {
      const rowMembers = allMembers.slice(row, row + cols);

      // Build each member's column lines (both compact and expanded use boxes)
      const columnLines: string[][] = rowMembers.map(m => {
        const cw = colWidth - 1; // leave 1 char gap between columns
        if (expandedMembers.has(m.name)) {
          return buildExpandedColumn(m, cw, fg, bold);
        }
        return wrapInBox(m.name, [buildCompactBody(m)], cw, fg);
      });

      // Find tallest column in this row
      const maxHeight = Math.max(...columnLines.map(c => c.length));

      // Render row line by line, columns side by side (bottom-justified)
      for (let lineIdx = 0; lineIdx < maxHeight; lineIdx++) {
        let rowLine = '';
        for (let c = 0; c < rowMembers.length; c++) {
          const isLast = c === rowMembers.length - 1;
          const offset = maxHeight - columnLines[c].length;
          const cellLine =
            lineIdx < offset ? '' : (columnLines[c][lineIdx - offset] ?? '');
          const vw = visibleWidth(cellLine);
          const targetW = isLast ? width - c * colWidth : colWidth;

          if (vw > targetW) {
            rowLine += truncateToWidth(cellLine, targetW);
          } else if (isLast) {
            rowLine += cellLine;
          } else {
            rowLine += cellLine + ' '.repeat(Math.max(0, colWidth - vw));
          }
        }
        lines.push(rowLine);
      }
    }

    return lines;
  };

  /** Install or update the team widget. */
  const flushWidget = () => {
    if (!widgetCtx) {
      return;
    }

    if (members.size === 0) {
      widgetCtx.ui.setWidget('agent', undefined);
      return;
    }

    widgetCtx.ui.setWidget(
      'agent',
      (
        _tui: unknown,
        theme: {
          fg: (color: string, text: string) => string;
          bold: (text: string) => string;
        },
      ) => ({
        invalidate: () => {},
        render: (width: number) =>
          renderWidget(width, theme.fg.bind(theme), theme.bold.bind(theme)),
      }),
    );
  };

  /** Debounced widget update — batches rapid session events. */
  let widgetTimer: ReturnType<typeof setTimeout> | undefined;
  const updateWidget = () => {
    if (widgetTimer) {
      return;
    }
    widgetTimer = setTimeout(() => {
      widgetTimer = undefined;
      flushWidget();
    }, 150);
  };

  /** Immediate widget update (for spawn/dismiss). */
  const updateWidgetNow = () => {
    if (widgetTimer) {
      clearTimeout(widgetTimer);
      widgetTimer = undefined;
    }
    flushWidget();
  };

  // ---------------------------------------------------------------------------
  // Session event handling — wires session events to activity log + result delivery
  // ---------------------------------------------------------------------------

  const wireEvents = (member: TeamMember) => {
    if (!member.session) {
      return;
    }

    let agentStartTime = Date.now();
    // Accumulate usage from assistant messages during a run
    let runUsage: UsageStats = emptyUsage();

    member.session.subscribe(event => {
      if (event.type === 'agent_start') {
        agentStartTime = Date.now();
        runUsage = emptyUsage();
        pushActivity(member, { timestamp: Date.now(), type: 'agent_start' });
        updateWidget();
      }

      if (event.type === 'tool_execution_start') {
        pushActivity(member, {
          timestamp: Date.now(),
          toolArgs: event.args,
          toolName: event.toolName,
          type: 'tool_start',
        });
        updateWidget();
      }

      if (event.type === 'tool_execution_end') {
        // Extract tool output text from result
        let toolOutput: string | undefined;
        const result = event.result;
        if (result?.content) {
          const contentArr = result.content as Array<{
            type: string;
            text?: string;
          }>;
          const textParts = contentArr
            .filter(c => c.type === 'text' && typeof c.text === 'string')
            .map(c => c.text as string);
          if (textParts.length > 0) {
            const full = textParts.join('\n');
            // Keep first 2000 chars for display
            toolOutput =
              full.length > 2000
                ? `${full.slice(0, 2000)}\n... [truncated]`
                : full;
          }
        }

        pushActivity(member, {
          isError: event.isError,
          timestamp: Date.now(),
          toolName: event.toolName,
          toolOutput,
          type: 'tool_end',
        });
        updateWidget();

        // Check for member-to-member routing (child's team_send)
        if (event.toolName === 'team_send' && result?.details) {
          if (result.details.routeTo && result.details.routeMessage) {
            routeMessage(
              (result.details.routeFrom as string) || member.name,
              result.details.routeTo as string,
              result.details.routeMessage as string,
            );
          }
        }
      }

      if (event.type === 'message_end') {
        const msg = event.message;
        if (msg?.role === 'assistant') {
          // Extract usage from assistant message
          const u = msg.usage;
          if (u) {
            const msgUsage: UsageStats = {
              cacheRead: u.cacheRead || 0,
              cacheWrite: u.cacheWrite || 0,
              contextTokens: u.totalTokens || 0,
              cost: u.cost?.total || 0,
              input: u.input || 0,
              output: u.output || 0,
              turns: 1,
            };
            runUsage = addUsage(runUsage, msgUsage);
          }

          // Capture last text output for activity
          const content = msg.content;
          if (content) {
            for (const part of content) {
              if (part.type === 'text' && typeof part.text === 'string') {
                pushActivity(member, {
                  text: part.text,
                  timestamp: Date.now(),
                  type: 'text_delta',
                });
              }
            }
          }
          updateWidget();
        }
      }

      if (event.type === 'agent_end') {
        const elapsed = Date.now() - agentStartTime;
        const messages = event.messages ?? [];

        // Check if an error occurred during this run
        const hadError = member.status === 'error';

        // Update member state
        member.usage = addUsage(member.usage, runUsage);
        member.sends++;
        if (!hadError) {
          member.status = 'idle';
        }

        member.pendingResult = {
          elapsed,
          error: hadError
            ? 'Agent encountered an error during execution'
            : undefined,
          messages,
          usage: runUsage,
        };

        pushActivity(member, { timestamp: Date.now(), type: 'agent_end' });
        updateWidget();

        // Inject result into main conversation
        const output = getFinalAgentOutput(messages) || '(no output)';
        const usageStr = formatUsage(runUsage, member.agent.model);
        const header = `**${member.name}** (${member.agent.name}) completed:`;
        const content = `${header}\n\n${output}${usageStr ? `\n\n_${usageStr}_` : ''}`;

        pi.sendMessage(
          {
            content,
            customType: 'team-result',
            details: {
              agentName: member.agent.name,
              memberName: member.name,
              usage: runUsage,
            },
            display: true,
          },
          {
            deliverAs: 'followUp',
            triggerTurn: true,
          },
        );
      }

      // Handle errors during streaming
      if (event.type === 'message_update') {
        const ame = event.assistantMessageEvent;
        if (ame?.type === 'error') {
          member.status = 'error';
          const errorText = ame.reason || 'unknown error';
          pushActivity(member, {
            text: errorText,
            timestamp: Date.now(),
            type: 'error',
          });
          updateWidget();
        }
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Message routing — shared by orchestrator and member team_send
  // ---------------------------------------------------------------------------

  const ORCHESTRATOR = '__orchestrator__';

  /**
   * Route a message from one member (or the orchestrator) to another.
   * If delivery fails, sends an error back to the sender.
   */
  const routeMessage = (from: string, to: string, message: string) => {
    const target = members.get(to);

    if (!target?.session) {
      // Delivery failed — send error back to sender
      const errorMsg = `[Routing error] Failed to deliver message to "${to}": member not found or session not active.`;
      if (from === ORCHESTRATOR) {
        pi.sendMessage(
          { content: errorMsg, customType: 'team-route-error', display: true },
          { deliverAs: 'followUp', triggerTurn: true },
        );
      } else {
        const sender = members.get(from);
        if (sender?.session) {
          sender.session.prompt(errorMsg).catch(() => {
            // Ignore errors sending error message
          });
        }
      }
      return;
    }

    const formatted =
      from === ORCHESTRATOR ? message : `[From: ${from}]\n\n${message}`;

    target.status = 'running';
    target.activityLog = [];
    target.lastActivity = undefined;
    target.pendingResult = undefined;
    updateWidgetNow();

    target.session.prompt(formatted).catch(() => {
      target.status = 'error';
      updateWidgetNow();
      const errorMsg = `[Routing error] Failed to deliver message to "${to}": send failed.`;
      if (from === ORCHESTRATOR) {
        pi.sendMessage(
          { content: errorMsg, customType: 'team-route-error', display: true },
          { deliverAs: 'followUp', triggerTurn: true },
        );
      } else {
        const sender = members.get(from);
        if (sender?.session) {
          sender.session.prompt(errorMsg).catch(() => {
            // Ignore errors sending error message
          });
        }
      }
    });
  };

  // Pick up team_send routing from the orchestrator's own tool calls
  // biome-ignore lint/suspicious/useAwait: pi event handlers must return Promise
  pi.on('tool_result', async event => {
    if (event.toolName !== 'team_send') {
      return;
    }
    const details = event.details as Record<string, unknown> | undefined;
    if (details?.routeTo && details?.routeMessage) {
      routeMessage(
        ORCHESTRATOR,
        details.routeTo as string,
        details.routeMessage as string,
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  // biome-ignore lint/suspicious/useAwait: pi event handlers must return Promise
  pi.on('session_start', async (_event, ctx) => {
    // Dispose any existing member sessions
    for (const [, m] of members) {
      destroyMemberSession(m);
    }
    members.clear();
    expandedMembers.clear();

    // Capture UI reference for widget management
    widgetCtx = { ui: ctx.ui } as unknown as typeof widgetCtx;
  });

  // biome-ignore lint/suspicious/useAwait: pi event handlers must return Promise
  pi.on('session_shutdown', async () => {
    for (const [, m] of members) {
      destroyMemberSession(m);
    }
  });

  // -- Toggle all team members expanded/compact --------------------------------

  const toggleAllExpanded = () => {
    if (members.size === 0) {
      return;
    }
    // If any are expanded, collapse all. Otherwise expand all.
    if (expandedMembers.size > 0) {
      expandedMembers.clear();
    } else {
      for (const name of members.keys()) {
        expandedMembers.add(name);
      }
    }
    updateWidgetNow();
  };

  pi.registerShortcut('ctrl+shift+t', {
    description: 'Toggle expanded team view',
    handler: ctx => {
      widgetCtx = { ui: ctx.ui } as unknown as typeof widgetCtx;
      toggleAllExpanded();
    },
  });

  pi.registerCommand('team-show', {
    description: 'Toggle expanded view for all team members',
    // biome-ignore lint/suspicious/useAwait: command handlers must return Promise
    handler: async (_args, ctx) => {
      widgetCtx = { ui: ctx.ui } as unknown as typeof widgetCtx;
      toggleAllExpanded();
    },
  });

  // -- team_spawn ----------------------------------------------------------

  pi.registerTool({
    description:
      'Create a named team member from an agent definition. Starts a persistent agent process for multi-turn conversations.',

    async execute(_callId, params, _signal, _onUpdate, ctx) {
      // Keep uiRef fresh from the latest tool context
      widgetCtx = { ui: ctx.ui } as unknown as typeof widgetCtx;

      const scope: AgentScope = params.agentScope ?? 'user';
      const discovery = discoverAgents(ctx.cwd, scope, [PACKAGE_AGENTS_DIR]);
      const agentDef = discovery.agents.find(a => a.name === params.agent);

      if (!agentDef) {
        const available =
          discovery.agents.map(a => `${a.name} (${a.source})`).join(', ') ||
          'none';
        throw new Error(
          `Unknown agent "${params.agent}". Available: ${available}`,
        );
      }

      const name = params.name ?? agentDef.name;

      if (members.has(name)) {
        throw new Error(
          `Team member "${name}" already exists. Dismiss first or use a different name.`,
        );
      }

      const member: TeamMember = {
        activityLog: [],
        agent: agentDef,
        name,
        sends: 0,
        status: 'idle',
        usage: emptyUsage(),
      };
      members.set(name, member);

      // Create the persistent session
      try {
        await createMemberSession(ctx.cwd, member);
      } catch (err) {
        members.delete(name);
        throw new Error(
          `Failed to create session for "${name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Wire events for activity tracking and result delivery
      wireEvents(member);

      // Update widget to show new member
      updateWidgetNow();

      return {
        content: [
          {
            text: `Team member "${name}" spawned (agent: ${agentDef.name}, model: ${agentDef.model ?? 'default'}, tools: ${agentDef.tools?.join(', ') ?? 'all default'}). Send messages with team_send — results will appear in chat when ready.`,
            type: 'text',
          },
        ],
        details: {},
      };
    },
    label: 'Team Spawn',
    name: 'team_spawn',
    parameters: Type.Object({
      agent: Type.String({
        description: 'Agent definition name (e.g., "reviewer", "executor")',
      }),
      agentScope: Type.Optional(
        StringEnum(['both', 'project', 'user'] as const, {
          default: 'user',
          description: 'Which agent directories to search. Default: "user".',
        }),
      ),
      name: Type.Optional(
        Type.String({
          description:
            'Display name for this team member. Defaults to the agent name. Use to distinguish multiple instances of the same agent.',
        }),
      ),
    }),
    promptGuidelines: [
      'Spawn team members before sending messages. Each member is an isolated agent with its own context.',
      'Use distinct names when spawning multiple instances of the same agent (e.g., "scout-auth", "scout-api").',
    ],

    renderCall(args, theme) {
      const name = args.name ?? args.agent ?? '...';
      let text = theme.fg('toolTitle', theme.bold('team_spawn '));
      text += theme.fg('accent', name);
      if (args.agent && args.name && args.agent !== args.name) {
        text += theme.fg('dim', ` (${args.agent})`);
      }
      return new Text(text, 0, 0);
    },
  });

  // -- team_send -----------------------------------------------------------

  pi.registerTool({
    description:
      "Send a message to a team member. The member's response will arrive as a separate message in the conversation when they finish.",

    // biome-ignore lint/suspicious/useAwait: execute must return Promise
    async execute(_callId, params) {
      const member = members.get(params.name);
      if (!member) {
        const available = Array.from(members.keys()).join(', ') || 'none';
        throw new Error(
          `No team member "${params.name}". Active members: ${available}`,
        );
      }

      if (!member.session) {
        throw new Error(
          `Team member "${params.name}" session is not active. Dismiss and re-spawn.`,
        );
      }

      if (member.status === 'running') {
        throw new Error(
          `Team member "${params.name}" is already processing a message. Use team_steer to redirect, or team_follow_up to queue.`,
        );
      }

      // Return routing info — the tool_result handler delivers the message
      return {
        content: [
          {
            text: `Message sent to "${params.name}". Their response will arrive as a separate message.`,
            type: 'text',
          },
        ],
        details: {
          routeFrom: ORCHESTRATOR,
          routeMessage: params.message,
          routeTo: params.name,
        },
      };
    },
    label: 'Team Send',
    name: 'team_send',
    parameters: Type.Object({
      message: Type.String({
        description: 'Message to send to the team member',
      }),
      name: Type.String({ description: 'Name of the team member to message' }),
    }),
    promptGuidelines: [
      'Each member has an isolated context — include all relevant information in the message.',
    ],

    renderCall(args, theme) {
      const preview =
        args.message && args.message.length > 60
          ? `${args.message.slice(0, 60)}...`
          : args.message || '...';
      let text = theme.fg('toolTitle', theme.bold('team_send '));
      text += theme.fg('accent', args.name || '...');
      text += `\n  ${theme.fg('dim', preview)}`;
      return new Text(text, 0, 0);
    },
  });

  // -- team_steer ----------------------------------------------------------

  pi.registerTool({
    description:
      'Interrupt a running team member with new directions. The message is delivered after the current tool execution completes.',

    async execute(_callId, params) {
      const member = members.get(params.name);
      if (!member) {
        const available = Array.from(members.keys()).join(', ') || 'none';
        throw new Error(
          `No team member "${params.name}". Active members: ${available}`,
        );
      }

      if (!member.session) {
        throw new Error(`No session for "${params.name}".`);
      }

      if (member.status !== 'running') {
        throw new Error(
          `Team member "${params.name}" is not running. Use team_send to start a task.`,
        );
      }

      try {
        await member.session.steer(params.message);
      } catch (err) {
        throw new Error(
          `Failed to steer "${params.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return {
        content: [
          {
            text: `Steering message sent to "${params.name}". They'll redirect after their current tool finishes.`,
            type: 'text',
          },
        ],
        details: { agentName: member.agent.name, memberName: member.name },
      };
    },
    label: 'Team Steer',
    name: 'team_steer',
    parameters: Type.Object({
      message: Type.String({
        description: 'Steering message to interrupt the member with',
      }),
      name: Type.String({ description: 'Name of the team member to steer' }),
    }),
    promptGuidelines: [
      'Only works when the member is actively running (status: running).',
    ],

    renderCall(args, theme) {
      const preview =
        args.message && args.message.length > 60
          ? `${args.message.slice(0, 60)}...`
          : args.message || '...';
      let text = theme.fg('toolTitle', theme.bold('team_steer '));
      text += theme.fg('warning', args.name || '...');
      text += `\n  ${theme.fg('dim', preview)}`;
      return new Text(text, 0, 0);
    },
  });

  // -- team_follow_up ------------------------------------------------------

  pi.registerTool({
    description:
      'Queue a message for a team member to process after they finish their current task. The message waits until the member completes their current work.',

    async execute(_callId, params) {
      const member = members.get(params.name);
      if (!member) {
        const available = Array.from(members.keys()).join(', ') || 'none';
        throw new Error(
          `No team member "${params.name}". Active members: ${available}`,
        );
      }

      if (!member.session) {
        throw new Error(`No session for "${params.name}".`);
      }

      try {
        await member.session.followUp(params.message);
      } catch (err) {
        throw new Error(
          `Failed to queue follow-up for "${params.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return {
        content: [
          {
            text: `Follow-up queued for "${params.name}". They'll process it after finishing their current task.`,
            type: 'text',
          },
        ],
        details: { agentName: member.agent.name, memberName: member.name },
      };
    },
    label: 'Team Follow-up',
    name: 'team_follow_up',
    parameters: Type.Object({
      message: Type.String({
        description: 'Message to queue for after the member finishes',
      }),
      name: Type.String({ description: 'Name of the team member' }),
    }),
    promptGuidelines: ['Works whether the member is running or idle.'],

    renderCall(args, theme) {
      const preview =
        args.message && args.message.length > 60
          ? `${args.message.slice(0, 60)}...`
          : args.message || '...';
      let text = theme.fg('toolTitle', theme.bold('team_follow_up '));
      text += theme.fg('accent', args.name || '...');
      text += `\n  ${theme.fg('dim', preview)}`;
      return new Text(text, 0, 0);
    },
  });

  // -- team_list -----------------------------------------------------------

  pi.registerTool({
    description: 'List all team members, their status, agent type, and usage.',

    // biome-ignore lint/suspicious/useAwait: execute must return Promise
    async execute() {
      if (members.size === 0) {
        return {
          content: [
            {
              text: 'No team members. Use team_spawn to create one.',
              type: 'text',
            },
          ],
          details: {},
        };
      }

      const lines = Array.from(members.values()).map(m => {
        const status =
          m.status === 'running'
            ? '⏳ running'
            : m.status === 'error'
              ? '✗ error'
              : '✓ idle';
        const usage = formatUsage(m.usage, m.agent.model);
        const sessionStatus = m.session ? 'session: active' : 'session: none';
        return `${m.name} [${status}] (agent: ${m.agent.name}, sends: ${m.sends}, ${sessionStatus}${usage ? `, ${usage}` : ''})`;
      });

      return {
        content: [{ text: `Team members:\n${lines.join('\n')}`, type: 'text' }],
        details: {},
      };
    },
    label: 'Team List',
    name: 'team_list',
    parameters: Type.Object({}),

    renderCall(_args, theme) {
      return new Text(theme.fg('toolTitle', theme.bold('team_list')), 0, 0);
    },
  });

  // -- team_dismiss --------------------------------------------------------

  pi.registerTool({
    description: 'Remove a team member. Aborts current work and cleans up.',

    // biome-ignore lint/suspicious/useAwait: execute must return Promise
    async execute(_callId, params) {
      const member = members.get(params.name);
      if (!member) {
        throw new Error(`No team member "${params.name}".`);
      }

      // Dispose the session
      destroyMemberSession(member);

      members.delete(params.name);
      expandedMembers.delete(params.name);
      updateWidgetNow();

      return {
        content: [
          {
            text: `Team member "${params.name}" dismissed (${member.sends} sends, ${formatUsage(member.usage)}).`,
            type: 'text',
          },
        ],
        details: {},
      };
    },
    label: 'Team Dismiss',
    name: 'team_dismiss',
    parameters: Type.Object({
      name: Type.String({ description: 'Name of the team member to dismiss' }),
    }),

    renderCall(args, theme) {
      let text = theme.fg('toolTitle', theme.bold('team_dismiss '));
      text += theme.fg('accent', args.name || '...');
      return new Text(text, 0, 0);
    },
  });
};
