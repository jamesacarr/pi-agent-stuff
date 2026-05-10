import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

import { resolveGraphMetric } from './aggregate.ts';
import {
  addDaysLocal,
  countDaysInclusive,
  mondayIndex,
  toLocalDayKey,
} from './date.ts';
import {
  ansiFg,
  clamp01,
  DEFAULT_BG,
  dim,
  EMPTY_CELL,
  formatCount,
  formatUsd,
  mixRgb,
  padLeft,
  padRight,
  weightedMixRgb,
} from './format.ts';
import type {
  DayAggregate,
  GraphMetric,
  MeasurementMode,
  ModelKey,
  ModelPalette,
  RangeAggregate,
  RGB,
} from './types.ts';

// ---------------------------------------------------------------------------
// ANSI-aware string slicing
// ---------------------------------------------------------------------------

/**
 * Keep the rightmost `maxWidth` visible columns of an ANSI string.
 * Strips characters from the left until the visible width fits.
 */
const takeRight = (text: string, maxWidth: number): string => {
  const totalWidth = visibleWidth(text);
  if (totalWidth <= maxWidth) {
    return text;
  }

  // Walk forward past ANSI escapes and visible characters until we've
  // skipped enough visible columns, then return the remainder.
  const skipCols = totalWidth - maxWidth;
  let skipped = 0;
  let i = 0;

  while (i < text.length && skipped < skipCols) {
    if (text[i] === '\x1b') {
      // Skip entire ANSI escape sequence
      const end = text.indexOf('m', i);
      i = end === -1 ? text.length : end + 1;
    } else {
      skipped++;
      i++;
    }
  }

  // Skip any trailing ANSI codes at the cut point so we start on visible content
  while (i < text.length && text[i] === '\x1b') {
    const end = text.indexOf('m', i);
    i = end === -1 ? text.length : end + 1;
  }

  return text.slice(i);
};

// ---------------------------------------------------------------------------
// Day colour computation
// ---------------------------------------------------------------------------

const dayMixedColour = (
  day: DayAggregate,
  modelColors: Map<ModelKey, RGB>,
  otherColor: RGB,
  mode: MeasurementMode,
): RGB => {
  const parts: Array<{ color: RGB; weight: number }> = [];
  let otherWeight = 0;

  let map: Map<ModelKey, number>;
  if (mode === 'tokens') {
    map =
      day.tokens > 0
        ? day.tokensByModel
        : day.messages > 0
          ? day.messagesByModel
          : day.sessionsByModel;
  } else if (mode === 'messages') {
    map = day.messages > 0 ? day.messagesByModel : day.sessionsByModel;
  } else {
    map = day.sessionsByModel;
  }

  for (const [model, weight] of map.entries()) {
    const colour = modelColors.get(model);
    if (colour) {
      parts.push({ color: colour, weight });
    } else {
      otherWeight += weight;
    }
  }

  if (otherWeight > 0) {
    parts.push({ color: otherColor, weight: otherWeight });
  }

  return weightedMixRgb(parts);
};

// ---------------------------------------------------------------------------
// Calendar graph
// ---------------------------------------------------------------------------

export const weeksForRange = (range: RangeAggregate): number => {
  const { days } = range;
  const start = days[0].date;
  const end = days[days.length - 1].date;
  const gridStart = addDaysLocal(start, -mondayIndex(start));
  const gridEnd = addDaysLocal(end, 6 - mondayIndex(end));
  return Math.ceil(countDaysInclusive(gridStart, gridEnd) / 7);
};

export const renderGraph = (
  range: RangeAggregate,
  palette: ModelPalette,
  mode: MeasurementMode,
  options?: { cellWidth?: number; gap?: number },
): string[] => {
  const { days } = range;
  const start = days[0].date;
  const end = days[days.length - 1].date;
  const gridStart = addDaysLocal(start, -mondayIndex(start));

  const totalGridDays = countDaysInclusive(
    gridStart,
    addDaysLocal(end, 6 - mondayIndex(end)),
  );
  const weeks = Math.ceil(totalGridDays / 7);

  const cellWidth = Math.max(1, Math.floor(options?.cellWidth ?? 1));
  const gap = Math.max(0, Math.floor(options?.gap ?? 1));
  const block = '█'.repeat(cellWidth);
  const gapStr = ' '.repeat(gap);

  const metric = resolveGraphMetric(range, mode);
  const { denominator } = metric;

  const labelByRow = new Map<number, string>([
    [0, 'Mon'],
    [2, 'Wed'],
    [4, 'Fri'],
  ]);

  const lines: string[] = [];

  for (let row = 0; row < 7; row++) {
    const label = labelByRow.get(row);
    let line = label ? `${padRight(label, 3)} ` : '    ';

    for (let week = 0; week < weeks; week++) {
      const cellDate = addDaysLocal(gridStart, week * 7 + row);
      const inRange = cellDate >= start && cellDate <= end;
      const colGap = week < weeks - 1 ? gapStr : '';

      if (!inRange) {
        line += ' '.repeat(cellWidth) + colGap;
        continue;
      }

      const key = toLocalDayKey(cellDate);
      const day = range.dayByKey.get(key);
      const value = dayValue(day, metric);

      if (!day || value <= 0) {
        line += ansiFg(EMPTY_CELL, block) + colGap;
        continue;
      }

      const hue = dayMixedColour(
        day,
        palette.modelColors,
        palette.otherColor,
        mode,
      );
      const logScale =
        denominator > 0 ? clamp01(Math.log1p(value) / denominator) : 0;
      const minVisible = 0.2;
      const intensity = minVisible + (1 - minVisible) * logScale;
      const rgb = mixRgb(DEFAULT_BG, hue, intensity);
      line += ansiFg(rgb, block) + colGap;
    }

    lines.push(line);
  }

  return lines;
};

const dayValue = (
  day: DayAggregate | undefined,
  metric: GraphMetric,
): number => {
  if (!day) {
    return 0;
  }
  if (metric.kind === 'tokens') {
    return day.tokens;
  }
  if (metric.kind === 'messages') {
    return day.messages;
  }
  return day.sessions;
};

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

const displayModelName = (modelKey: string): string => {
  const slashIndex = modelKey.indexOf('/');
  return slashIndex === -1 ? modelKey : modelKey.slice(slashIndex + 1);
};

export const renderLegendItems = (palette: ModelPalette): string[] => {
  const items: string[] = [];
  for (const model of palette.orderedModels) {
    const colour = palette.modelColors.get(model);
    if (colour) {
      items.push(`${ansiFg(colour, '█')} ${displayModelName(model)}`);
    }
  }
  items.push(`${ansiFg(palette.otherColor, '█')} other`);
  return items;
};

// ---------------------------------------------------------------------------
// Model table
// ---------------------------------------------------------------------------

/**
 * Render a tabular model breakdown for the given metric kind.
 * The `kind` parameter should be the already-resolved metric (e.g. from `resolveGraphMetric`),
 * not a user preference — this function does not perform fallback resolution.
 */
export const renderModelTable = (
  range: RangeAggregate,
  kind: MeasurementMode,
  maxRows = 8,
): string[] => {
  let perModel: Map<ModelKey, number>;
  let total = 0;

  if (kind === 'tokens') {
    perModel = range.modelTokens;
    total = range.totalTokens;
  } else if (kind === 'messages') {
    perModel = range.modelMessages;
    total = range.totalMessages;
  } else {
    perModel = range.modelSessions;
    total = range.sessions;
  }

  const sorted = [...perModel.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);
  const rows = sorted.slice(0, maxRows);

  const valueWidth = kind === 'tokens' ? 10 : 8;
  const modelWidth = Math.min(
    52,
    Math.max('model'.length, ...rows.map(r => r.key.length)),
  );

  const lines: string[] = [];
  lines.push(
    `${padRight('model', modelWidth)}  ${padLeft(kind, valueWidth)}  ${padLeft('cost', 10)}  ${padLeft('share', 6)}`,
  );
  lines.push(
    `${'-'.repeat(modelWidth)}  ${'-'.repeat(valueWidth)}  ${'-'.repeat(10)}  ${'-'.repeat(6)}`,
  );

  for (const row of rows) {
    const value = perModel.get(row.key) ?? 0;
    const cost = range.modelCost.get(row.key) ?? 0;
    const share = total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
    lines.push(
      `${padRight(row.key.slice(0, modelWidth), modelWidth)}  ${padLeft(formatCount(value), valueWidth)}  ${padLeft(formatUsd(cost), 10)}  ${padLeft(share, 6)}`,
    );
  }

  if (sorted.length === 0) {
    lines.push(dim('(no model data found)'));
  }

  return lines;
};

// ---------------------------------------------------------------------------
// Summary line
// ---------------------------------------------------------------------------

export const rangeSummary = (
  range: RangeAggregate,
  days: number,
  mode: MeasurementMode,
): string => {
  const avg = range.sessions > 0 ? range.totalCost / range.sessions : 0;
  const costPart =
    range.totalCost > 0
      ? `${formatUsd(range.totalCost)} · avg ${formatUsd(avg)}/session`
      : '$0.0000';

  if (mode === 'tokens') {
    return `Last ${days} days: ${formatCount(range.sessions)} sessions · ${formatCount(range.totalTokens)} tokens · ${costPart}`;
  }
  if (mode === 'messages') {
    return `Last ${days} days: ${formatCount(range.sessions)} sessions · ${formatCount(range.totalMessages)} messages · ${costPart}`;
  }
  return `Last ${days} days: ${formatCount(range.sessions)} sessions · ${costPart}`;
};

// ---------------------------------------------------------------------------
// Layout helpers (used by the TUI component)
// ---------------------------------------------------------------------------

export const fitRight = (text: string, width: number): string => {
  if (width <= 0) {
    return '';
  }
  const trimmed = takeRight(text, width);
  const trimmedWidth = visibleWidth(trimmed);
  return `${' '.repeat(Math.max(0, width - trimmedWidth))}${trimmed}`;
};

export const renderLeftRight = (
  left: string,
  right: string,
  width: number,
): string => {
  if (width <= 0) {
    return '';
  }

  const leftWidth = visibleWidth(left);
  if (leftWidth >= width) {
    return truncateToWidth(left, width);
  }

  const remaining = width - leftWidth;
  const rightText = takeRight(right, remaining);

  const pad = Math.max(0, remaining - visibleWidth(rightText));
  return `${left}${' '.repeat(pad)}${rightText}`;
};
