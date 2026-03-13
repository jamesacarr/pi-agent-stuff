import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { estimateTokens, expandTilde, getAncestorDirs } from './utils.ts';

const KNOWN_AGENT_DIR_ENV_VARS = [
  'PI_CODING_AGENT_DIR',
  'TAU_CODING_AGENT_DIR',
];

export const getAgentDir = (): string => {
  for (const key of KNOWN_AGENT_DIR_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      return expandTilde(value);
    }
  }

  return path.join(os.homedir(), '.pi', 'agent');
};

export type FileResult = {
  path: string;
  content: string;
  bytes: number;
} | null;

export type FileReader = (filePath: string) => Promise<FileResult>;

const defaultReadFile: FileReader = async (filePath: string) => {
  try {
    const buf = await fs.readFile(filePath);
    return {
      bytes: buf.byteLength,
      content: buf.toString('utf8'),
      path: filePath,
    };
  } catch {
    return null;
  }
};

export type ContextFile = { path: string; tokens: number; bytes: number };

export const loadProjectContextFiles = async (
  cwd: string,
  readFile: FileReader = defaultReadFile,
): Promise<ContextFile[]> => {
  const files: ContextFile[] = [];
  const seenPaths = new Set<string>();

  const loadFromDir = async (dir: string) => {
    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const filePath = path.join(dir, name);
      const file = await readFile(filePath);
      if (!file || seenPaths.has(file.path)) {
        continue;
      }

      seenPaths.add(file.path);
      files.push({
        bytes: file.bytes,
        path: file.path,
        tokens: estimateTokens(file.content),
      });
      // pi loads at most one of those per dir
      return;
    }
  };

  await loadFromDir(getAgentDir());

  for (const dir of getAncestorDirs(cwd)) {
    await loadFromDir(dir);
  }

  return files;
};
