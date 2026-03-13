import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { FileReader } from './discovery.ts';
import { getAgentDir, loadProjectContextFiles } from './discovery.ts';

// Helpers ----------------------------------------------------------------

const fakeReader =
  (files: Record<string, string>): FileReader =>
  (filePath: string) => {
    const content = files[filePath];
    if (content === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      bytes: Buffer.byteLength(content),
      content,
      path: filePath,
    });
  };

// Tests ------------------------------------------------------------------

describe('getAgentDir', () => {
  it('returns ~/.pi/agent by default', () => {
    const original = { ...process.env };
    delete process.env.PI_CODING_AGENT_DIR;
    delete process.env.TAU_CODING_AGENT_DIR;

    expect(getAgentDir()).toBe(path.join(os.homedir(), '.pi', 'agent'));

    Object.assign(process.env, original);
  });

  it('reads PI_CODING_AGENT_DIR env var', () => {
    const original = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = '/custom/agent';

    expect(getAgentDir()).toBe('/custom/agent');

    if (original === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = original;
    }
  });
});

describe('loadProjectContextFiles', () => {
  it('loads AGENTS.md from ancestor directories', async () => {
    const reader = fakeReader({
      '/a/b/c/AGENTS.md': '# Project agents',
    });

    const files = await loadProjectContextFiles('/a/b/c', reader);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/a/b/c/AGENTS.md');
  });

  it('prefers AGENTS.md over CLAUDE.md in same directory', async () => {
    const reader = fakeReader({
      '/a/AGENTS.md': '# Agents',
      '/a/CLAUDE.md': '# Claude',
    });

    const files = await loadProjectContextFiles('/a', reader);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/a/AGENTS.md');
    expect(paths).not.toContain('/a/CLAUDE.md');
  });

  it('falls back to CLAUDE.md when AGENTS.md is absent', async () => {
    const reader = fakeReader({
      '/a/CLAUDE.md': '# Claude',
    });

    const files = await loadProjectContextFiles('/a', reader);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/a/CLAUDE.md');
  });

  it('loads from multiple ancestor directories', async () => {
    const reader = fakeReader({
      '/a/AGENTS.md': '# Root agents',
      '/a/b/AGENTS.md': '# Sub agents',
    });

    const files = await loadProjectContextFiles('/a/b', reader);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/a/AGENTS.md');
    expect(paths).toContain('/a/b/AGENTS.md');
  });

  it('deduplicates files by path', async () => {
    // Same path returned twice shouldn't produce duplicates
    const reader = fakeReader({
      '/a/AGENTS.md': '# Agents',
    });

    const files = await loadProjectContextFiles('/a', reader);
    const count = files.filter(f => f.path === '/a/AGENTS.md').length;
    expect(count).toBe(1);
  });

  it('returns empty array when no context files exist', async () => {
    const reader = fakeReader({});
    const files = await loadProjectContextFiles('/a/b/c', reader);

    // May include agent dir files; filter to just the cwd ancestors
    const cwdFiles = files.filter(f => f.path.startsWith('/a'));
    expect(cwdFiles).toHaveLength(0);
  });

  it('estimates tokens for each file', async () => {
    const content = 'a'.repeat(100);
    const reader = fakeReader({
      '/a/AGENTS.md': content,
    });

    const files = await loadProjectContextFiles('/a', reader);
    const file = files.find(f => f.path === '/a/AGENTS.md');
    expect(file).toBeDefined();
    expect(file?.tokens).toBe(25); // 100 chars / 4
    expect(file?.bytes).toBe(100);
  });
});
