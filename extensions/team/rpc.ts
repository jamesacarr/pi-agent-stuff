import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ActivityItem, TeamMember } from './types.ts';

// Session directory helpers (kept as-is from process.ts)
export const cleanSessionDir = (dir: string): void => {
  try {
    fs.rmSync(dir, { force: true, recursive: true });
  } catch {
    /* best-effort */
  }
};

export const makeSessionDir = (): string => {
  const dir = path.join(os.tmpdir(), 'pi-team-sessions', `team-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const writeSystemPrompt = (
  sessionDir: string,
  name: string,
  prompt: string,
): string => {
  const file = path.join(sessionDir, `system-prompt-${name}.md`);
  fs.writeFileSync(file, prompt, { encoding: 'utf-8', mode: 0o600 });
  return file;
};

// Activity logging
const MAX_ACTIVITY_LOG = 50;

/** Events worth showing in the one-liner status display. */
const DISPLAYABLE_TYPES = new Set<ActivityItem['type']>([
  'tool_start',
  'text_delta',
  'agent_end',
  'error',
]);

export const pushActivity = (member: TeamMember, item: ActivityItem): void => {
  member.activityLog.push(item);
  if (member.activityLog.length > MAX_ACTIVITY_LOG) {
    member.activityLog.shift();
  }
  // Only update lastActivity for events that produce useful display text
  if (DISPLAYABLE_TYPES.has(item.type)) {
    member.lastActivity = item;
  }
};

// RPC connection interface
export interface RpcConnection {
  send: (command: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onEvent: (listener: (event: Record<string, unknown>) => void) => () => void;
  detach: () => void;
}

// Per-member connections
const connections = new Map<string, RpcConnection>();

export const spawnRpcProcess = (
  cwd: string,
  member: TeamMember,
  sessionDir: string,
) => {
  const agent = member.agent;
  const args: string[] = [
    '--mode',
    'rpc',
    '--team-member',
    '--session',
    member.sessionFile,
  ];

  if (agent.model) {
    args.push('--model', agent.model);
  }
  if (agent.tools?.length) {
    args.push('--tools', agent.tools.join(','));
  }
  if (agent.systemPrompt.trim()) {
    const promptFile = writeSystemPrompt(
      sessionDir,
      member.name,
      agent.systemPrompt,
    );
    args.push('--append-system-prompt', promptFile);
  }

  const proc = spawn('pi', args, {
    cwd,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  member.rpcProcess = proc;
  return proc;
};

export const setupRpcConnection = (member: TeamMember): RpcConnection => {
  const proc = member.rpcProcess;
  if (!proc || !proc.stdout || !proc.stdin) {
    throw new Error(`RPC process not running for team member ${member.name}`);
  }

  // Pending requests waiting for responses
  const pendingRequests = new Map<
    string,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  // Event listeners for non-response events
  const eventListeners: Array<(event: Record<string, unknown>) => void> = [];

  // Drain stderr to prevent buffer deadlock.  We don't need the output.
  proc.stderr?.on('data', () => {});

  // JSONL reader with buffering (don't use readline - it splits on Unicode separators)
  let buffer = '';
  const onStdoutData = (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    // Keep the last partial line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const json = JSON.parse(line) as Record<string, unknown>;

        // Check if it's a response with an id
        if (json.type === 'response' && typeof json.id === 'string') {
          const pending = pendingRequests.get(json.id);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingRequests.delete(json.id);
            pending.resolve(json);
          }
        } else {
          // It's an event, notify all listeners
          for (const listener of eventListeners) {
            try {
              listener(json);
            } catch (_err) {}
          }
        }
      } catch (_err) {}
    }
  };
  proc.stdout.on('data', onStdoutData);

  const send = (
    command: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    if (!proc.stdin || proc.killed) {
      return Promise.reject(
        new Error(`RPC process not running for team member ${member.name}`),
      );
    }

    const id = `req_${++member.rpcRequestId}`;
    const fullCommand = { ...command, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`RPC request ${id} timed out after 30 seconds`));
      }, 30000);

      pendingRequests.set(id, { reject, resolve, timeout });

      try {
        proc.stdin?.write(`${JSON.stringify(fullCommand)}\n`);
      } catch (err) {
        clearTimeout(timeout);
        pendingRequests.delete(id);
        reject(err);
      }
    });
  };

  const onEvent = (
    listener: (event: Record<string, unknown>) => void,
  ): (() => void) => {
    eventListeners.push(listener);
    return () => {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    };
  };

  const detach = (): void => {
    // Remove stdout listener to stop processing
    proc.stdout?.off('data', onStdoutData);

    // Reject all pending requests
    for (const [, pending] of pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('RPC connection detached'));
    }
    pendingRequests.clear();
    eventListeners.length = 0;
    connections.delete(member.name);
  };

  const connection: RpcConnection = { detach, onEvent, send };
  connections.set(member.name, connection);
  return connection;
};

export const getRpcConnection = (
  member: TeamMember,
): RpcConnection | undefined => {
  return connections.get(member.name);
};

export const removeRpcConnection = (member: TeamMember): void => {
  const connection = connections.get(member.name);
  if (connection) {
    connection.detach();
  }
};

export const killRpcProcess = (member: TeamMember): void => {
  const proc = member.rpcProcess;
  if (!proc) {
    return;
  }

  // Remove connection first to reject pending requests
  removeRpcConnection(member);

  // Try graceful shutdown
  proc.kill('SIGTERM');

  // Force kill after 5 seconds if still alive
  const killTimeout = setTimeout(() => {
    if (!proc.killed) {
      proc.kill('SIGKILL');
    }
  }, 5000);

  proc.once('exit', () => {
    clearTimeout(killTimeout);
  });

  member.rpcProcess = undefined;
};
