/** Provider/model identifier, e.g. "anthropic/claude-sonnet-4-20250514". */
export type ModelKey = string;

export interface ParsedSession {
  filePath: string;
  startedAt: Date;
  /** YYYY-MM-DD in local time. */
  dayKey: string;
  modelsUsed: Set<ModelKey>;
  messages: number;
  tokens: number;
  totalCost: number;
  costByModel: Map<ModelKey, number>;
  messagesByModel: Map<ModelKey, number>;
  tokensByModel: Map<ModelKey, number>;
}

export interface DayAggregate {
  date: Date;
  dayKey: string;
  sessions: number;
  messages: number;
  tokens: number;
  totalCost: number;
  costByModel: Map<ModelKey, number>;
  sessionsByModel: Map<ModelKey, number>;
  messagesByModel: Map<ModelKey, number>;
  tokensByModel: Map<ModelKey, number>;
}

export interface RangeAggregate {
  days: DayAggregate[];
  dayByKey: Map<string, DayAggregate>;
  sessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  modelCost: Map<ModelKey, number>;
  modelSessions: Map<ModelKey, number>;
  modelMessages: Map<ModelKey, number>;
  modelTokens: Map<ModelKey, number>;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ModelPalette {
  modelColors: Map<ModelKey, RGB>;
  otherColor: RGB;
  orderedModels: ModelKey[];
}

export interface BreakdownData {
  generatedAt: Date;
  ranges: Map<number, RangeAggregate>;
  palette: ModelPalette;
}

export type MeasurementMode = 'sessions' | 'messages' | 'tokens';

export interface GraphMetric {
  kind: MeasurementMode;
  max: number;
  /** Log-scale denominator: Math.log1p(max). */
  denominator: number;
}

/** Supported range durations in days (used across view and entry point). */
export const RANGE_DAYS = [7, 30, 90] as const;

export type RangeDays = (typeof RANGE_DAYS)[number];

export type ProgressPhase = 'scan' | 'parse' | 'finalise';

export interface ProgressState {
  phase: ProgressPhase;
  foundFiles: number;
  parsedFiles: number;
  totalFiles: number;
  currentFile?: string;
}
