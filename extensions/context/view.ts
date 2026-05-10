import type { Theme } from '@earendil-works/pi-coding-agent';
import { DynamicBorder } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';
import { Container, Key, matchesKey, Text } from '@earendil-works/pi-tui';

import { formatUsd } from './utils.ts';

export type ContextViewData = {
  usage: {
    messageTokens: number;
    contextWindow: number;
    effectiveTokens: number;
    percent: number;
    remainingTokens: number;
    systemPromptTokens: number;
    agentTokens: number;
    toolsTokens: number;
    activeTools: number;
  } | null;
  agentFiles: string[];
  extensions: string[];
  skills: string[];
  loadedSkills: string[];
  session: { totalTokens: number; totalCost: number };
};

type UsageBarParts = {
  system: number;
  tools: number;
  convo: number;
  remaining: number;
};

const renderUsageBar = (
  theme: Theme,
  parts: UsageBarParts,
  total: number,
  width: number,
): string => {
  const barWidth = Math.max(10, width);
  if (total <= 0) {
    return '';
  }

  const toCols = (tokens: number) => Math.round((tokens / total) * barWidth);
  const systemCols = toCols(parts.system);
  const toolsCols = toCols(parts.tools);
  const convoCols = toCols(parts.convo);
  const remainingCols = Math.max(
    0,
    barWidth - systemCols - toolsCols - convoCols,
  );

  const block = '█';
  return [
    theme.fg('accent', block.repeat(systemCols)),
    theme.fg('warning', block.repeat(toolsCols)),
    theme.fg('success', block.repeat(convoCols)),
    theme.fg('dim', block.repeat(remainingCols)),
  ].join('');
};

const renderUsageLegend = (theme: Theme): string => {
  const dim = (s: string) => theme.fg('dim', s);
  const item = (label: string, color: Parameters<Theme['fg']>[0]) =>
    `${dim(label)} ${theme.fg(color, '█')}`;

  return [
    item('System', 'accent'),
    item('Tools', 'warning'),
    item('Conversation', 'success'),
    item('Free', 'dim'),
  ].join(' ');
};

const renderList = (
  theme: Theme,
  label: string,
  items: string[],
  fallback = '(none)',
): string => {
  const muted = (s: string) => theme.fg('muted', s);
  const text = (s: string) => theme.fg('text', s);
  return (
    muted(`${label} (${items.length}): `) +
    text(items.length ? items.join(', ') : fallback)
  );
};

export class ContextView implements Component {
  private readonly theme: Theme;
  private readonly data: ContextViewData;
  private onDone: () => void;
  private container: Container;
  private body: Text;
  private cachedWidth?: number;

  constructor(
    _tui: TUI,
    theme: Theme,
    data: ContextViewData,
    onDone: () => void,
  ) {
    this.theme = theme;
    this.data = data;
    this.onDone = onDone;

    this.container = new Container();
    this.container.addChild(
      new DynamicBorder(segment => theme.fg('accent', segment)),
    );
    this.container.addChild(
      new Text(
        theme.fg('accent', theme.bold('Context')) +
          theme.fg('dim', '  (Esc/q/Enter to close)'),
        1,
        0,
      ),
    );
    this.container.addChild(new Text('', 1, 0));

    this.body = new Text('', 1, 0);
    this.container.addChild(this.body);

    this.container.addChild(new Text('', 1, 0));
    this.container.addChild(
      new DynamicBorder(segment => theme.fg('accent', segment)),
    );
  }

  private renderUsageSection(width: number): string[] {
    const muted = (s: string) => this.theme.fg('muted', s);
    const text = (s: string) => this.theme.fg('text', s);

    if (!this.data.usage) {
      return [muted('Window: ') + this.theme.fg('dim', '(unknown)')];
    }

    const { usage } = this.data;
    const lines: string[] = [];

    lines.push(
      muted('Window: ') +
        text(
          `~${usage.effectiveTokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()}`,
        ) +
        muted(
          `  (${usage.percent.toFixed(1)}% used, ~${usage.remainingTokens.toLocaleString()} left)`,
        ),
    );

    const barWidth = Math.max(10, Math.min(36, width - 10));
    const sysInMessages = Math.min(
      usage.systemPromptTokens,
      usage.messageTokens,
    );
    const convoInMessages = Math.max(0, usage.messageTokens - sysInMessages);

    const bar = renderUsageBar(
      this.theme,
      {
        convo: convoInMessages,
        remaining: usage.remainingTokens,
        system: sysInMessages,
        tools: usage.toolsTokens,
      },
      usage.contextWindow,
      barWidth,
    );
    lines.push(`${bar} ${renderUsageLegend(this.theme)}`);

    lines.push('');
    lines.push(
      muted('System: ') +
        text(`~${usage.systemPromptTokens.toLocaleString()} tok`) +
        muted(` (AGENTS ~${usage.agentTokens.toLocaleString()})`),
    );
    lines.push(
      muted('Tools: ') +
        text(`~${usage.toolsTokens.toLocaleString()} tok`) +
        muted(` (${usage.activeTools} active)`),
    );

    return lines;
  }

  private renderSkillsList(): string {
    const loaded = new Set(this.data.loadedSkills);

    if (!this.data.skills.length) {
      return (
        this.theme.fg('muted', 'Skills (0): ') + this.theme.fg('text', '(none)')
      );
    }

    const rendered = this.data.skills
      .map(name =>
        loaded.has(name)
          ? this.theme.fg('success', name)
          : this.theme.fg('muted', name),
      )
      .join(this.theme.fg('muted', ', '));

    return (
      this.theme.fg('muted', `Skills (${this.data.skills.length}): `) + rendered
    );
  }

  private rebuild(width: number): void {
    const muted = (s: string) => this.theme.fg('muted', s);
    const text = (s: string) => this.theme.fg('text', s);

    const lines: string[] = [
      ...this.renderUsageSection(width),
      '',
      renderList(this.theme, 'AGENTS', this.data.agentFiles),
      '',
      renderList(this.theme, 'Extensions', this.data.extensions),
      this.renderSkillsList(),
      '',
      muted('Session: ') +
        text(`${this.data.session.totalTokens.toLocaleString()} tokens`) +
        muted(' · ') +
        text(formatUsd(this.data.session.totalCost)),
    ];

    this.body.setText(lines.join('\n'));
    this.cachedWidth = width;
  }

  handleInput(data: string): void {
    const isClose =
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.ctrl('c')) ||
      data.toLowerCase() === 'q' ||
      data === '\r';

    if (isClose) {
      this.onDone();
    }
  }

  invalidate(): void {
    this.container.invalidate();
    this.cachedWidth = undefined;
  }

  render(width: number): string[] {
    if (this.cachedWidth !== width) {
      this.rebuild(width);
    }
    return this.container.render(width);
  }
}
