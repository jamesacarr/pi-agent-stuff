import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';

import type { SkillIndexEntry, SkillLoadedEntryData } from './skills.ts';
import {
  buildSkillIndex,
  getLoadedSkillsFromSession,
  matchSkillForPath,
  SKILL_LOADED_ENTRY,
} from './skills.ts';
import { normalizeReadPath } from './utils.ts';

export type AppendEntry = <T>(customType: string, data: T) => void;

export type SkillTrackerDeps = {
  appendEntry: AppendEntry;
  getCommands: ExtensionAPI['getCommands'];
};

/**
 * Tracks which skills have been loaded in the current session,
 * either via `/skill:name` commands or `read` tool calls.
 */
export class SkillTracker {
  private lastSessionId: string | null = null;
  private loadedSkills = new Set<string>();
  private skillIndex: SkillIndexEntry[] = [];
  private readonly deps: SkillTrackerDeps;

  constructor(deps: SkillTrackerDeps) {
    this.deps = deps;
  }

  /** Ensure caches are fresh for the current session. */
  ensureCaches(ctx: ExtensionContext): void {
    const sessionId = ctx.sessionManager.getSessionId();

    if (sessionId !== this.lastSessionId) {
      this.lastSessionId = sessionId;
      this.loadedSkills = getLoadedSkillsFromSession(ctx);
      this.skillIndex = buildSkillIndex(
        { getCommands: this.deps.getCommands } as ExtensionAPI,
        ctx.cwd,
      );
      return;
    }

    if (this.skillIndex.length === 0) {
      this.skillIndex = buildSkillIndex(
        { getCommands: this.deps.getCommands } as ExtensionAPI,
        ctx.cwd,
      );
    }
  }

  /** Record a skill as loaded, persisting to session if new. */
  recordLoaded(skillName: string, skillPath: string): boolean {
    if (this.loadedSkills.has(skillName)) {
      return false;
    }

    this.loadedSkills.add(skillName);
    this.deps.appendEntry<SkillLoadedEntryData>(SKILL_LOADED_ENTRY, {
      name: skillName,
      path: skillPath,
    });
    return true;
  }

  /** Handle a `/skill:name` input command. */
  handleSkillCommand(skillName: string, ctx: ExtensionContext): void {
    this.ensureCaches(ctx);
    const indexed = this.skillIndex.find(s => s.name === skillName);
    this.recordLoaded(skillName, indexed?.skillFilePath ?? '');
  }

  /** Handle a `read` tool result — check if the path belongs to a skill. */
  handleReadResult(readPath: string, ctx: ExtensionContext): void {
    const absPath = normalizeReadPath(readPath, ctx.cwd);
    this.ensureCaches(ctx);
    const skillName = matchSkillForPath(absPath, this.skillIndex);

    if (skillName) {
      this.recordLoaded(skillName, absPath);
    }
  }

  /** Get the current set of loaded skill names (for testing). */
  getLoadedSkills(): ReadonlySet<string> {
    return this.loadedSkills;
  }

  /** Get the current skill index (for testing). */
  getSkillIndex(): readonly SkillIndexEntry[] {
    return this.skillIndex;
  }
}
