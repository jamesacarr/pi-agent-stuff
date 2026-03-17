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

// Mock session module to avoid creating real agent sessions
vi.mock('./session.ts', () => ({
  createMemberSession: vi.fn((_cwd: string, member: { session?: unknown }) => {
    const session = {
      abort: vi.fn(),
      dispose: vi.fn(),
      followUp: vi.fn(),
      isStreaming: false,
      prompt: vi.fn(),
      steer: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    member.session = session;
    return session;
  }),
  destroyMemberSession: vi.fn(),
  pushActivity: vi.fn(),
}));

import { createMemberSession } from './session.ts';

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
      expect(createMemberSession).toHaveBeenCalledOnce();
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

    it('returns routing info in details', async () => {
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

      // Verify routing info in details (actual sending done by tool_result handler)
      const details = result.details as Record<string, unknown>;
      expect(details.routeTo).toBe('scout');
      expect(details.routeMessage).toBe('find auth code');
    });
  });

  describe('team_steer', () => {
    const execSpawn = () => getExecute('team_spawn');
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

    it('throws when member is not running (status is idle after spawn)', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      // Member is idle (team_send returns routing info but doesn't change status
      // in unit tests — tool_result handler does the actual routing/status change)
      await expect(
        execSteer()('id', { message: 'change direction', name: 'scout' }),
      ).rejects.toThrow('not running');
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

  describe('team_send routing', () => {
    const execSpawn = () => getExecute('team_spawn');
    const execSend = () => getExecute('team_send');

    it('includes routing info for orchestrator sends', async () => {
      await execSpawn()(
        'id',
        { agent: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const result = await execSend()(
        'id',
        { message: 'investigate auth', name: 'scout' },
        undefined,
        undefined,
        stubCtx(),
      );

      const details = result.details as Record<string, unknown>;
      expect(details.routeTo).toBe('scout');
      expect(details.routeMessage).toBe('investigate auth');
      expect(details.routeFrom).toBe('__orchestrator__');
    });

    it('throws for non-existent member', async () => {
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
