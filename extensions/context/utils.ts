import os from 'node:os';
import path from 'node:path';

export const formatUsd = (cost: number): string => {
  if (!Number.isFinite(cost) || cost <= 0) {
    return '$0.00';
  }

  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }

  if (cost >= 0.1) {
    return `$${cost.toFixed(3)}`;
  }

  return `$${cost.toFixed(4)}`;
};

/** Rough char/4 token estimate — deliberately fuzzy, good enough for "how big-ish is this". */
export const estimateTokens = (text: string): number =>
  Math.max(0, Math.ceil(text.length / 4));

export const expandTilde = (pathStr: string): string => {
  if (pathStr === '~') {
    return os.homedir();
  }

  if (pathStr.startsWith('~/')) {
    return path.join(os.homedir(), pathStr.slice(2));
  }

  return pathStr;
};

/** Normalise a path the way pi's read tool would — strips leading @, expands ~, resolves relative to cwd. */
export const normalizeReadPath = (inputPath: string, cwd: string): string => {
  const stripped = inputPath.startsWith('@') ? inputPath.slice(1) : inputPath;
  const expanded = expandTilde(stripped);

  return path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : path.resolve(cwd, expanded);
};

export const shortenPath = (pathStr: string, cwd: string): string => {
  const resolvedPath = path.resolve(pathStr);
  const resolvedCwd = path.resolve(cwd);
  if (resolvedPath === resolvedCwd) {
    return '.';
  }
  if (resolvedPath.startsWith(`${resolvedCwd}${path.sep}`)) {
    return `./${resolvedPath.slice(resolvedCwd.length + 1)}`;
  }

  return resolvedPath;
};

/** Walk from filesystem root down to cwd, returning each ancestor directory in order. */
export const getAncestorDirs = (cwd: string): string[] => {
  const dirs: string[] = [];
  let current = path.resolve(cwd);

  while (true) {
    dirs.push(current);
    const parent = path.resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  dirs.reverse();
  return dirs;
};
