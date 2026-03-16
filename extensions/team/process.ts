import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { AgentToolResult } from '@mariozechner/pi-agent-core';
import type { Message } from '@mariozechner/pi-ai';

import {
  accumulateUsage,
  attachLineReader,
  emptyProcessUsage,
  processJsonLine,
  wireAbortSignal,
} from '../shared/pi-process.ts';
import { addUsage, getFinalOutput } from './format.ts';
import type { SendResult, TeamMember, TeamSendDetails } from './types.ts';

// ---------------------------------------------------------------------------
// Session directory
// ---------------------------------------------------------------------------

export const cleanSessionDir = (dir: string): void => {
  try {
    fs.rmSync(dir, { force: true, recursive: true });
  } catch {
    /* best-effort cleanup */
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

// ---------------------------------------------------------------------------
// Process spawning
// ---------------------------------------------------------------------------

export type OnUpdate = (partial: AgentToolResult<TeamSendDetails>) => void;

const buildArgs = (member: TeamMember): string[] => {
  const agent = member.agent;
  const args: string[] = [
    '--mode',
    'json',
    '-p',
    '--session',
    member.sessionFile,
    '--no-extensions',
  ];

  if (agent.model) {
    args.push('--model', agent.model);
  }
  if (agent.tools && agent.tools.length > 0) {
    args.push('--tools', agent.tools.join(','));
  }
  return args;
};

export const runAgent = (
  cwd: string,
  member: TeamMember,
  message: string,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdate | undefined,
  sessionDir: string,
): Promise<SendResult> => {
  const agent = member.agent;
  const args = buildArgs(member);

  if (agent.systemPrompt.trim()) {
    const promptFile = writeSystemPrompt(
      sessionDir,
      member.name,
      agent.systemPrompt,
    );
    args.push('--append-system-prompt', promptFile);
  }

  args.push(message);

  const result: SendResult = {
    elapsed: 0,
    exitCode: 0,
    messages: [],
    stderr: '',
    usage: emptyProcessUsage(),
  };

  const emitUpdate = () => {
    if (!onUpdate) {
      return;
    }
    onUpdate({
      content: [
        {
          text: getFinalOutput(result.messages) || '(running...)',
          type: 'text',
        },
      ],
      details: {
        agentName: agent.name,
        memberName: member.name,
        result,
        totalUsage: addUsage(member.usage, result.usage),
      },
    });
  };

  return new Promise<SendResult>(resolve => {
    const startTime = Date.now();

    const proc = spawn('pi', args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    member.proc = proc;
    const { wasAborted } = wireAbortSignal(proc, signal);

    const { flush } = attachLineReader(
      proc,
      line => {
        processJsonLine(line, {
          onMessage: (msg: Message) => {
            result.messages.push(msg);
            accumulateUsage(result.usage, msg);

            if (msg.role === 'assistant') {
              if (!result.model && msg.model) {
                result.model = msg.model;
              }
              if (msg.stopReason) {
                result.stopReason = msg.stopReason as string;
              }
              if (msg.errorMessage) {
                result.errorMessage = msg.errorMessage as string;
              }
            }
            emitUpdate();
          },
          onStderr: () => {},
        });
      },
      chunk => {
        result.stderr += chunk;
      },
    );

    proc.on('close', code => {
      flush();
      result.exitCode = code ?? 0;
      result.elapsed = Date.now() - startTime;
      member.proc = undefined;

      if (wasAborted()) {
        result.exitCode = 1;
        result.stopReason = 'aborted';
      }
      resolve(result);
    });

    proc.on('error', err => {
      result.exitCode = 1;
      result.stderr += err.message;
      member.proc = undefined;
      resolve(result);
    });
  });
};
