import type {
  ExtensionAPI,
  ExtensionContext,
} from '@mariozechner/pi-coding-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// We test the tool handlers by capturing them from the extension registration
// via a fake ExtensionAPI, similar to the access-control tests.
// ---------------------------------------------------------------------------

// Mock discoverAgents to avoid filesystem access
vi.mock('../subagent/agents.ts', () => ({
  discoverAgents: vi.fn(() => ({
    agents: [
      {
        description: 'Fast recon',
        filePath: '/agents/scout.md',
        model: 'claude-haiku',
        name: 'scout',
        source: 'user',
        systemPrompt: 'You are a scout.',
        tools: ['read', 'grep', 'find'],
      },
      {
        description: 'Code review',
        filePath: '/agents/reviewer.md',
        model: 'claude-opus',
        name: 'reviewer',
        source: 'user',
        systemPrompt: 'You are a reviewer.',
        tools: ['read', 'grep'],
      },
    ],
    projectAgentsDir: null,
  })),
}));

// Mock process module to avoid spawning real processes
vi.mock('./process.ts', () => ({
  cleanSessionDir: vi.fn(),
  makeSessionDir: vi.fn(() => '/tmp/test-team-sessions'),
  runAgent: vi.fn(),
}));

import { emptyUsage } from './format.ts';
import { runAgent } from './process.ts';
import type { SendResult } from './types.ts';

// ---------------------------------------------------------------------------
// Capture tool handlers
// ---------------------------------------------------------------------------

type ToolDef = {
  execute: (...args: unknown[]) => Promise<{
    content: Array<{ text: string; type: string }>;
    details?: unknown;
  }>;
  name: string;
};

const tools = new Map<string, ToolDef>();
const eventHandlers = new Map<string, (...args: unknown[]) => void>();

const fakePi = {
  on: (event: string, handler: (...args: unknown[]) => void) => {
    eventHandlers.set(event, handler);
  },
  registerTool: (tool: ToolDef) => {
    tools.set(tool.name, tool);
  },
};

const stubCtx = (): ExtensionContext =>
  ({
    cwd: '/test/project',
    hasUI: false,
    ui: { notify: () => {} },
  }) as unknown as ExtensionContext;

// Load extension
const mod = await import('./team.ts');
mod.default(fakePi as unknown as ExtensionAPI);

const getExecute = (name: string) => {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Tool ${name} not registered`);
  }
  return tool.execute;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('team extension', () => {
  beforeEach(() => {
    // Trigger session_start to clear state
    const handler = eventHandlers.get('session_start');
    if (handler) {
      handler({}, stubCtx());
    }
    vi.clearAllMocks();
  });

  describe('tool registration', () => {
    it('registers all four tools', () => {
      expect(tools.has('team_spawn')).toBe(true);
      expect(tools.has('team_send')).toBe(true);
      expect(tools.has('team_list')).toBe(true);
      expect(tools.has('team_dismiss')).toBe(true);
    });

    it('registers session lifecycle handlers', () => {
      expect(eventHandlers.has('session_start')).toBe(true);
      expect(eventHandlers.has('session_shutdown')).toBe(true);
    });
  });

  describe('team_spawn', () => {
    const exec = () => getExecute('team_spawn');

    it('spawns a team member from a known agent', async () => {
      const result = await exec()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toContain('scout');
      expect(result.content[0].text).toContain('spawned');
    });

    it('uses custom name when provided', async () => {
      const result = await exec()(
        'id',
        { agent: 'scout', name: 'my-scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toContain('my-scout');
    });

    it('throws for unknown agent', async () => {
      await expect(
        exec()('id', { agent: 'nonexistent' }, undefined, undefined, stubCtx()),
      ).rejects.toThrow('Unknown agent "nonexistent"');
    });

    it('throws for duplicate name', async () => {
      await exec()('id', { agent: 'scout' }, undefined, undefined, stubCtx());
      await expect(
        exec()('id', { agent: 'scout' }, undefined, undefined, stubCtx()),
      ).rejects.toThrow('already exists');
    });

    it('allows same agent with different names', async () => {
      await exec()(
        'id',
        { agent: 'scout', name: 'scout-1' },
        undefined,
        undefined,
        stubCtx(),
      );
      const result = await exec()(
        'id',
        { agent: 'scout', name: 'scout-2' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toContain('scout-2');
    });
  });

  describe('team_send', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execSend = () => getExecute('team_send');

    const successResult: SendResult = {
      elapsed: 1000,
      exitCode: 0,
      messages: [
        {
          content: [{ text: 'Found 3 relevant files.', type: 'text' }],
          role: 'assistant',
          timestamp: Date.now(),
        } as unknown as import('@mariozechner/pi-ai').Message,
      ],
      stderr: '',
      usage: { ...emptyUsage(), input: 100, output: 50, turns: 1 },
    };

    const errorResult: SendResult = {
      elapsed: 500,
      exitCode: 1,
      messages: [],
      stderr: 'Model not found',
      usage: emptyUsage(),
    };

    it('throws for unknown member', async () => {
      await expect(
        execSend()(
          'id',
          { message: 'hello', name: 'nobody' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow('No team member "nobody"');
    });

    it('sends message and returns response', async () => {
      vi.mocked(runAgent).mockResolvedValueOnce(successResult);
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const result = await execSend()(
        'id',
        { message: 'find auth code', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toBe('Found 3 relevant files.');
      expect(runAgent).toHaveBeenCalledOnce();
    });

    it('throws on agent error', async () => {
      vi.mocked(runAgent).mockResolvedValueOnce(errorResult);
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      await expect(
        execSend()(
          'id',
          { message: 'do something', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow('failed: Model not found');
    });

    it('accumulates usage across sends', async () => {
      vi.mocked(runAgent)
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(successResult);

      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      await execSend()(
        'id',
        { message: 'first', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      const result = await execSend()(
        'id',
        { message: 'second', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const details = result.details as {
        totalUsage: { input: number; turns: number };
      };
      expect(details.totalUsage.input).toBe(200);
      expect(details.totalUsage.turns).toBe(2);
    });

    it('sets member status to error on failure', async () => {
      vi.mocked(runAgent).mockResolvedValueOnce(errorResult);
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      await expect(
        execSend()(
          'id',
          { message: 'fail', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow();

      // List should show error status
      const listResult = await getExecute('team_list')();
      expect(listResult.content[0].text).toContain('✗ error');
    });

    it('allows retry after error', async () => {
      vi.mocked(runAgent)
        .mockResolvedValueOnce(errorResult)
        .mockResolvedValueOnce(successResult);

      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // First send fails
      await expect(
        execSend()(
          'id',
          { message: 'fail', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow();

      // Retry succeeds
      const result = await execSend()(
        'id',
        { message: 'retry', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toBe('Found 3 relevant files.');
    });
  });

  describe('team_list', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execList = () => getExecute('team_list');

    it('returns empty message when no members', async () => {
      const result = await execList()();
      expect(result.content[0].text).toContain('No team members');
    });

    it('lists spawned members', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      await execSpawn()(
        'id',
        { agent: 'reviewer' },
        undefined,
        undefined,
        stubCtx(),
      );

      const result = await execList()();
      expect(result.content[0].text).toContain('scout');
      expect(result.content[0].text).toContain('reviewer');
      expect(result.content[0].text).toContain('✓ idle');
    });
  });

  describe('team_dismiss', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execDismiss = () => getExecute('team_dismiss');
    const execList = () => getExecute('team_list');

    it('throws for unknown member', async () => {
      await expect(execDismiss()('id', { name: 'nobody' })).rejects.toThrow(
        'No team member "nobody"',
      );
    });

    it('removes a member', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      const result = await execDismiss()('id', { name: 'scout' });
      expect(result.content[0].text).toContain('dismissed');

      const listResult = await execList()();
      expect(listResult.content[0].text).toContain('No team members');
    });
  });

  describe('session lifecycle', () => {
    it('clears members on session_start', async () => {
      await getExecute('team_spawn')(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // Trigger session_start
      const handler = eventHandlers.get('session_start');
      handler?.({}, stubCtx());

      const result = await getExecute('team_list')();
      expect(result.content[0].text).toContain('No team members');
    });
  });
});
