import type { ExtensionContext } from '@mariozechner/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { SkillIndexEntry } from './skills.ts';
import {
  buildSkillIndex,
  getLoadedSkillsFromSession,
  getSkillNames,
  matchSkillForPath,
  SKILL_LOADED_ENTRY,
} from './skills.ts';

// Helpers ----------------------------------------------------------------

const stubPi = (
  commands: Array<{ name: string; source: string; path?: string }>,
) => ({
  getCommands: () =>
    commands.map(cmd => ({
      name: cmd.name,
      sourceInfo: {
        origin: 'top-level' as const,
        path: cmd.path ?? '',
        scope: 'project' as const,
        source: cmd.source,
      },
    })),
});

const stubCtx = (
  entries: Array<{ type: string; customType?: string; data?: unknown }>,
): ExtensionContext =>
  ({
    sessionManager: { getEntries: () => entries },
  }) as unknown as ExtensionContext;

// Tests ------------------------------------------------------------------

describe('buildSkillIndex', () => {
  it('returns entries for skill commands with paths', () => {
    const pi = stubPi([
      { name: 'skill:glab', path: '/skills/glab/SKILL.md', source: 'skill' },
      { name: 'skill:jira', path: '/skills/jira/SKILL.md', source: 'skill' },
      { name: 'context', source: 'extension' },
    ]);

    const index = buildSkillIndex(pi as never, '/projects');
    expect(index).toHaveLength(2);
    expect(index[0].name).toBe('glab');
    expect(index[0].skillFilePath).toBe('/skills/glab/SKILL.md');
    expect(index[0].skillDir).toBe('/skills/glab');
    expect(index[1].name).toBe('jira');
  });

  it('strips skill: prefix from names', () => {
    const pi = stubPi([
      {
        name: 'skill:my-skill',
        path: '/skills/my-skill/SKILL.md',
        source: 'skill',
      },
    ]);

    const index = buildSkillIndex(pi as never, '/');
    expect(index[0].name).toBe('my-skill');
  });

  it('excludes non-skill commands', () => {
    const pi = stubPi([
      { name: 'context', source: 'extension' },
      { name: 'template:foo', source: 'prompt' },
    ]);

    expect(buildSkillIndex(pi as never, '/')).toHaveLength(0);
  });

  it('excludes skills without paths', () => {
    const pi = stubPi([{ name: 'skill:orphan', source: 'skill' }]);

    expect(buildSkillIndex(pi as never, '/')).toHaveLength(0);
  });

  it('returns sorted by name', () => {
    const pi = stubPi([
      { name: 'skill:zebra', path: '/skills/zebra/SKILL.md', source: 'skill' },
      { name: 'skill:alpha', path: '/skills/alpha/SKILL.md', source: 'skill' },
    ]);

    const index = buildSkillIndex(pi as never, '/');
    expect(index.map(s => s.name)).toEqual(['alpha', 'zebra']);
  });
});

describe('getSkillNames', () => {
  it('returns just the names', () => {
    const pi = stubPi([
      { name: 'skill:glab', path: '/skills/glab/SKILL.md', source: 'skill' },
      { name: 'skill:jira', path: '/skills/jira/SKILL.md', source: 'skill' },
    ]);

    expect(getSkillNames(pi as never, '/')).toEqual(['glab', 'jira']);
  });
});

describe('getLoadedSkillsFromSession', () => {
  it('returns names from skill_loaded entries', () => {
    const ctx = stubCtx([
      {
        customType: SKILL_LOADED_ENTRY,
        data: { name: 'glab', path: '/skills/glab/SKILL.md' },
        type: 'custom',
      },
      {
        customType: SKILL_LOADED_ENTRY,
        data: { name: 'jira', path: '/skills/jira/SKILL.md' },
        type: 'custom',
      },
      { type: 'message' },
    ]);

    const loaded = getLoadedSkillsFromSession(ctx);
    expect(loaded).toEqual(new Set(['glab', 'jira']));
  });

  it('ignores non-custom entries', () => {
    const ctx = stubCtx([{ type: 'message' }, { type: 'compaction' }]);

    expect(getLoadedSkillsFromSession(ctx).size).toBe(0);
  });

  it('ignores custom entries with different customType', () => {
    const ctx = stubCtx([
      { customType: 'other:thing', data: { name: 'nope' }, type: 'custom' },
    ]);

    expect(getLoadedSkillsFromSession(ctx).size).toBe(0);
  });

  it('ignores entries without name in data', () => {
    const ctx = stubCtx([
      { customType: SKILL_LOADED_ENTRY, data: {}, type: 'custom' },
      { customType: SKILL_LOADED_ENTRY, type: 'custom' },
    ]);

    expect(getLoadedSkillsFromSession(ctx).size).toBe(0);
  });
});

describe('matchSkillForPath', () => {
  const index: SkillIndexEntry[] = [
    {
      name: 'glab',
      skillDir: '/skills/glab',
      skillFilePath: '/skills/glab/SKILL.md',
    },
    {
      name: 'jira',
      skillDir: '/skills/jira',
      skillFilePath: '/skills/jira/SKILL.md',
    },
    {
      name: 'nested',
      skillDir: '/skills/glab/sub',
      skillFilePath: '/skills/glab/sub/SKILL.md',
    },
  ];

  it('matches exact SKILL.md path', () => {
    expect(matchSkillForPath('/skills/glab/SKILL.md', index)).toBe('glab');
  });

  it('matches files within skill directory', () => {
    expect(matchSkillForPath('/skills/jira/scripts/run.sh', index)).toBe(
      'jira',
    );
  });

  it('returns longest (most specific) match', () => {
    expect(matchSkillForPath('/skills/glab/sub/SKILL.md', index)).toBe(
      'nested',
    );
    expect(matchSkillForPath('/skills/glab/sub/helper.ts', index)).toBe(
      'nested',
    );
  });

  it('returns null for non-matching paths', () => {
    expect(matchSkillForPath('/other/path/file.ts', index)).toBeNull();
  });

  it('does not match partial directory names', () => {
    expect(matchSkillForPath('/skills/glab-extra/file.ts', index)).toBeNull();
  });

  it('returns null for empty index', () => {
    expect(matchSkillForPath('/skills/glab/SKILL.md', [])).toBeNull();
  });
});
