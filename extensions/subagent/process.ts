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
import type { AgentConfig } from './agents.ts';
import { getFinalOutput } from './format.ts';
import type { SingleResult, SubagentDetails } from './types.ts';

// ---------------------------------------------------------------------------
// Temp file helpers
// ---------------------------------------------------------------------------

export const writePromptToTempFile = (
  agentName: string,
  prompt: string,
): { dir: string; filePath: string } => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-subagent-'));
  const safeName = agentName.replace(/[^\w.-]+/g, '_');
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  fs.writeFileSync(filePath, prompt, { encoding: 'utf-8', mode: 0o600 });
  return { dir: tmpDir, filePath };
};

// ---------------------------------------------------------------------------
// Process spawning
// ---------------------------------------------------------------------------

export type OnUpdateCallback = (
  partial: AgentToolResult<SubagentDetails>,
) => void;

const buildArgs = (agent: AgentConfig): string[] => {
  const args: string[] = ['--mode', 'json', '-p', '--no-session'];
  if (agent.model) {
    args.push('--model', agent.model);
  }
  if (agent.tools && agent.tools.length > 0) {
    args.push('--tools', agent.tools.join(','));
  }
  return args;
};

const emptyResult = (
  agentName: string,
  agentSource: 'project' | 'unknown' | 'user',
  task: string,
  step: number | undefined,
  model?: string,
): SingleResult => ({
  agent: agentName,
  agentSource,
  exitCode: 0,
  messages: [],
  model,
  stderr: '',
  step,
  task,
  usage: emptyProcessUsage(),
});

export const runSingleAgent = async (
  defaultCwd: string,
  agents: AgentConfig[],
  agentName: string,
  task: string,
  cwd: string | undefined,
  step: number | undefined,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback | undefined,
  makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> => {
  const agent = agents.find(a => a.name === agentName);

  if (!agent) {
    const available = agents.map(a => `"${a.name}"`).join(', ') || 'none';
    return {
      ...emptyResult(agentName, 'unknown', task, step),
      exitCode: 1,
      stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
    };
  }

  const args = buildArgs(agent);
  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;

  const currentResult = emptyResult(
    agentName,
    agent.source,
    task,
    step,
    agent.model,
  );

  const emitUpdate = () => {
    if (onUpdate) {
      onUpdate({
        content: [
          {
            text: getFinalOutput(currentResult.messages) || '(running...)',
            type: 'text',
          },
        ],
        details: makeDetails([currentResult]),
      });
    }
  };

  try {
    if (agent.systemPrompt.trim()) {
      const tmp = writePromptToTempFile(agent.name, agent.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push('--append-system-prompt', tmpPromptPath);
    }

    args.push(`Task: ${task}`);

    const exitCode = await new Promise<number>(resolve => {
      const proc = spawn('pi', args, {
        cwd: cwd ?? defaultCwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const { wasAborted } = wireAbortSignal(proc, signal);

      const { flush } = attachLineReader(
        proc,
        line => {
          processJsonLine(line, {
            onMessage: (msg: Message) => {
              currentResult.messages.push(msg);
              accumulateUsage(currentResult.usage, msg);

              if (msg.role === 'assistant') {
                if (!currentResult.model && msg.model) {
                  currentResult.model = msg.model;
                }
                if (msg.stopReason) {
                  currentResult.stopReason = msg.stopReason;
                }
                if (msg.errorMessage) {
                  currentResult.errorMessage = msg.errorMessage;
                }
              }
              emitUpdate();
            },
            onStderr: () => {},
          });
        },
        chunk => {
          currentResult.stderr += chunk;
        },
      );

      proc.on('close', code => {
        flush();
        currentResult.exitCode = code ?? 0;
        if (wasAborted()) {
          currentResult.exitCode = 1;
          currentResult.stopReason = 'aborted';
        }
        resolve(currentResult.exitCode);
      });

      proc.on('error', () => {
        resolve(1);
      });
    });

    currentResult.exitCode = exitCode;
    if (currentResult.stopReason === 'aborted') {
      throw new Error('Subagent was aborted');
    }
    return currentResult;
  } finally {
    if (tmpPromptPath) {
      try {
        fs.unlinkSync(tmpPromptPath);
      } catch {
        /* ignore */
      }
    }
    if (tmpPromptDir) {
      try {
        fs.rmdirSync(tmpPromptDir);
      } catch {
        /* ignore */
      }
    }
  }
};
