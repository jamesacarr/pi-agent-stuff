/**
 * /context
 *
 * Small TUI view showing what's loaded/available:
 * - extensions (best-effort from registered extension slash commands)
 * - skills
 * - project context files (AGENTS.md / CLAUDE.md)
 * - current context window usage + session totals (tokens/cost)
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ToolResultEvent,
} from '@earendil-works/pi-coding-agent';

import { loadProjectContextFiles } from './discovery.ts';
import { sumSessionUsage } from './session.ts';
import { SkillTracker } from './skill-tracker.ts';
import { getLoadedSkillsFromSession, getSkillNames } from './skills.ts';
import { estimateTokens, shortenPath } from './utils.ts';
import type { ContextViewData } from './view.ts';
import { ContextView } from './view.ts';

/**
 * Estimate total tokens consumed by active tool definitions.
 * Tool schemas aren't included in ctx.getContextUsage(), so we approximate
 * from name + description with a fudge factor for parameters/formatting.
 */
const TOOL_SCHEMA_FUDGE = 1.5;

const estimateToolTokens = (pi: ExtensionAPI): number => {
  const activeNames = new Set(pi.getActiveTools());
  const allTools = pi.getAllTools();
  let tokens = 0;

  for (const tool of allTools) {
    if (activeNames.has(tool.name)) {
      tokens += estimateTokens(`${tool.name}\n${tool.description ?? ''}`);
    }
  }

  return Math.round(tokens * TOOL_SCHEMA_FUDGE);
};

const buildPlainTextOutput = (data: ContextViewData): string => {
  const lines: string[] = ['Context'];

  if (data.usage) {
    const { usage } = data;
    lines.push(
      `Window: ~${usage.effectiveTokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} (${usage.percent.toFixed(1)}% used, ~${usage.remainingTokens.toLocaleString()} left)`,
    );
    lines.push(
      `System: ~${usage.systemPromptTokens.toLocaleString()} tok (AGENTS ~${usage.agentTokens.toLocaleString()})`,
    );
    lines.push(
      `Tools: ~${usage.toolsTokens.toLocaleString()} tok (${usage.activeTools} active)`,
    );
  } else {
    lines.push('Window: (unknown)');
  }

  const list = (label: string, items: string[]) =>
    `${label} (${items.length}): ${items.length ? items.join(', ') : '(none)'}`;

  lines.push(list('AGENTS', data.agentFiles));
  lines.push(list('Extensions', data.extensions));
  lines.push(list('Skills', data.skills));
  lines.push(
    `Session: ${data.session.totalTokens.toLocaleString()} tokens · $${data.session.totalCost.toFixed(2)}`,
  );

  return lines.join('\n');
};

export default (pi: ExtensionAPI) => {
  const tracker = new SkillTracker({
    appendEntry: pi.appendEntry.bind(pi),
    getCommands: pi.getCommands.bind(pi),
  });

  pi.on('input', (event, ctx: ExtensionContext) => {
    const match = event.text.match(/^\/skill:(.+?)(?:\s|$)/);
    if (match) {
      tracker.handleSkillCommand(match[1], ctx);
    }

    return { action: 'continue' as const };
  });

  pi.on('tool_result', (event: ToolResultEvent, ctx: ExtensionContext) => {
    if (event.toolName !== 'read' || event.isError) {
      return;
    }

    const readPath =
      typeof event.input?.path === 'string' ? event.input.path : '';
    if (!readPath) {
      return;
    }

    tracker.handleReadResult(readPath, ctx);
  });

  pi.registerCommand('context', {
    description: 'Show loaded context overview',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      const extensions = pi
        .getCommands()
        .filter(cmd => cmd.sourceInfo.source === 'extension')
        .map(cmd => cmd.name)
        .sort((a, b) => a.localeCompare(b));

      const skills = getSkillNames(pi, ctx.cwd);

      const agentFiles = await loadProjectContextFiles(ctx.cwd);
      const agentFilePaths = agentFiles.map(file =>
        shortenPath(file.path, ctx.cwd),
      );
      const agentTokens = agentFiles.reduce(
        (sum, file) => sum + file.tokens,
        0,
      );

      const systemPrompt = ctx.getSystemPrompt();
      const systemPromptTokens = systemPrompt
        ? estimateTokens(systemPrompt)
        : 0;

      const contextUsage = ctx.getContextUsage();
      const messageTokens = contextUsage?.tokens ?? 0;
      const contextWindow = contextUsage?.contextWindow ?? 0;
      const toolsTokens = estimateToolTokens(pi);

      const effectiveTokens = messageTokens + toolsTokens;
      const percent =
        contextWindow > 0 ? (effectiveTokens / contextWindow) * 100 : 0;
      const remainingTokens = Math.max(0, contextWindow - effectiveTokens);

      const sessionUsage = sumSessionUsage(ctx);

      const viewData: ContextViewData = {
        agentFiles: agentFilePaths,
        extensions: extensions,
        loadedSkills: Array.from(getLoadedSkillsFromSession(ctx)).sort((a, b) =>
          a.localeCompare(b),
        ),
        session: {
          totalCost: sessionUsage.totalCost,
          totalTokens: sessionUsage.totalTokens,
        },
        skills,
        usage: contextUsage
          ? {
              activeTools: pi.getActiveTools().length,
              agentTokens,
              contextWindow,
              effectiveTokens,
              messageTokens,
              percent,
              remainingTokens,
              systemPromptTokens,
              toolsTokens,
            }
          : null,
      };

      if (!ctx.hasUI) {
        pi.sendMessage(
          {
            content: buildPlainTextOutput(viewData),
            customType: 'context',
            display: true,
          },
          { triggerTurn: false },
        );
        return;
      }

      await ctx.ui.custom<void>(
        (tui, theme, _kb, done) => new ContextView(tui, theme, viewData, done),
      );
    },
  });
};
