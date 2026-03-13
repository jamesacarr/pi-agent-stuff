import type { Component, TUI } from '@mariozechner/pi-tui';
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from '@mariozechner/pi-tui';

import { resolveGraphMetric } from './aggregate.ts';
import { bold, dim, padRightAnsi } from './format.ts';
import {
  rangeSummary,
  renderGraph,
  renderLegendItems,
  renderModelTable,
  weeksForRange,
} from './render.ts';
import type { BreakdownData, MeasurementMode } from './types.ts';
import { RANGE_DAYS } from './types.ts';

export class BreakdownView implements Component {
  private readonly data: BreakdownData;
  private readonly tui: TUI;
  private readonly onDone: () => void;
  private rangeIndex = 1; // default 30d
  private measurement: MeasurementMode = 'sessions';
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(data: BreakdownData, tui: TUI, onDone: () => void) {
    this.data = data;
    this.tui = tui;
    this.onDone = onDone;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  handleInput(data: string): void {
    if (
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.ctrl('c')) ||
      data.toLowerCase() === 'q'
    ) {
      this.onDone();
      return;
    }

    // Cycle measurement mode
    if (
      matchesKey(data, Key.tab) ||
      matchesKey(data, Key.shift('tab')) ||
      data.toLowerCase() === 't'
    ) {
      const modes: MeasurementMode[] = ['sessions', 'messages', 'tokens'];
      const current = Math.max(0, modes.indexOf(this.measurement));
      const direction = matchesKey(data, Key.shift('tab')) ? -1 : 1;
      this.measurement =
        modes[(current + modes.length + direction) % modes.length] ??
        'sessions';
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    // Range selection
    const selectRange = (index: number) => {
      this.rangeIndex = index;
      this.invalidate();
      this.tui.requestRender();
    };

    if (matchesKey(data, Key.left) || data.toLowerCase() === 'h') {
      selectRange(
        (this.rangeIndex + RANGE_DAYS.length - 1) % RANGE_DAYS.length,
      );
    }
    if (matchesKey(data, Key.right) || data.toLowerCase() === 'l') {
      selectRange((this.rangeIndex + 1) % RANGE_DAYS.length);
    }

    // Direct range selection (keys 1-3 map to RANGE_DAYS indices)
    const directIndex = { '1': 0, '2': 1, '3': 2 }[data];
    if (directIndex !== undefined) {
      selectRange(directIndex);
    }
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines) {
      return this.cachedLines;
    }

    const selectedDays = RANGE_DAYS[this.rangeIndex] ?? 30;
    const range = this.data.ranges.get(selectedDays);
    if (!range) {
      return [`No data for ${selectedDays}-day range.`];
    }
    const metric = resolveGraphMetric(range, this.measurement);

    const tab = (days: number, index: number): string => {
      const selected = index === this.rangeIndex;
      const label = `${days}d`;
      return selected ? bold(`[${label}]`) : dim(` ${label} `);
    };

    const metricTab = (mode: MeasurementMode, label: string): string =>
      mode === this.measurement ? bold(`[${label}]`) : dim(` ${label} `);

    const header =
      `${bold('Session breakdown')}  ${tab(7, 0)} ${tab(30, 1)} ${tab(90, 2)}  ` +
      `${metricTab('sessions', 'sess')} ${metricTab('messages', 'msg')} ${metricTab('tokens', 'tok')}`;

    const summary =
      rangeSummary(range, selectedDays, metric.kind) +
      dim(`   (graph: ${metric.kind}/day)`);

    // Calculate cell dimensions
    const maxScale = selectedDays === 7 ? 4 : selectedDays === 30 ? 3 : 2;
    const weeks = weeksForRange(range);
    const leftMargin = 4;
    const gap = 1;
    const graphArea = Math.max(1, width - leftMargin);
    const idealCellWidth =
      Math.floor((graphArea + gap) / Math.max(1, weeks)) - gap;
    const cellWidth = Math.min(maxScale, Math.max(1, idealCellWidth));

    const graphLines = renderGraph(range, this.data.palette, this.measurement, {
      cellWidth,
      gap,
    });
    const tableLines = renderModelTable(range, metric.kind, 8);
    const legendItems = renderLegendItems(this.data.palette);

    const lines: string[] = [];
    lines.push(truncateToWidth(header, width));
    lines.push(
      truncateToWidth(dim('←/→ range · tab metric · q to close'), width),
    );
    lines.push('');
    lines.push(truncateToWidth(summary, width));
    lines.push('');

    // Side legend if there's space, otherwise below
    const graphWidth = Math.max(0, ...graphLines.map(l => visibleWidth(l)));
    const sep = 2;
    const legendWidth = width - graphWidth - sep;
    const showSideLegend = legendWidth >= 22;

    if (showSideLegend) {
      const legendBlock: string[] = [
        dim('Top models (30d palette):'),
        ...legendItems,
      ];
      const maxLegendRows = graphLines.length;
      let legendLines = legendBlock.slice(0, maxLegendRows);
      if (legendBlock.length > maxLegendRows) {
        const remaining = legendBlock.length - (maxLegendRows - 1);
        legendLines = [
          ...legendBlock.slice(0, maxLegendRows - 1),
          dim(`+${remaining} more`),
        ];
      }
      while (legendLines.length < graphLines.length) {
        legendLines.push('');
      }

      for (let i = 0; i < graphLines.length; i++) {
        const left = padRightAnsi(
          graphLines[i] ?? '',
          graphWidth,
          visibleWidth,
        );
        const right = truncateToWidth(
          legendLines[i] ?? '',
          Math.max(0, legendWidth),
        );
        lines.push(truncateToWidth(`${left}${' '.repeat(sep)}${right}`, width));
      }
    } else {
      for (const graphLine of graphLines) {
        lines.push(truncateToWidth(graphLine, width));
      }
      lines.push('');
      lines.push(truncateToWidth(dim('Top models (30d palette):'), width));
      for (const item of legendItems) {
        lines.push(truncateToWidth(item, width));
      }
    }

    lines.push('');
    for (const tableLine of tableLines) {
      lines.push(truncateToWidth(tableLine, width));
    }

    this.cachedWidth = width;
    this.cachedLines = lines.map(l =>
      visibleWidth(l) > width ? truncateToWidth(l, width) : l,
    );
    return this.cachedLines;
  }
}
