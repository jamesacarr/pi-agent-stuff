import type { RGB } from './types.ts';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

export const formatCount = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) {
    return '0';
  }
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString('en-US');
};

export const formatUsd = (cost: number): string => {
  if (!Number.isFinite(cost)) {
    return '$0.00';
  }
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(4)}`;
};

export const padRight = (text: string, width: number): string => {
  const delta = width - text.length;
  return delta > 0 ? `${text}${' '.repeat(delta)}` : text;
};

export const padLeft = (text: string, width: number): string => {
  const delta = width - text.length;
  return delta > 0 ? `${' '.repeat(delta)}${text}` : text;
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Dark background colour (close to GitHub dark theme). */
export const DEFAULT_BG: RGB = { b: 23, g: 17, r: 13 };

/** Empty cell colour (slightly lighter background). */
export const EMPTY_CELL: RGB = { b: 34, g: 27, r: 22 };

/** Default model palette (assigned to top models by popularity). */
export const MODEL_PALETTE: RGB[] = [
  { b: 99, g: 196, r: 64 }, // green
  { b: 247, g: 129, r: 47 }, // blue
  { b: 247, g: 113, r: 163 }, // purple
  { b: 10, g: 159, r: 255 }, // orange
  { b: 54, g: 67, r: 244 }, // red
];

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({
  b: Math.round(lerp(a.b, b.b, t)),
  g: Math.round(lerp(a.g, b.g, t)),
  r: Math.round(lerp(a.r, b.r, t)),
});

export const weightedMixRgb = (
  colours: Array<{ color: RGB; weight: number }>,
): RGB => {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const entry of colours) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      continue;
    }
    total += entry.weight;
    r += entry.color.r * entry.weight;
    g += entry.color.g * entry.weight;
    b += entry.color.b * entry.weight;
  }

  if (total <= 0) {
    return EMPTY_CELL;
  }

  return {
    b: Math.round(b / total),
    g: Math.round(g / total),
    r: Math.round(r / total),
  };
};

export const ansiBg = (rgb: RGB, text: string): string =>
  `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;

export const ansiFg = (rgb: RGB, text: string): string =>
  `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;

export const dim = (text: string): string => `\x1b[2m${text}\x1b[0m`;

export const bold = (text: string): string => `\x1b[1m${text}\x1b[0m`;

/**
 * Pad an ANSI-containing string to a target visible width (right-padding with spaces).
 * Unlike `padRight`, this accounts for invisible escape sequences.
 */
export const padRightAnsi = (
  text: string,
  targetWidth: number,
  measureWidth: (s: string) => number,
): string => {
  const currentWidth = measureWidth(text);
  return currentWidth >= targetWidth
    ? text
    : `${text}${' '.repeat(targetWidth - currentWidth)}`;
};
