import { execFile } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { playNotificationSound } from './notification.ts';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);

describe('playNotificationSound', () => {
  it('calls afplay with default sound and volume', () => {
    playNotificationSound();

    expect(mockedExecFile).toHaveBeenCalledWith(
      'afplay',
      ['-v', '3', '/System/Library/Sounds/Glass.aiff'],
      expect.any(Function),
    );
  });

  it('calls afplay with custom sound and volume', () => {
    playNotificationSound('/System/Library/Sounds/Ping.aiff', 5);

    expect(mockedExecFile).toHaveBeenCalledWith(
      'afplay',
      ['-v', '5', '/System/Library/Sounds/Ping.aiff'],
      expect.any(Function),
    );
  });
});
