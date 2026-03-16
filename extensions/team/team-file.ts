/**
 * Team file management for orphan cleanup.
 *
 * Each orchestrator writes a team file listing its PID (leader) and all child
 * PIDs.  On session_start, any team file whose leader is dead gets its children
 * killed and the file removed.
 *
 * File location: ~/.pi/agent/teams/{pid}.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { getAgentDir } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const teamsDir = (): string => path.join(getAgentDir(), 'teams');

const teamFilePath = (): string => path.join(teamsDir(), `${process.pid}.json`);

// ---------------------------------------------------------------------------
// File shape
// ---------------------------------------------------------------------------

interface TeamFile {
  leader: number;
  children: number[];
}

// ---------------------------------------------------------------------------
// Write / update
// ---------------------------------------------------------------------------

const ensureDir = (): void => {
  const dir = teamsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeFile = (data: TeamFile): void => {
  ensureDir();
  fs.writeFileSync(teamFilePath(), JSON.stringify(data, null, 2), 'utf-8');
};

const readFile = (): TeamFile | undefined => {
  try {
    const raw = fs.readFileSync(teamFilePath(), 'utf-8');
    return JSON.parse(raw) as TeamFile;
  } catch {
    return undefined;
  }
};

/** Add a child PID.  Creates the file if it doesn't exist. */
export const addChild = (childPid: number): void => {
  const existing = readFile() ?? { children: [], leader: process.pid };
  if (!existing.children.includes(childPid)) {
    existing.children.push(childPid);
  }
  writeFile(existing);
};

/** Remove a child PID. */
export const removeChild = (childPid: number): void => {
  const existing = readFile();
  if (!existing) {
    return;
  }
  existing.children = existing.children.filter(p => p !== childPid);
  if (existing.children.length === 0) {
    removeTeamFile();
  } else {
    writeFile(existing);
  }
};

/** Delete this orchestrator's team file. */
export const removeTeamFile = (): void => {
  try {
    fs.unlinkSync(teamFilePath());
  } catch {
    /* best-effort */
  }
};

// ---------------------------------------------------------------------------
// Orphan cleanup (called on session_start)
// ---------------------------------------------------------------------------

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Scan all team files.  For any whose leader PID is dead, kill all children
 * and remove the file.
 */
export const cleanupOrphans = (): void => {
  const dir = teamsDir();
  if (!fs.existsSync(dir)) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(dir, entry.name);
    let data: TeamFile;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TeamFile;
    } catch {
      continue;
    }

    // Skip our own file
    if (data.leader === process.pid) {
      continue;
    }

    // If the leader is still alive, leave it alone
    if (isProcessAlive(data.leader)) {
      continue;
    }

    // Leader is dead — kill orphaned children
    for (const childPid of data.children) {
      try {
        process.kill(childPid, 'SIGTERM');
      } catch {
        /* already dead */
      }
    }

    // Remove the stale team file
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* best-effort */
    }
  }
};
