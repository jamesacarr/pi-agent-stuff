import path from 'node:path';

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';

import { normalizeReadPath } from './utils.ts';

export type SkillIndexEntry = {
  name: string;
  skillFilePath: string;
  skillDir: string;
};

export type SkillLoadedEntryData = {
  name: string;
  path: string;
};

export const SKILL_LOADED_ENTRY = 'context:skill_loaded';

const stripSkillPrefix = (name: string): string =>
  name.startsWith('skill:') ? name.slice('skill:'.length) : name;

export const buildSkillIndex = (
  pi: ExtensionAPI,
  cwd: string,
): SkillIndexEntry[] =>
  pi
    .getCommands()
    .filter(cmd => cmd.sourceInfo.source === 'skill')
    .map(cmd => {
      const resolved = cmd.sourceInfo.path
        ? normalizeReadPath(cmd.sourceInfo.path, cwd)
        : '';
      return {
        name: stripSkillPrefix(cmd.name),
        skillDir: resolved ? path.dirname(resolved) : '',
        skillFilePath: resolved,
      };
    })
    .filter(entry => entry.name && entry.skillDir)
    .sort((a, b) => a.name.localeCompare(b.name));

export const getSkillNames = (pi: ExtensionAPI, cwd: string): string[] =>
  buildSkillIndex(pi, cwd).map(skill => skill.name);

export const getLoadedSkillsFromSession = (
  ctx: ExtensionContext,
): Set<string> => {
  const loaded = new Set<string>();

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== 'custom') {
      continue;
    }

    if (entry.customType !== SKILL_LOADED_ENTRY) {
      continue;
    }

    const data = entry.data as SkillLoadedEntryData | undefined;
    if (data?.name) {
      loaded.add(data.name);
    }
  }

  return loaded;
};

/** Find the skill whose directory is the longest (most specific) prefix match for the given path. */
export const matchSkillForPath = (
  absPath: string,
  skillIndex: SkillIndexEntry[],
): string | null => {
  let longestMatch: SkillIndexEntry | null = null;

  for (const skill of skillIndex) {
    if (!skill.skillDir) {
      continue;
    }

    const isMatch =
      absPath === skill.skillFilePath ||
      absPath.startsWith(`${skill.skillDir}${path.sep}`);

    if (
      isMatch &&
      (!longestMatch || skill.skillDir.length > longestMatch.skillDir.length)
    ) {
      longestMatch = skill;
    }
  }

  return longestMatch?.name ?? null;
};
