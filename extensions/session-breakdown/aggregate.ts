import { addDaysLocal, localMidnight, toLocalDayKey } from './date.ts';
import { MODEL_PALETTE } from './format.ts';
import type {
  DayAggregate,
  GraphMetric,
  MeasurementMode,
  ModelKey,
  ModelPalette,
  ParsedSession,
  RangeAggregate,
  RGB,
} from './types.ts';

// ---------------------------------------------------------------------------
// Range construction
// ---------------------------------------------------------------------------

const emptyDay = (date: Date, dayKey: string): DayAggregate => ({
  costByModel: new Map(),
  date,
  dayKey,
  messages: 0,
  messagesByModel: new Map(),
  sessions: 0,
  sessionsByModel: new Map(),
  tokens: 0,
  tokensByModel: new Map(),
  totalCost: 0,
});

export const buildRange = (days: number, now: Date): RangeAggregate => {
  const end = localMidnight(now);
  const start = addDaysLocal(end, -(days - 1));
  const dayList: DayAggregate[] = [];
  const dayByKey = new Map<string, DayAggregate>();

  for (let i = 0; i < days; i++) {
    const date = addDaysLocal(start, i);
    const dayKey = toLocalDayKey(date);
    const day = emptyDay(date, dayKey);
    dayList.push(day);
    dayByKey.set(dayKey, day);
  }

  return {
    dayByKey,
    days: dayList,
    modelCost: new Map(),
    modelMessages: new Map(),
    modelSessions: new Map(),
    modelTokens: new Map(),
    sessions: 0,
    totalCost: 0,
    totalMessages: 0,
    totalTokens: 0,
  };
};

// ---------------------------------------------------------------------------
// Adding sessions to a range
// ---------------------------------------------------------------------------

const incrementMap = (
  map: Map<ModelKey, number>,
  key: ModelKey,
  amount: number,
) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

export const addSessionToRange = (
  range: RangeAggregate,
  session: ParsedSession,
): void => {
  const day = range.dayByKey.get(session.dayKey);
  if (!day) {
    return;
  }

  range.sessions += 1;
  range.totalMessages += session.messages;
  range.totalTokens += session.tokens;
  range.totalCost += session.totalCost;

  day.sessions += 1;
  day.messages += session.messages;
  day.tokens += session.tokens;
  day.totalCost += session.totalCost;

  for (const model of session.modelsUsed) {
    incrementMap(day.sessionsByModel, model, 1);
    incrementMap(range.modelSessions, model, 1);
  }

  for (const [model, count] of session.messagesByModel.entries()) {
    incrementMap(day.messagesByModel, model, count);
    incrementMap(range.modelMessages, model, count);
  }

  for (const [model, count] of session.tokensByModel.entries()) {
    incrementMap(day.tokensByModel, model, count);
    incrementMap(range.modelTokens, model, count);
  }

  for (const [model, cost] of session.costByModel.entries()) {
    incrementMap(day.costByModel, model, cost);
    incrementMap(range.modelCost, model, cost);
  }
};

// ---------------------------------------------------------------------------
// Sorting and palette selection
// ---------------------------------------------------------------------------

export const sortMapDescending = <K extends string>(
  map: Map<K, number>,
): Array<{ key: K; value: number }> =>
  [...map.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);

/**
 * Choose a colour palette from the 30-day range.
 * Prefers cost for ranking if any exists, else tokens, messages, sessions.
 */
export const choosePalette = (
  range: RangeAggregate,
  topN = 4,
): ModelPalette => {
  const costSum = [...range.modelCost.values()].reduce((a, b) => a + b, 0);
  const popularity =
    costSum > 0
      ? range.modelCost
      : range.totalTokens > 0
        ? range.modelTokens
        : range.totalMessages > 0
          ? range.modelMessages
          : range.modelSessions;

  const sorted = sortMapDescending(popularity);
  const orderedModels = sorted.slice(0, topN).map(x => x.key);
  const modelColors = new Map<ModelKey, RGB>();

  for (let i = 0; i < orderedModels.length; i++) {
    modelColors.set(orderedModels[i], MODEL_PALETTE[i % MODEL_PALETTE.length]);
  }

  return {
    modelColors,
    orderedModels,
    otherColor: { b: 160, g: 160, r: 160 },
  };
};

// ---------------------------------------------------------------------------
// Graph metric resolution
// ---------------------------------------------------------------------------

const makeMetric = (kind: MeasurementMode, max: number): GraphMetric => ({
  denominator: Math.log1p(max),
  kind,
  max,
});

/**
 * Determine the best metric for a given mode, falling back through
 * tokens → messages → sessions when the preferred mode has no data.
 *
 * Uses switch fallthrough so each case naturally cascades to the next.
 */
export const resolveGraphMetric = (
  range: RangeAggregate,
  preferredMode: MeasurementMode,
): GraphMetric => {
  switch (preferredMode) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional cascade when a mode has no data
    case 'tokens': {
      const max = Math.max(0, ...range.days.map(d => d.tokens));
      if (max > 0) {
        return makeMetric('tokens', max);
      }
    }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional cascade when a mode has no data
    case 'messages': {
      const max = Math.max(0, ...range.days.map(d => d.messages));
      if (max > 0) {
        return makeMetric('messages', max);
      }
    }
    default: {
      const max = Math.max(0, ...range.days.map(d => d.sessions));
      return makeMetric('sessions', max);
    }
  }
};
