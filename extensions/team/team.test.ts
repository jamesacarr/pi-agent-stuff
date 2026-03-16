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

// Mock RPC module to avoid spawning real processes
vi.mock('./rpc.ts', () => {
  const connections = new Map<
    string,
    {
      send: ReturnType<typeof vi.fn>;
      onEvent: ReturnType<typeof vi.fn>;
      detach: ReturnType<typeof vi.fn>;
    }
  >();

  return {
    cleanSessionDir: vi.fn(),
    getRpcConnection: vi.fn((member: { name: string }) =>
      connections.get(member.name),
    ),
    killRpcProcess: vi.fn(),
    makeSessionDir: vi.fn(() => '/tmp/test-team-sessions'),
    pushActivity: vi.fn(),
    removeRpcConnection: vi.fn(),
    setupRpcConnection: vi.fn((member: { name: string }) => {
      const conn = {
        detach: vi.fn(),
        onEvent: vi.fn().mockReturnValue(() => {}),
        send: vi.fn().mockResolvedValue({ success: true }),
      };
      connections.set(member.name, conn);
      return conn;
    }),
    spawnRpcProcess: vi.fn((_cwd: string, member: { rpcProcess?: unknown }) => {
      const proc = {
        killed: false,
        on: vi.fn(),
        pid: 12345,
      };
      member.rpcProcess = proc;
      return proc;
    }),
  };
});

// Mock team-file module
vi.mock('./team-file.ts', () => ({
  addChild: vi.fn(),
  cleanupOrphans: vi.fn(),
  removeChild: vi.fn(),
  removeTeamFile: vi.fn(),
}));

import { getRpcConnection, spawnRpcProcess } from './rpc.ts';

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
  events: { emit: vi.fn(), on: vi.fn() },
  getFlag: vi.fn().mockReturnValue(false), // Not a team member
  on: (event: string, handler: (...args: unknown[]) => void) => {
    eventHandlers.set(event, handler);
  },
  registerCommand: vi.fn(),
  registerFlag: vi.fn(),
  registerShortcut: vi.fn(),
  registerTool: (tool: ToolDef) => {
    tools.set(tool.name, tool);
  },
  sendMessage: vi.fn(),
};

const stubCtx = (): ExtensionContext =>
  ({
    cwd: '/test/project',
    hasUI: false,
    ui: {
      notify: () => {},
      select: vi.fn(),
      setWidget: vi.fn(),
    },
  }) as unknown as ExtensionContext;

// Load extension
const mod = await import('./team.ts');
mod.default(fakePi as unknown as ExtensionAPI);

// Capture registration state before beforeEach clears mocks
const registeredFlag = fakePi.registerFlag.mock.calls.some(
  (c: unknown[]) => c[0] === 'team-member',
);
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
    it('registers all six tools', () => {
      expect(tools.has('team_spawn')).toBe(true);
      expect(tools.has('team_send')).toBe(true);
      expect(tools.has('team_steer')).toBe(true);
      expect(tools.has('team_follow_up')).toBe(true);
      expect(tools.has('team_list')).toBe(true);
      expect(tools.has('team_dismiss')).toBe(true);
    });

    it('registers the --team-member flag', () => {
      expect(registeredFlag).toBe(true);
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
      expect(spawnRpcProcess).toHaveBeenCalledOnce();
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

    it('sends message and returns immediately', async () => {
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
      expect(result.content[0].text).toContain('Message sent');
      expect(result.content[0].text).toContain('scout');

      // Verify RPC prompt was sent
      const conn = vi.mocked(getRpcConnection).mock.results[0]?.value;
      if (conn) {
        expect(conn.send).toHaveBeenCalledWith({
          message: 'find auth code',
          type: 'prompt',
        });
      }
    });

    it('throws when member is already running', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // First send starts running
      await execSend()(
        'id',
        { message: 'first', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // Second send should fail (member is running)
      await expect(
        execSend()(
          'id',
          { message: 'second', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow('already processing');
    });
  });

  describe('team_steer', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execSend = () => getExecute('team_send');
    const execSteer = () => getExecute('team_steer');

    it('throws for unknown member', async () => {
      await expect(
        execSteer()('id', { message: 'stop', name: 'nobody' }),
      ).rejects.toThrow('No team member "nobody"');
    });

    it('throws when member is not running', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      await expect(
        execSteer()('id', { message: 'stop', name: 'scout' }),
      ).rejects.toThrow('not running');
    });

    it('sends steer command when member is running', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      await execSend()(
        'id',
        { message: 'work', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const result = await execSteer()('id', {
        message: 'change direction',
        name: 'scout',
      });
      expect(result.content[0].text).toContain('Steering');
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

  describe('error recovery', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execSend = () => getExecute('team_send');

    it('resets member status when RPC send rejects', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // Make the RPC connection reject on send
      const conn = vi.mocked(getRpcConnection)({ name: 'scout' } as never);
      if (conn) {
        vi.mocked(conn.send).mockRejectedValueOnce(
          new Error('connection lost'),
        );
      }

      await expect(
        execSend()(
          'id',
          { message: 'fail', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow('connection lost');

      // Member should be in error state, not stuck in 'running'
      const listResult = await getExecute('team_list')();
      expect(listResult.content[0].text).toContain('✗ error');
    });

    it('resets member status when RPC returns success: false', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const conn = vi.mocked(getRpcConnection)({ name: 'scout' } as never);
      if (conn) {
        vi.mocked(conn.send).mockResolvedValueOnce({
          error: 'model unavailable',
          success: false,
        });
      }

      await expect(
        execSend()(
          'id',
          { message: 'fail', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow('model unavailable');

      const listResult = await getExecute('team_list')();
      expect(listResult.content[0].text).toContain('✗ error');
    });

    it('allows retry after error', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // First send fails
      const conn = vi.mocked(getRpcConnection)({ name: 'scout' } as never);
      if (conn) {
        vi.mocked(conn.send)
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValueOnce({ success: true });
      }

      await expect(
        execSend()(
          'id',
          { message: 'fail', name: 'scout' },
          undefined,
          undefined,
          stubCtx(),
        ),
      ).rejects.toThrow();

      // Retry should work (status is 'error', not 'running')
      const result = await execSend()(
        'id',
        { message: 'retry', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );
      expect(result.content[0].text).toContain('Message sent');
    });
  });

  describe('team_follow_up', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execFollowUp = () => getExecute('team_follow_up');

    it('throws for unknown member', async () => {
      await expect(
        execFollowUp()('id', { message: 'later', name: 'nobody' }),
      ).rejects.toThrow('No team member "nobody"');
    });

    it('sends follow_up command', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const result = await execFollowUp()('id', {
        message: 'after you finish, summarise',
        name: 'scout',
      });
      expect(result.content[0].text).toContain('Follow-up queued');
    });
  });
});
