/**
 * Team member session management via the pi SDK.
 *
 * Each team member runs as an in-process AgentSession instead of a
 * subprocess.  This eliminates process management, JSONL parsing, and
 * stdin/stdout piping while providing the same capabilities.
 */

import type {
  AgentSession,
  AgentSessionEvent,
  CreateAgentSessionOptions,
  ToolDefinition,
} from '@mariozechner/pi-coding-agent';
import {
  AuthStorage,
  createAgentSession,
  createBashTool,
  createCodingTools,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

import type { ActivityItem, TeamMember } from './types.ts';

// ---------------------------------------------------------------------------
// Activity logging
// ---------------------------------------------------------------------------

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
  if (DISPLAYABLE_TYPES.has(item.type)) {
    member.lastActivity = item;
  }
};

// ---------------------------------------------------------------------------
// Child team_send tool definition (registered in each member session)
// ---------------------------------------------------------------------------

export const createChildTeamSendTool = (
  memberName: string,
): ToolDefinition => ({
  description:
    'Send a message to another team member. Their response will arrive as a separate message in the conversation when they finish.',
  // biome-ignore lint/suspicious/useAwait: execute must return Promise
  async execute(_callId, params: { message: string; name: string }) {
    return {
      content: [
        {
          text: `Message sent to "${params.name}". Their response will arrive as a separate message.`,
          type: 'text',
        },
      ],
      details: {
        routeFrom: memberName,
        routeMessage: params.message,
        routeTo: params.name,
      },
    };
  },
  label: 'Team Send',
  name: 'team_send',
  parameters: Type.Object({
    message: Type.String({
      description: 'Message to send to the team member',
    }),
    name: Type.String({
      description: 'Name of the team member to message',
    }),
  }),
  promptGuidelines: [
    'Each member has an isolated context — include all relevant information in the message.',
  ],
});

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export const createMemberSession = async (
  cwd: string,
  member: TeamMember,
): Promise<AgentSession> => {
  const agent = member.agent;

  // Resolve model
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  let model: ReturnType<typeof modelRegistry.find> | undefined;
  if (agent.model) {
    // Expects "provider/id" format (e.g. "anthropic/claude-haiku-4-5")
    const slashIdx = agent.model.indexOf('/');
    if (slashIdx > 0) {
      model = modelRegistry.find(
        agent.model.slice(0, slashIdx),
        agent.model.slice(slashIdx + 1),
      );
    }
  }

  // Build tools list
  const tools = agent.tools?.length
    ? createToolsForNames(cwd, agent.tools)
    : createCodingTools(cwd);

  // Use a ResourceLoader to set the system prompt if the agent has one
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd,
    settingsManager,
    ...(agent.systemPrompt.trim()
      ? { systemPromptOverride: () => agent.systemPrompt }
      : {}),
  });
  await loader.reload();

  const options: CreateAgentSessionOptions = {
    authStorage,
    customTools: [createChildTeamSendTool(member.name)],
    cwd,
    model,
    modelRegistry,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
    tools,
  };

  const { session } = await createAgentSession(options);

  member.session = session;
  return session;
};

// ---------------------------------------------------------------------------
// Tool helpers
// ---------------------------------------------------------------------------

const createToolsForNames = (
  cwd: string,
  names: string[],
): NonNullable<CreateAgentSessionOptions['tools']> => {
  const toolMap: Record<string, () => unknown> = {
    bash: () => createBashTool(cwd),
    edit: () => createEditTool(cwd),
    find: () => createFindTool(cwd),
    grep: () => createGrepTool(cwd),
    ls: () => createLsTool(cwd),
    read: () => createReadTool(cwd),
    write: () => createWriteTool(cwd),
  };

  return names.filter(n => n in toolMap).map(n => toolMap[n]()) as NonNullable<
    CreateAgentSessionOptions['tools']
  >;
};

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

export type EventCallback = (event: AgentSessionEvent) => void;

/**
 * Subscribe to a member session's events.
 * Returns an unsubscribe function.
 */
export const subscribeToSession = (
  member: TeamMember,
  callback: EventCallback,
): (() => void) => {
  if (!member.session) {
    return () => {};
  }
  return member.session.subscribe(callback);
};

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export const destroyMemberSession = (member: TeamMember): void => {
  if (member.session) {
    if (member.session.isStreaming) {
      member.session.abort().catch(() => {});
    }
    member.session.dispose();
    member.session = undefined;
  }
};
