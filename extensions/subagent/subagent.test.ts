import type { Message } from '@mariozechner/pi-ai';
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SingleResult } from './types.ts';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./agents.ts', () => ({
  discoverAgents: vi.fn(() => ({
    agents: [
      {
        description: 'Fast recon',
        filePath: '/agents/scout.md',
        model: 'anthropic/claude-haiku-4-5',
        name: 'scout',
        source: 'user',
        systemPrompt: 'You are a scout.',
        tools: ['read', 'grep', 'find'],
      },
      {
        description: 'General worker',
        filePath: '/agents/worker.md',
        model: 'anthropic/claude-sonnet-4-5',
        name: 'worker',
        source: 'user',
        systemPrompt: 'You are a worker.',
        tools: undefined,
      },
      {
        description: 'Project-local agent',
        filePath: '.pi/agents/local.md',
        model: 'anthropic/claude-haiku-4-5',
        name: 'local',
        source: 'project',
        systemPrompt: 'You are a local agent.',
        tools: ['read'],
      },
    ],
    projectAgentsDir: '.pi/agents',
  })),
}));

vi.mock('./process.ts', () => ({
  runSingleAgent: vi.fn(),
}));

vi.mock('./render.ts', () => ({
  renderCall: vi.fn(),
  renderResult: vi.fn(),
}));

import { runSingleAgent } from './process.ts';

// ---------------------------------------------------------------------------
// Capture tool handler
// ---------------------------------------------------------------------------

type ToolDef = {
  execute: (...args: unknown[]) => Promise<{
    content: Array<{ text: string; type: string }>;
    details?: unknown;
    isError?: boolean;
  }>;
  name: string;
};

const tools = new Map<string, ToolDef>();

const fakePi = {
  registerTool: (tool: ToolDef) => {
    tools.set(tool.name, tool);
  },
};

const stubCtx = (hasUI = false, confirmResult = false): ExtensionContext =>
  ({
    cwd: '/test/project',
    hasUI,
    ui: {
      confirm: vi.fn(async () => confirmResult),
      notify: vi.fn(),
    },
  }) as unknown as ExtensionContext;

const mod = await import('./subagent.ts');
mod.default(fakePi as unknown as ExtensionAPI);

const exec = () => {
  const tool = tools.get('subagent');
  if (!tool) {
    throw new Error('subagent tool not registered');
  }
  return tool.execute;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSuccessResult = (
  agent: string,
  output: string,
  step?: number,
): SingleResult => ({
  agent,
  agentSource: 'user',
  exitCode: 0,
  messages: [
    {
      content: [{ text: output, type: 'text' }],
      role: 'assistant',
      timestamp: Date.now(),
    } as unknown as Message,
  ],
  stderr: '',
  step,
  task: 'test task',
  usage: {
    cacheRead: 0,
    cacheWrite: 0,
    contextTokens: 0,
    cost: 0,
    input: 100,
    output: 50,
    turns: 1,
  },
});

const makeErrorResult = (agent: string, step?: number): SingleResult => ({
  agent,
  agentSource: 'user',
  exitCode: 1,
  messages: [],
  stderr: 'Something went wrong',
  step,
  task: 'test task',
  usage: {
    cacheRead: 0,
    cacheWrite: 0,
    contextTokens: 0,
    cost: 0,
    input: 0,
    output: 0,
    turns: 0,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subagent extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registration', () => {
    it('registers the subagent tool', () => {
      expect(tools.has('subagent')).toBe(true);
    });
  });

  describe('mode validation', () => {
    it('rejects when no mode is specified', async () => {
      const result = await exec()('id', {}, undefined, undefined, stubCtx());
      expect(result.content[0].text).toContain('Invalid parameters');
      expect(result.content[0].text).toContain('scout');
    });

    it('rejects when multiple modes are specified', async () => {
      const result = await exec()(
        'id',
        {
          agent: 'scout',
          task: 'do something',
          tasks: [{ agent: 'scout', task: 'also this' }],
        },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toContain('Invalid parameters');
    });
  });

  describe('single mode', () => {
    it('runs a single agent and returns output', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeSuccessResult('scout', 'Found 3 files.'),
      );

      const result = await exec()(
        'id',
        { agent: 'scout', task: 'find auth code' },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.content[0].text).toBe('Found 3 files.');
      expect(runSingleAgent).toHaveBeenCalledOnce();
    });

    it('returns error result on agent failure', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(makeErrorResult('scout'));

      const result = await exec()(
        'id',
        { agent: 'scout', task: 'fail' },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Something went wrong');
    });

    it('returns "(no output)" when agent produces nothing', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce({
        ...makeSuccessResult('scout', ''),
        messages: [],
      });

      const result = await exec()(
        'id',
        { agent: 'scout', task: 'empty' },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.content[0].text).toBe('(no output)');
    });
  });

  describe('chain mode', () => {
    it('runs steps sequentially and returns final output', async () => {
      vi.mocked(runSingleAgent)
        .mockResolvedValueOnce(makeSuccessResult('scout', 'recon done', 1))
        .mockResolvedValueOnce(
          makeSuccessResult('worker', 'implementation done', 2),
        );

      const result = await exec()(
        'id',
        {
          chain: [
            { agent: 'scout', task: 'find code' },
            { agent: 'worker', task: 'implement based on: {previous}' },
          ],
        },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.content[0].text).toBe('implementation done');
      expect(runSingleAgent).toHaveBeenCalledTimes(2);
    });

    it('stops chain on first failure', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeErrorResult('scout', 1),
      );

      const result = await exec()(
        'id',
        {
          chain: [
            { agent: 'scout', task: 'find code' },
            { agent: 'worker', task: 'implement' },
          ],
        },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Chain stopped at step 1');
      expect(runSingleAgent).toHaveBeenCalledOnce();
    });
  });

  describe('parallel mode', () => {
    it('runs tasks concurrently and returns summary', async () => {
      vi.mocked(runSingleAgent)
        .mockResolvedValueOnce(makeSuccessResult('scout', 'auth files found'))
        .mockResolvedValueOnce(makeSuccessResult('scout', 'api files found'));

      const result = await exec()(
        'id',
        {
          tasks: [
            { agent: 'scout', task: 'find auth' },
            { agent: 'scout', task: 'find api' },
          ],
        },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.content[0].text).toContain('2/2 succeeded');
      expect(runSingleAgent).toHaveBeenCalledTimes(2);
    });

    it('rejects when too many parallel tasks', async () => {
      const tasks = Array.from({ length: 9 }, (_, i) => ({
        agent: 'scout',
        task: `task ${i}`,
      }));

      const result = await exec()(
        'id',
        { tasks },
        undefined,
        undefined,
        stubCtx(),
      );

      expect(result.content[0].text).toContain('Too many parallel tasks');
      expect(runSingleAgent).not.toHaveBeenCalled();
    });
  });

  describe('project agent confirmation', () => {
    it('skips confirmation for user-scope agents', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeSuccessResult('scout', 'done'),
      );

      const ctx = stubCtx(true, false);
      await exec()(
        'id',
        { agent: 'scout', agentScope: 'user', task: 'recon' },
        undefined,
        undefined,
        ctx,
      );

      expect(ctx.ui.confirm).not.toHaveBeenCalled();
    });

    it('prompts for project-scope agents when UI available', async () => {
      const ctx = stubCtx(true, false);

      const result = await exec()(
        'id',
        { agent: 'local', agentScope: 'both', task: 'read files' },
        undefined,
        undefined,
        ctx,
      );

      expect(ctx.ui.confirm).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Canceled');
    });

    it('proceeds when user confirms project agents', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeSuccessResult('local', 'done'),
      );

      const ctx = stubCtx(true, true);
      const result = await exec()(
        'id',
        { agent: 'local', agentScope: 'both', task: 'read files' },
        undefined,
        undefined,
        ctx,
      );

      expect(result.content[0].text).toBe('done');
    });

    it('skips confirmation when confirmProjectAgents is false', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeSuccessResult('local', 'done'),
      );

      const ctx = stubCtx(true, false);
      await exec()(
        'id',
        {
          agent: 'local',
          agentScope: 'both',
          confirmProjectAgents: false,
          task: 'read files',
        },
        undefined,
        undefined,
        ctx,
      );

      expect(ctx.ui.confirm).not.toHaveBeenCalled();
    });

    it('skips confirmation without UI', async () => {
      vi.mocked(runSingleAgent).mockResolvedValueOnce(
        makeSuccessResult('local', 'done'),
      );

      const ctx = stubCtx(false);
      await exec()(
        'id',
        { agent: 'local', agentScope: 'both', task: 'read files' },
        undefined,
        undefined,
        ctx,
      );

      expect(ctx.ui.confirm).not.toHaveBeenCalled();
    });
  });
});
