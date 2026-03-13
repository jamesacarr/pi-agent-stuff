import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  estimateTokens,
  expandTilde,
  formatUsd,
  getAncestorDirs,
  normalizeReadPath,
  shortenPath,
} from './utils.ts';

describe('formatUsd', () => {
  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats negative as zero', () => {
    expect(formatUsd(-5)).toBe('$0.00');
  });

  it('formats NaN as zero', () => {
    expect(formatUsd(Number.NaN)).toBe('$0.00');
  });

  it('formats >= $1 to 2 decimal places', () => {
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(12.345)).toBe('$12.35');
  });

  it('formats >= $0.10 to 3 decimal places', () => {
    expect(formatUsd(0.123)).toBe('$0.123');
    expect(formatUsd(0.1)).toBe('$0.100');
  });

  it('formats < $0.10 to 4 decimal places', () => {
    expect(formatUsd(0.0123)).toBe('$0.0123');
    expect(formatUsd(0.001)).toBe('$0.0010');
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns roughly chars/4', () => {
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('rounds up', () => {
    expect(estimateTokens('abc')).toBe(1);
  });
});

describe('expandTilde', () => {
  const home = os.homedir();

  it('expands bare ~', () => {
    expect(expandTilde('~')).toBe(home);
  });

  it('expands ~/path', () => {
    expect(expandTilde('~/foo/bar')).toBe(path.join(home, 'foo/bar'));
  });

  it('leaves absolute paths alone', () => {
    expect(expandTilde('/usr/bin')).toBe('/usr/bin');
  });

  it('leaves relative paths alone', () => {
    expect(expandTilde('foo/bar')).toBe('foo/bar');
  });
});

describe('normalizeReadPath', () => {
  const cwd = '/projects/my-app';

  it('resolves relative paths against cwd', () => {
    expect(normalizeReadPath('src/index.ts', cwd)).toBe(
      '/projects/my-app/src/index.ts',
    );
  });

  it('strips leading @ prefix', () => {
    expect(normalizeReadPath('@src/index.ts', cwd)).toBe(
      '/projects/my-app/src/index.ts',
    );
  });

  it('expands tilde', () => {
    const result = normalizeReadPath('~/foo.ts', cwd);
    expect(result).toBe(path.join(os.homedir(), 'foo.ts'));
  });

  it('leaves absolute paths as-is', () => {
    expect(normalizeReadPath('/etc/hosts', cwd)).toBe('/etc/hosts');
  });
});

describe('shortenPath', () => {
  const cwd = '/projects/my-app';

  it('returns . for cwd itself', () => {
    expect(shortenPath('/projects/my-app', cwd)).toBe('.');
  });

  it('returns ./ prefix for paths within cwd', () => {
    expect(shortenPath('/projects/my-app/src/index.ts', cwd)).toBe(
      './src/index.ts',
    );
  });

  it('returns absolute path for paths outside cwd', () => {
    expect(shortenPath('/etc/hosts', cwd)).toBe('/etc/hosts');
  });
});

describe('getAncestorDirs', () => {
  it('returns ancestors from root to cwd', () => {
    const dirs = getAncestorDirs('/a/b/c');
    expect(dirs[0]).toBe('/');
    expect(dirs).toContain('/a');
    expect(dirs).toContain('/a/b');
    expect(dirs[dirs.length - 1]).toBe('/a/b/c');
  });

  it('returns just root for /', () => {
    expect(getAncestorDirs('/')).toEqual(['/']);
  });
});
