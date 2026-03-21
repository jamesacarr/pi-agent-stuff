/**
 * Subagent Tool - Delegate tasks to specialised agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StringEnum } from '@mariozechner/pi-ai';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

import type { AgentConfig, AgentScope } from './agents.ts';
import { discoverAgents } from './agents.ts';
import { getFinalOutput, mapWithConcurrencyLimit } from './format.ts';
import type { OnUpdateCallback } from './process.ts';
import { runSingleAgent } from './process.ts';
import { renderCall, renderResult } from './render.ts';
import type { SingleResult, SubagentDetails } from './types.ts';

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

const TaskItem = Type.Object({
  agent: Type.String({ description: 'Name of the agent to invoke' }),
  cwd: Type.Optional(
    Type.String({ description: 'Working directory for the agent process' }),
  ),
  task: Type.String({ description: 'Task to delegate to the agent' }),
});

const ChainItem = Type.Object({
  agent: Type.String({ description: 'Name of the agent to invoke' }),
  cwd: Type.Optional(
    Type.String({ description: 'Working directory for the agent process' }),
  ),
  task: Type.String({
    description: 'Task with optional {previous} placeholder for prior output',
  }),
});

const AgentScopeSchema = StringEnum(['user', 'project', 'both'] as const, {
  default: 'user',
  description:
    'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
});

const SubagentParams = Type.Object({
  agent: Type.Optional(
    Type.String({
      description: 'Name of the agent to invoke (for single mode)',
    }),
  ),
  agentScope: Type.Optional(AgentScopeSchema),
  chain: Type.Optional(
    Type.Array(ChainItem, {
      description: 'Array of {agent, task} for sequential execution',
    }),
  ),
  confirmProjectAgents: Type.Optional(
    Type.Boolean({
      default: true,
      description: 'Prompt before running project-local agents. Default: true.',
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description: 'Working directory for the agent process (single mode)',
    }),
  ),
  task: Type.Optional(
    Type.String({ description: 'Task to delegate (for single mode)' }),
  ),
  tasks: Type.Optional(
    Type.Array(TaskItem, {
      description: 'Array of {agent, task} for parallel execution',
    }),
  ),
});

const PACKAGE_AGENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../agents',
);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    description: [
      'Delegate tasks to specialised subagents with isolated context.',
      'Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).',
      'Default agent scope is "user" (from ~/.pi/agent/agents).',
      'To enable project-local agents in .pi/agents, set agentScope: "both" (or "project").',
    ].join(' '),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const agentScope: AgentScope = params.agentScope ?? 'user';
      const discovery = discoverAgents(ctx.cwd, agentScope, [
        PACKAGE_AGENTS_DIR,
      ]);
      const agents = discovery.agents;
      const confirmProjectAgents = params.confirmProjectAgents ?? true;

      const hasChain = (params.chain?.length ?? 0) > 0;
      const hasTasks = (params.tasks?.length ?? 0) > 0;
      const hasSingle = Boolean(params.agent && params.task);
      const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

      const makeDetails =
        (mode: 'chain' | 'parallel' | 'single') =>
        (results: SingleResult[]): SubagentDetails => ({
          agentScope,
          mode,
          projectAgentsDir: discovery.projectAgentsDir,
          results,
        });

      if (modeCount !== 1) {
        const available =
          agents.map(a => `${a.name} (${a.source})`).join(', ') || 'none';
        return {
          content: [
            {
              text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
              type: 'text',
            },
          ],
          details: makeDetails('single')([]),
        };
      }

      // Project agent confirmation
      if (
        (agentScope === 'project' || agentScope === 'both') &&
        confirmProjectAgents &&
        ctx.hasUI
      ) {
        const requestedAgentNames = new Set<string>();
        if (params.chain) {
          for (const step of params.chain) {
            requestedAgentNames.add(step.agent);
          }
        }
        if (params.tasks) {
          for (const t of params.tasks) {
            requestedAgentNames.add(t.agent);
          }
        }
        if (params.agent) {
          requestedAgentNames.add(params.agent);
        }

        const projectAgentsRequested = Array.from(requestedAgentNames)
          .map(name => agents.find(a => a.name === name))
          .filter((a): a is AgentConfig => a?.source === 'project');

        if (projectAgentsRequested.length > 0) {
          const names = projectAgentsRequested.map(a => a.name).join(', ');
          const dir = discovery.projectAgentsDir ?? '(unknown)';
          const ok = await ctx.ui.confirm(
            'Run project-local agents?',
            `Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
          );
          if (!ok) {
            return {
              content: [
                {
                  text: 'Canceled: project-local agents not approved.',
                  type: 'text',
                },
              ],
              details: makeDetails(
                hasChain ? 'chain' : hasTasks ? 'parallel' : 'single',
              )([]),
            };
          }
        }
      }

      // -- Chain mode ------------------------------------------------------

      if (params.chain && params.chain.length > 0) {
        const results: SingleResult[] = [];
        let previousOutput = '';

        for (let i = 0; i < params.chain.length; i++) {
          const step = params.chain[i];
          const taskWithContext = step.task.replace(
            /\{previous\}/g,
            previousOutput,
          );

          const chainUpdate: OnUpdateCallback | undefined = onUpdate
            ? partial => {
                const currentResult = partial.details?.results[0];
                if (currentResult) {
                  const allResults = [...results, currentResult];
                  onUpdate({
                    content: partial.content,
                    details: makeDetails('chain')(allResults),
                  });
                }
              }
            : undefined;

          const result = await runSingleAgent(
            ctx.cwd,
            agents,
            step.agent,
            taskWithContext,
            step.cwd,
            i + 1,
            signal,
            chainUpdate,
            makeDetails('chain'),
          );
          results.push(result);

          const isError =
            result.exitCode !== 0 ||
            result.stopReason === 'error' ||
            result.stopReason === 'aborted';
          if (isError) {
            const errorMsg =
              result.errorMessage ||
              result.stderr ||
              getFinalOutput(result.messages) ||
              '(no output)';
            return {
              content: [
                {
                  text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}`,
                  type: 'text',
                },
              ],
              details: makeDetails('chain')(results),
              isError: true,
            };
          }
          previousOutput = getFinalOutput(result.messages);
        }
        return {
          content: [
            {
              text:
                getFinalOutput(results[results.length - 1].messages) ||
                '(no output)',
              type: 'text',
            },
          ],
          details: makeDetails('chain')(results),
        };
      }

      // -- Parallel mode ---------------------------------------------------

      if (params.tasks && params.tasks.length > 0) {
        if (params.tasks.length > MAX_PARALLEL_TASKS) {
          return {
            content: [
              {
                text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
                type: 'text',
              },
            ],
            details: makeDetails('parallel')([]),
          };
        }

        const allResults: SingleResult[] = new Array(params.tasks.length);
        for (let i = 0; i < params.tasks.length; i++) {
          allResults[i] = {
            agent: params.tasks[i].agent,
            agentSource: 'unknown',
            exitCode: -1,
            messages: [],
            stderr: '',
            task: params.tasks[i].task,
            usage: {
              cacheRead: 0,
              cacheWrite: 0,
              contextTokens: 0,
              cost: 0,
              input: 0,
              output: 0,
              turns: 0,
            },
          };
        }

        const emitParallelUpdate = () => {
          if (onUpdate) {
            const running = allResults.filter(r => r.exitCode === -1).length;
            const done = allResults.filter(r => r.exitCode !== -1).length;
            onUpdate({
              content: [
                {
                  text: `Parallel: ${done}/${allResults.length} done, ${running} running...`,
                  type: 'text',
                },
              ],
              details: makeDetails('parallel')([...allResults]),
            });
          }
        };

        const results = await mapWithConcurrencyLimit(
          params.tasks,
          MAX_CONCURRENCY,
          async (t, index) => {
            const result = await runSingleAgent(
              ctx.cwd,
              agents,
              t.agent,
              t.task,
              t.cwd,
              undefined,
              signal,
              partial => {
                if (partial.details?.results[0]) {
                  allResults[index] = partial.details.results[0];
                  emitParallelUpdate();
                }
              },
              makeDetails('parallel'),
            );
            allResults[index] = result;
            emitParallelUpdate();
            return result;
          },
        );

        const successCount = results.filter(r => r.exitCode === 0).length;
        const summaries = results.map(r => {
          const output = getFinalOutput(r.messages);
          const preview =
            output.slice(0, 100) + (output.length > 100 ? '...' : '');
          return `[${r.agent}] ${r.exitCode === 0 ? 'completed' : 'failed'}: ${preview || '(no output)'}`;
        });
        return {
          content: [
            {
              text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join('\n\n')}`,
              type: 'text',
            },
          ],
          details: makeDetails('parallel')(results),
        };
      }

      // -- Single mode -----------------------------------------------------

      if (params.agent && params.task) {
        const result = await runSingleAgent(
          ctx.cwd,
          agents,
          params.agent,
          params.task,
          params.cwd,
          undefined,
          signal,
          onUpdate,
          makeDetails('single'),
        );
        const isError =
          result.exitCode !== 0 ||
          result.stopReason === 'error' ||
          result.stopReason === 'aborted';
        if (isError) {
          const errorMsg =
            result.errorMessage ||
            result.stderr ||
            getFinalOutput(result.messages) ||
            '(no output)';
          return {
            content: [
              {
                text: `Agent ${result.stopReason || 'failed'}: ${errorMsg}`,
                type: 'text',
              },
            ],
            details: makeDetails('single')([result]),
            isError: true,
          };
        }
        return {
          content: [
            {
              text: getFinalOutput(result.messages) || '(no output)',
              type: 'text',
            },
          ],
          details: makeDetails('single')([result]),
        };
      }

      const available =
        agents.map(a => `${a.name} (${a.source})`).join(', ') || 'none';
      return {
        content: [
          {
            text: `Invalid parameters. Available agents: ${available}`,
            type: 'text',
          },
        ],
        details: makeDetails('single')([]),
      };
    },
    label: 'Subagent',
    name: 'subagent',
    parameters: SubagentParams,
    promptGuidelines: [
      'Use subagent to delegate tasks that benefit from an isolated context window — exploration, analysis, or self-contained implementation.',
      'Prefer the scout agent for fast codebase recon before planning.',
      'Use chain mode for multi-step workflows where each step builds on the previous (e.g., scout → planner → worker).',
      'Use parallel mode when tasks are independent and can run concurrently.',
      'Do NOT use subagents to read files — use the read tool directly. Subagents are for tasks that need exploration, analysis, or isolated work.',
      'Scouts explore and summarise — never ask a scout to return exact file contents. Ask for findings, structure, and key snippets, not verbatim dumps.',
    ],
    renderCall,
    renderResult,
  });
}
