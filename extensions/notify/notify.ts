/**
 * Sound Notification Extension
 *
 * Plays a macOS system sound when the agent finishes and is waiting for input.
 * Uses afplay — no external dependencies.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { playNotificationSound } from './notification.ts';

export default (pi: ExtensionAPI) => {
  pi.on('agent_end', () => {
    playNotificationSound();
  });
};
