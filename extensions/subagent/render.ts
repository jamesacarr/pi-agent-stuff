import type { AgentToolResult } from '@mariozechner/pi-agent-core';
import type { Theme } from '@mariozechner/pi-coding-agent';
import { getMarkdownTheme } from '@mariozechner/pi-coding-agent';
import { Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';

import type { AgentScope } from './agents.ts';
import {
  formatToolCall,
  formatUsageStats,
  getDisplayItems,
  getFinalOutput,
} from './format.ts';
import type { DisplayItem, SingleResult, SubagentDetails } from './types.ts';

const COLLAPSED_ITEM_COUNT = 10;

// ---------------------------------------------------------------------------
// Shared render helpers
// ---------------------------------------------------------------------------

const statusIcon = (result: SingleResult, theme: Theme): string => {
  const isError =
    result.exitCode !== 0 ||
    result.stopReason === 'error' ||
    result.stopReason === 'aborted';
  return isError ? theme.fg('error', '✗') : theme.fg('success', '✓');
};

const isResultError = (r: SingleResult): boolean =>
  r.exitCode !== 0 || r.stopReason === 'error' || r.stopReason === 'aborted';

const renderDisplayItems = (
  items: DisplayItem[],
  theme: Theme,
  expanded: boolean,
  limit?: number,
): string => {
  const toShow = limit ? items.slice(-limit) : items;
  const skipped = limit && items.length > limit ? items.length - limit : 0;
  let text = '';
  if (skipped > 0) {
    text += theme.fg('muted', `... ${skipped} earlier items\n`);
  }
  for (const item of toShow) {
    if (item.type === 'text') {
      const preview = expanded
        ? item.text
        : item.text.split('\n').slice(0, 3).join('\n');
      text += `${theme.fg('toolOutput', preview)}\n`;
    } else {
      text += `${theme.fg('muted', '→ ') + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
    }
  }
  return text.trimEnd();
};

const aggregateUsage = (
  results: SingleResult[],
): {
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  input: number;
  output: number;
  turns: number;
} => {
  const total = {
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    input: 0,
    output: 0,
    turns: 0,
  };
  for (const r of results) {
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
};

/** Appends tool call items and optional markdown output to a container. */
const appendOutputSection = (
  container: Container,
  items: DisplayItem[],
  finalOutput: string,
  theme: Theme,
): void => {
  for (const item of items) {
    if (item.type === 'toolCall') {
      container.addChild(
        new Text(
          theme.fg('muted', '→ ') +
            formatToolCall(item.name, item.args, theme.fg.bind(theme)),
          0,
          0,
        ),
      );
    }
  }
  if (finalOutput) {
    container.addChild(new Spacer(1));
    container.addChild(
      new Markdown(finalOutput.trim(), 0, 0, getMarkdownTheme()),
    );
  }
};

/** Appends a usage line to a container if non-empty. */
const appendUsage = (
  container: Container,
  usage: {
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    input: number;
    output: number;
    turns?: number;
  },
  theme: Theme,
  prefix?: string,
  model?: string,
): void => {
  const str = formatUsageStats(usage, model);
  if (str) {
    container.addChild(new Spacer(1));
    container.addChild(
      new Text(theme.fg('dim', prefix ? `${prefix}${str}` : str), 0, 0),
    );
  }
};

// ---------------------------------------------------------------------------
// renderCall
// ---------------------------------------------------------------------------

export const renderCall = (
  args: Record<string, unknown>,
  theme: Theme,
): Text => {
  const scope = (args.agentScope as AgentScope) ?? 'user';
  const chain = args.chain as
    | Array<{ agent: string; task: string }>
    | undefined;
  const tasks = args.tasks as
    | Array<{ agent: string; task: string }>
    | undefined;

  if (chain && chain.length > 0) {
    let text =
      theme.fg('toolTitle', theme.bold('subagent ')) +
      theme.fg('accent', `chain (${chain.length} steps)`) +
      theme.fg('muted', ` [${scope}]`);
    for (let i = 0; i < Math.min(chain.length, 3); i++) {
      const step = chain[i];
      const cleanTask = step.task.replace(/\{previous\}/g, '').trim();
      const preview =
        cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
      text +=
        '\n  ' +
        theme.fg('muted', `${i + 1}.`) +
        ' ' +
        theme.fg('accent', step.agent) +
        theme.fg('dim', ` ${preview}`);
    }
    if (chain.length > 3) {
      text += `\n  ${theme.fg('muted', `... +${chain.length - 3} more`)}`;
    }
    return new Text(text, 0, 0);
  }

  if (tasks && tasks.length > 0) {
    let text =
      theme.fg('toolTitle', theme.bold('subagent ')) +
      theme.fg('accent', `parallel (${tasks.length} tasks)`) +
      theme.fg('muted', ` [${scope}]`);
    for (const t of tasks.slice(0, 3)) {
      const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
      text += `\n  ${theme.fg('accent', t.agent)}${theme.fg('dim', ` ${preview}`)}`;
    }
    if (tasks.length > 3) {
      text += `\n  ${theme.fg('muted', `... +${tasks.length - 3} more`)}`;
    }
    return new Text(text, 0, 0);
  }

  const agentName = (args.agent as string) || '...';
  const taskStr = args.task as string | undefined;
  const preview = taskStr
    ? taskStr.length > 60
      ? `${taskStr.slice(0, 60)}...`
      : taskStr
    : '...';
  let text =
    theme.fg('toolTitle', theme.bold('subagent ')) +
    theme.fg('accent', agentName) +
    theme.fg('muted', ` [${scope}]`);
  text += `\n  ${theme.fg('dim', preview)}`;
  return new Text(text, 0, 0);
};

// ---------------------------------------------------------------------------
// renderResult — per-mode renderers
// ---------------------------------------------------------------------------

const renderSingle = (
  r: SingleResult,
  expanded: boolean,
  theme: Theme,
): Container | Text => {
  const isError = isResultError(r);
  const icon = statusIcon(r, theme);
  const displayItems = getDisplayItems(r.messages);
  const finalOutput = getFinalOutput(r.messages);

  if (expanded) {
    const container = new Container();
    let header = `${icon} ${theme.fg('toolTitle', theme.bold(r.agent))}${theme.fg('muted', ` (${r.agentSource})`)}`;
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
    container.addChild(new Text(theme.fg('muted', '─── Task ───'), 0, 0));
    container.addChild(new Text(theme.fg('dim', r.task), 0, 0));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('muted', '─── Output ───'), 0, 0));
    if (displayItems.length === 0 && !finalOutput) {
      container.addChild(new Text(theme.fg('muted', '(no output)'), 0, 0));
    } else {
      appendOutputSection(container, displayItems, finalOutput, theme);
    }
    appendUsage(container, r.usage, theme, undefined, r.model);
    return container;
  }

  let text = `${icon} ${theme.fg('toolTitle', theme.bold(r.agent))}${theme.fg('muted', ` (${r.agentSource})`)}`;
  if (isError && r.stopReason) {
    text += ` ${theme.fg('error', `[${r.stopReason}]`)}`;
  }
  if (isError && r.errorMessage) {
    text += `\n${theme.fg('error', `Error: ${r.errorMessage}`)}`;
  } else if (displayItems.length === 0) {
    text += `\n${theme.fg('muted', '(no output)')}`;
  } else {
    text += `\n${renderDisplayItems(displayItems, theme, expanded, COLLAPSED_ITEM_COUNT)}`;
    if (displayItems.length > COLLAPSED_ITEM_COUNT) {
      text += `\n${theme.fg('muted', '(Ctrl+O to expand)')}`;
    }
  }
  const usageStr = formatUsageStats(r.usage, r.model);
  if (usageStr) {
    text += `\n${theme.fg('dim', usageStr)}`;
  }
  return new Text(text, 0, 0);
};

const renderMultiResult = (
  results: SingleResult[],
  expanded: boolean,
  theme: Theme,
  mode: 'chain' | 'parallel',
): Container | Text => {
  const successCount = results.filter(r => r.exitCode === 0).length;
  const isChain = mode === 'chain';

  // Parallel-specific: detect running tasks
  const running = results.filter(r => r.exitCode === -1).length;
  const failCount = results.filter(r => r.exitCode > 0).length;
  const isRunning = running > 0;

  const headerIcon = isChain
    ? successCount === results.length
      ? theme.fg('success', '✓')
      : theme.fg('error', '✗')
    : isRunning
      ? theme.fg('warning', '⏳')
      : failCount > 0
        ? theme.fg('warning', '◐')
        : theme.fg('success', '✓');

  const headerLabel = isChain
    ? `${theme.fg('toolTitle', theme.bold('chain '))}${theme.fg('accent', `${successCount}/${results.length} steps`)}`
    : `${theme.fg('toolTitle', theme.bold('parallel '))}${theme.fg('accent', isRunning ? `${successCount + failCount}/${results.length} done, ${running} running` : `${successCount}/${results.length} tasks`)}`;

  // Expanded view (not for running parallel)
  if (expanded && (!isRunning || isChain)) {
    const container = new Container();
    container.addChild(new Text(`${headerIcon} ${headerLabel}`, 0, 0));

    for (const r of results) {
      const rIcon = statusIcon(r, theme);
      const displayItems = getDisplayItems(r.messages);
      const finalOutput = getFinalOutput(r.messages);

      container.addChild(new Spacer(1));
      const stepLabel = isChain
        ? `${theme.fg('muted', `─── Step ${r.step}: `)}${theme.fg('accent', r.agent)} ${rIcon}`
        : `${theme.fg('muted', '─── ')}${theme.fg('accent', r.agent)} ${rIcon}`;
      container.addChild(new Text(stepLabel, 0, 0));
      container.addChild(
        new Text(theme.fg('muted', 'Task: ') + theme.fg('dim', r.task), 0, 0),
      );
      appendOutputSection(container, displayItems, finalOutput, theme);

      const stepUsage = formatUsageStats(r.usage, r.model);
      if (stepUsage) {
        container.addChild(new Text(theme.fg('dim', stepUsage), 0, 0));
      }
    }

    appendUsage(container, aggregateUsage(results), theme, 'Total: ');
    return container;
  }

  // Collapsed view
  let text = `${headerIcon} ${headerLabel}`;
  for (const r of results) {
    const rIcon =
      r.exitCode === -1 ? theme.fg('warning', '⏳') : statusIcon(r, theme);
    const displayItems = getDisplayItems(r.messages);
    const stepLabel = isChain
      ? `${theme.fg('muted', `─── Step ${r.step}: `)}${theme.fg('accent', r.agent)} ${rIcon}`
      : `${theme.fg('muted', '─── ')}${theme.fg('accent', r.agent)} ${rIcon}`;
    text += `\n\n${stepLabel}`;
    if (displayItems.length === 0) {
      const emptyLabel =
        !isChain && r.exitCode === -1 ? '(running...)' : '(no output)';
      text += `\n${theme.fg('muted', emptyLabel)}`;
    } else {
      text += `\n${renderDisplayItems(displayItems, theme, expanded, isChain ? 5 : 5)}`;
    }
  }
  if (!isRunning) {
    const usageStr = formatUsageStats(aggregateUsage(results));
    if (usageStr) {
      text += `\n\n${theme.fg('dim', `Total: ${usageStr}`)}`;
    }
  }
  if (!expanded) {
    text += `\n${theme.fg('muted', '(Ctrl+O to expand)')}`;
  }
  return new Text(text, 0, 0);
};

// ---------------------------------------------------------------------------
// renderResult — entry point
// ---------------------------------------------------------------------------

export const renderResult = (
  result: AgentToolResult<unknown>,
  { expanded }: { expanded: boolean },
  theme: Theme,
): Container | Text => {
  const details = result.details as SubagentDetails | undefined;
  if (!details || details.results.length === 0) {
    const text = result.content[0];
    return new Text(text?.type === 'text' ? text.text : '(no output)', 0, 0);
  }

  if (details.mode === 'single' && details.results.length === 1) {
    return renderSingle(details.results[0], expanded, theme);
  }

  if (details.mode === 'chain' || details.mode === 'parallel') {
    return renderMultiResult(details.results, expanded, theme, details.mode);
  }

  const text = result.content[0];
  return new Text(text?.type === 'text' ? text.text : '(no output)', 0, 0);
};
