import { execFile } from 'node:child_process';

const DEFAULT_SOUND = '/System/Library/Sounds/Glass.aiff';
const DEFAULT_VOLUME = 3;

/**
 * Play a macOS system sound via afplay.
 * Non-blocking — errors are silently ignored (e.g. on non-macOS systems).
 */
export const playNotificationSound = (
  sound = DEFAULT_SOUND,
  volume = DEFAULT_VOLUME,
): void => {
  execFile('afplay', ['-v', String(volume), sound], () => {});
};
