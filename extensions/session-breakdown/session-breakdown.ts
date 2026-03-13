import os from 'node:os';
import path from 'node:path';

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';
import { BorderedLoader } from '@mariozechner/pi-coding-agent';

import { addSessionToRange, buildRange, choosePalette } from './aggregate.ts';
import { localMidnight } from './date.ts';
import { formatCount } from './format.ts';
import { parseSessionFile, walkSessionFiles } from './parse.ts';
import { rangeSummary } from './render.ts';
import type { BreakdownData, ProgressState } from './types.ts';
import { RANGE_DAYS } from './types.ts';
import { BreakdownView } from './view.ts';

const SESSION_ROOT = path.join(os.homedir(), '.pi', 'agent', 'sessions');

const getRange = (
  ranges: Map<number, ReturnType<typeof buildRange>>,
  days: number,
): ReturnType<typeof buildRange> => {
  const range = ranges.get(days);
  if (!range) {
    throw new Error(`Range not found for ${days} days`);
  }
  return range;
};

// ---------------------------------------------------------------------------
// BorderedLoader progress hack
//
// BorderedLoader wraps a Loader which supports setMessage(), but doesn't
// expose it publicly. Access the inner loader for progress updates.
// ---------------------------------------------------------------------------

const setLoaderMessage = (loader: BorderedLoader, message: string) => {
  const inner = (loader as unknown as Record<string, unknown>).loader as
    | { setMessage?: (msg: string) => void }
    | undefined;
  if (inner?.setMessage) {
    inner.setMessage(message);
  }
};

// ---------------------------------------------------------------------------
// Data computation
// ---------------------------------------------------------------------------

export const computeBreakdown = async (
  signal?: AbortSignal,
  onProgress?: (update: Partial<ProgressState>) => void,
): Promise<BreakdownData> => {
  const now = new Date();
  const ranges = new Map<number, ReturnType<typeof buildRange>>();
  for (const days of RANGE_DAYS) {
    ranges.set(days, buildRange(days, now));
  }

  const range90 = getRange(ranges, 90);
  const startCutoff = range90.days[0].date;

  onProgress?.({
    currentFile: undefined,
    foundFiles: 0,
    parsedFiles: 0,
    phase: 'scan',
    totalFiles: 0,
  });

  const candidates = await walkSessionFiles(
    SESSION_ROOT,
    startCutoff,
    signal,
    found => onProgress?.({ foundFiles: found, phase: 'scan' }),
  );

  const totalFiles = candidates.length;
  onProgress?.({
    currentFile:
      totalFiles > 0 ? path.basename(candidates[0] ?? '') : undefined,
    foundFiles: totalFiles,
    parsedFiles: 0,
    phase: 'parse',
    totalFiles,
  });

  let parsedCount = 0;
  for (const filePath of candidates) {
    if (signal?.aborted) {
      break;
    }

    parsedCount += 1;
    onProgress?.({
      currentFile: path.basename(filePath),
      parsedFiles: parsedCount,
      phase: 'parse',
      totalFiles,
    });

    const session = await parseSessionFile(filePath, signal);
    if (!session) {
      continue;
    }

    const sessionDay = localMidnight(session.startedAt);
    for (const days of RANGE_DAYS) {
      const range = getRange(ranges, days);
      const rangeStart = range.days[0].date;
      const rangeEnd = range.days[range.days.length - 1].date;
      if (sessionDay < rangeStart || sessionDay > rangeEnd) {
        continue;
      }
      addSessionToRange(range, session);
    }
  }

  onProgress?.({ currentFile: undefined, phase: 'finalise' });

  const palette = choosePalette(getRange(ranges, 30), 4);
  return { generatedAt: now, palette, ranges };
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default (pi: ExtensionAPI) => {
  pi.registerCommand('session-breakdown', {
    description:
      'Interactive breakdown of last 7/30/90 days of session usage (sessions/messages/tokens + cost by model)',
    handler: async (_args, ctx: ExtensionContext) => {
      if (!ctx.hasUI) {
        const data = await computeBreakdown(undefined);
        const range = getRange(data.ranges, 30);
        pi.sendMessage(
          {
            content: `Session breakdown (non-interactive)\n${rangeSummary(range, 30, 'sessions')}`,
            customType: 'session-breakdown',
            display: true,
          },
          { triggerTurn: false },
        );
        return;
      }

      let aborted = false;
      const data = await ctx.ui.custom<BreakdownData | null>(
        (tui, theme, _kb, done) => {
          const baseMessage = 'Analysing sessions (last 90 days)…';
          const loader = new BorderedLoader(tui, theme, baseMessage);
          const startedAt = Date.now();

          const progress: ProgressState = {
            currentFile: undefined,
            foundFiles: 0,
            parsedFiles: 0,
            phase: 'scan',
            totalFiles: 0,
          };

          const buildMessage = (): string => {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
            if (progress.phase === 'scan') {
              return `${baseMessage}  scanning (${formatCount(progress.foundFiles)} files) · ${elapsed}s`;
            }
            if (progress.phase === 'parse') {
              return `${baseMessage}  parsing (${formatCount(progress.parsedFiles)}/${formatCount(progress.totalFiles)}) · ${elapsed}s`;
            }
            return `${baseMessage}  finalising · ${elapsed}s`;
          };

          let intervalId: NodeJS.Timeout | null = null;
          const stopTicker = () => {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          };

          setLoaderMessage(loader, buildMessage());
          intervalId = setInterval(() => {
            setLoaderMessage(loader, buildMessage());
          }, 500);

          loader.onAbort = () => {
            aborted = true;
            stopTicker();
            done(null);
          };

          computeBreakdown(loader.signal, update =>
            Object.assign(progress, update),
          )
            .then(result => {
              stopTicker();
              if (!aborted) {
                done(result);
              }
            })
            .catch(() => {
              stopTicker();
              if (!aborted) {
                done(null);
              }
            });

          return loader;
        },
      );

      if (!data) {
        ctx.ui.notify(
          aborted ? 'Cancelled' : 'Failed to analyse sessions',
          aborted ? 'info' : 'error',
        );
        return;
      }

      await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
        return new BreakdownView(data, tui, done);
      });
    },
  });
};
