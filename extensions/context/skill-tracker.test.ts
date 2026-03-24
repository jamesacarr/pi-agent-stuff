import type { ExtensionContext } from '@mariozechner/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { SkillTracker } from './skill-tracker.ts';
import { SKILL_LOADED_ENTRY } from './skills.ts';

// Helpers ----------------------------------------------------------------

const skillCommands = (skills: Array<{ name: string; path: string }>) =>
  skills.map(s => ({
    name: `skill:${s.name}`,
    source: 'skill' as const,
    sourceInfo: {
      origin: 'top-level' as const,
      path: s.path,
      scope: 'project' as const,
      source: 'skill' as const,
    },
  }));

const stubCtx = (
  sessionId: string,
  entries: Array<{ type: string; customType?: string; data?: unknown }> = [],
  cwd = '/projects/app',
): ExtensionContext =>
  ({
    cwd,
    sessionManager: {
      getEntries: () => entries,
      getSessionId: () => sessionId,
    },
  }) as unknown as ExtensionContext;

type AppendedEntry = { customType: string; data: unknown };

const createTracker = (skills: Array<{ name: string; path: string }> = []) => {
  const appended: AppendedEntry[] = [];
  const commands = skillCommands(skills);

  const tracker = new SkillTracker({
    appendEntry: (customType, data) => appended.push({ customType, data }),
    getCommands: () => commands,
  });

  return { appended, tracker };
};

// Tests ------------------------------------------------------------------

describe('SkillTracker', () => {
  describe('ensureCaches', () => {
    it('populates skill index on first call', () => {
      const { tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.ensureCaches(stubCtx('session-1'));
      expect(tracker.getSkillIndex()).toHaveLength(1);
      expect(tracker.getSkillIndex()[0].name).toBe('glab');
    });

    it('resets caches on session change', () => {
      const { tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      const ctx1 = stubCtx('session-1');
      tracker.ensureCaches(ctx1);
      tracker.recordLoaded('glab', '/skills/glab/SKILL.md');
      expect(tracker.getLoadedSkills().has('glab')).toBe(true);

      const ctx2 = stubCtx('session-2');
      tracker.ensureCaches(ctx2);
      expect(tracker.getLoadedSkills().has('glab')).toBe(false);
    });

    it('restores loaded skills from session entries on reset', () => {
      const { tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      const ctx = stubCtx('session-1', [
        {
          customType: SKILL_LOADED_ENTRY,
          data: { name: 'glab', path: '/skills/glab/SKILL.md' },
          type: 'custom',
        },
      ]);

      tracker.ensureCaches(ctx);
      expect(tracker.getLoadedSkills().has('glab')).toBe(true);
    });
  });

  describe('recordLoaded', () => {
    it('appends entry for new skill', () => {
      const { appended, tracker } = createTracker();
      tracker.ensureCaches(stubCtx('s1'));

      const recorded = tracker.recordLoaded('glab', '/skills/glab/SKILL.md');
      expect(recorded).toBe(true);
      expect(appended).toHaveLength(1);
      expect(appended[0].customType).toBe(SKILL_LOADED_ENTRY);
      expect(appended[0].data).toEqual({
        name: 'glab',
        path: '/skills/glab/SKILL.md',
      });
    });

    it('skips duplicate', () => {
      const { appended, tracker } = createTracker();
      tracker.ensureCaches(stubCtx('s1'));

      tracker.recordLoaded('glab', '/skills/glab/SKILL.md');
      const second = tracker.recordLoaded('glab', '/skills/glab/SKILL.md');
      expect(second).toBe(false);
      expect(appended).toHaveLength(1);
    });
  });

  describe('handleSkillCommand', () => {
    it('records skill with path from index', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.handleSkillCommand('glab', stubCtx('s1'));
      expect(appended).toHaveLength(1);
      expect(appended[0].data).toEqual({
        name: 'glab',
        path: '/skills/glab/SKILL.md',
      });
    });

    it('records skill with empty path when not in index', () => {
      const { appended, tracker } = createTracker([]);

      tracker.handleSkillCommand('unknown', stubCtx('s1'));
      expect(appended).toHaveLength(1);
      expect(appended[0].data).toEqual({ name: 'unknown', path: '' });
    });

    it('does not re-record already loaded skill', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.handleSkillCommand('glab', stubCtx('s1'));
      tracker.handleSkillCommand('glab', stubCtx('s1'));
      expect(appended).toHaveLength(1);
    });
  });

  describe('handleReadResult', () => {
    it('records skill when read path matches skill directory', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.handleReadResult(
        '/skills/glab/SKILL.md',
        stubCtx('s1', [], '/projects'),
      );
      expect(appended).toHaveLength(1);
      expect(appended[0].data).toEqual({
        name: 'glab',
        path: '/skills/glab/SKILL.md',
      });
    });

    it('records skill when read path is within skill directory', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.handleReadResult(
        '/skills/glab/references/api.md',
        stubCtx('s1', [], '/projects'),
      );
      expect(appended).toHaveLength(1);
    });

    it('ignores paths not matching any skill', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/skills/glab/SKILL.md' },
      ]);

      tracker.handleReadResult(
        '/other/file.ts',
        stubCtx('s1', [], '/projects'),
      );
      expect(appended).toHaveLength(0);
    });

    it('resolves relative paths against cwd', () => {
      const { appended, tracker } = createTracker([
        { name: 'glab', path: '/projects/skills/glab/SKILL.md' },
      ]);

      tracker.handleReadResult(
        'skills/glab/SKILL.md',
        stubCtx('s1', [], '/projects'),
      );
      expect(appended).toHaveLength(1);
    });
  });
});
