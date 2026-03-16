/**
 * Team Extension — persistent subagent orchestration
 *
 * Spawns named agents with persistent sessions so the orchestrator (main agent)
 * can have multi-turn conversations with each team member.
 *
 * Tools:
 *   team_spawn  — create a named agent with a persistent session
 *   team_send   — send a message to an agent and wait for the response (blocking)
 *   team_list   — list all team members and their status
 *   team_dismiss — remove a team member (kills if running)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StringEnum } from '@mariozechner/pi-ai';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { getMarkdownTheme } from '@mariozechner/pi-coding-agent';
import { Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';
import { Type } from '@sinclair/typebox';

import type { AgentScope } from '../subagent/agents.ts';
import { discoverAgents } from '../subagent/agents.ts';
import {
  addUsage,
  emptyUsage,
  formatToolCall,
  formatUsage,
  getDisplayItems,
  getFinalOutput,
} from './format.ts';
import { cleanSessionDir, makeSessionDir, runAgent } from './process.ts';
import type { TeamMember, TeamSendDetails } from './types.ts';

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const PACKAGE_AGENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../agents',
);

const COLLAPSED_ITEM_COUNT = 10;

export default (pi: ExtensionAPI) => {
  const members = new Map<string, TeamMember>();
  let sessionDir = makeSessionDir();

  // Clean up on session start (new session = fresh team)
  pi.on('session_start', (_event, _ctx) => {
    for (const [, m] of members) {
      if (m.proc && m.status === 'running') {
        m.proc.kill('SIGTERM');
      }
    }
    members.clear();
    cleanSessionDir(sessionDir);
    sessionDir = makeSessionDir();
  });

  // Clean up on shutdown
  pi.on('session_shutdown', () => {
    for (const [, m] of members) {
      if (m.proc && m.status === 'running') {
        m.proc.kill('SIGTERM');
      }
    }
  });

  // -- team_spawn --------------------------------------------------------

  pi.registerTool({
    description: [
      'Create a named team member from an agent definition.',
      'The team member gets a persistent session for multi-turn conversations.',
      'Use team_send to communicate with them after spawning.',
    ].join(' '),

    // biome-ignore lint/suspicious/useAwait: execute must return Promise
    async execute(_callId, params, _signal, _onUpdate, ctx) {
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

      const sessionFile = path.join(sessionDir, `${name}.jsonl`);
      const member: TeamMember = {
        agent: agentDef,
        name,
        sends: 0,
        sessionFile,
        status: 'idle',
        usage: emptyUsage(),
      };
      members.set(name, member);

      return {
        content: [
          {
            text: `Team member "${name}" spawned (agent: ${agentDef.name}, model: ${agentDef.model ?? 'default'}, tools: ${agentDef.tools?.join(', ') ?? 'all default'}).`,
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
      'Spawn team members before sending messages. Each member has an isolated context window.',
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

  // -- team_send ---------------------------------------------------------

  pi.registerTool({
    description: [
      'Send a message to a team member and wait for their response.',
      'The conversation is persistent — each send continues where the last left off.',
      "Returns the team member's full response.",
    ].join(' '),

    async execute(_callId, params, signal, onUpdate, ctx) {
      const member = members.get(params.name);
      if (!member) {
        const available = Array.from(members.keys()).join(', ') || 'none';
        throw new Error(
          `No team member "${params.name}". Active members: ${available}`,
        );
      }

      if (member.status === 'running') {
        throw new Error(
          `Team member "${params.name}" is already processing a message. Wait for it to finish.`,
        );
      }

      member.status = 'running';

      const result = await runAgent(
        ctx.cwd,
        member,
        params.message,
        signal,
        onUpdate
          ? partial => {
              onUpdate(partial);
            }
          : undefined,
        sessionDir,
      );

      member.usage = addUsage(member.usage, result.usage);
      member.sends++;

      const isError =
        result.exitCode !== 0 ||
        result.stopReason === 'error' ||
        result.stopReason === 'aborted';

      member.status = isError ? 'error' : 'idle';

      if (isError) {
        const errorMsg =
          result.errorMessage ||
          result.stderr ||
          getFinalOutput(result.messages) ||
          '(no output)';
        throw new Error(`Team member "${params.name}" failed: ${errorMsg}`);
      }

      const output = getFinalOutput(result.messages) || '(no output)';

      return {
        content: [{ text: output, type: 'text' }],
        details: {
          agentName: member.agent.name,
          memberName: member.name,
          result,
          totalUsage: member.usage,
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
      'team_send is blocking — wait for the response before deciding next steps.',
      'Include relevant context from previous team member responses when relaying between members.',
      'Summarise long outputs before passing to the next team member to conserve their context window.',
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

    renderResult(result, { expanded }, theme) {
      const details = result.details as TeamSendDetails | undefined;
      if (!details) {
        const t = result.content[0];
        return new Text(t?.type === 'text' ? t.text : '(no output)', 0, 0);
      }

      const r = details.result;
      const isError =
        r.exitCode !== 0 ||
        r.stopReason === 'error' ||
        r.stopReason === 'aborted';
      const icon = isError ? theme.fg('error', '✗') : theme.fg('success', '✓');
      const displayItems = getDisplayItems(r.messages);
      const finalOutput = getFinalOutput(r.messages);
      const mdTheme = getMarkdownTheme();

      if (expanded) {
        const container = new Container();
        let header = `${icon} ${theme.fg('toolTitle', theme.bold(details.memberName))}`;
        header += theme.fg('muted', ` (${details.agentName})`);
        if (isError && r.stopReason) {
          header += ` ${theme.fg('error', `[${r.stopReason}]`)}`;
        }
        container.addChild(new Text(header, 0, 0));

        if (isError && r.errorMessage) {
          container.addChild(
            new Text(theme.fg('error', `Error: ${r.errorMessage}`), 0, 0),
          );
        }

        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg('muted', '─── Output ───'), 0, 0));

        for (const item of displayItems) {
          if (item.type === 'toolCall') {
            container.addChild(
              new Text(
                `${theme.fg('muted', '→ ')}${formatToolCall(item.name, item.args, theme.fg.bind(theme))}`,
                0,
                0,
              ),
            );
          }
        }

        if (finalOutput) {
          container.addChild(new Spacer(1));
          container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
        } else {
          container.addChild(new Text(theme.fg('muted', '(no output)'), 0, 0));
        }

        const usageStr = formatUsage(details.totalUsage, r.model);
        if (usageStr) {
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg('dim', usageStr), 0, 0));
        }
        return container;
      }

      // Collapsed view
      let text = `${icon} ${theme.fg('toolTitle', theme.bold(details.memberName))}`;
      text += theme.fg('muted', ` (${details.agentName})`);
      if (isError && r.stopReason) {
        text += ` ${theme.fg('error', `[${r.stopReason}]`)}`;
      }
      if (isError && r.errorMessage) {
        text += `\n${theme.fg('error', `Error: ${r.errorMessage}`)}`;
      } else if (displayItems.length === 0) {
        text += `\n${theme.fg('muted', '(no output)')}`;
      } else {
        const toShow = displayItems.slice(-COLLAPSED_ITEM_COUNT);
        const skipped = displayItems.length - toShow.length;
        if (skipped > 0) {
          text += `\n${theme.fg('muted', `... ${skipped} earlier items`)}`;
        }
        for (const item of toShow) {
          if (item.type === 'text') {
            const preview = item.text.split('\n').slice(0, 3).join('\n');
            text += `\n${theme.fg('toolOutput', preview)}`;
          } else {
            text += `\n${theme.fg('muted', '→ ')}${formatToolCall(item.name, item.args, theme.fg.bind(theme))}`;
          }
        }
        if (displayItems.length > COLLAPSED_ITEM_COUNT) {
          text += `\n${theme.fg('muted', '(Ctrl+O to expand)')}`;
        }
      }

      const usageStr = formatUsage(details.totalUsage, r.model);
      if (usageStr) {
        text += `\n${theme.fg('dim', usageStr)}`;
      }
      return new Text(text, 0, 0);
    },
  });

  // -- team_list ---------------------------------------------------------

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
        return `${m.name} [${status}] (agent: ${m.agent.name}, sends: ${m.sends}${usage ? `, ${usage}` : ''})`;
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

  // -- team_dismiss ------------------------------------------------------

  pi.registerTool({
    description:
      'Remove a team member. Kills the process if currently running.',

    // biome-ignore lint/suspicious/useAwait: execute must return Promise
    async execute(_callId, params) {
      const member = members.get(params.name);
      if (!member) {
        throw new Error(`No team member "${params.name}".`);
      }

      if (member.proc && member.status === 'running') {
        member.proc.kill('SIGTERM');
      }

      members.delete(params.name);

      // Clean up session file
      try {
        fs.unlinkSync(member.sessionFile);
      } catch {
        /* ignore */
      }

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
