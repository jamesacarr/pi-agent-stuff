import type { TavilyMcpRequest } from './types.ts';

const TAVILY_MCP_URL = 'https://mcp.tavily.com/mcp';

function getApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }
  return key;
}

export function buildMcpRequest(
  toolName: string,
  args: Record<string, unknown>,
): TavilyMcpRequest {
  return {
    id: 1,
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { arguments: args, name: toolName },
  };
}

export function parseSseResponse(raw: string): unknown {
  const dataLine = raw.split('\n').find(line => line.startsWith('data:'));
  if (!dataLine) {
    throw new Error(`Unexpected Tavily response: ${raw.slice(0, 200)}`);
  }

  const json = JSON.parse(dataLine.slice(5));

  if (json.error) {
    throw new Error(`Tavily API error: ${JSON.stringify(json.error)}`);
  }

  const content =
    json.result?.structuredContent ?? json.result?.content?.[0]?.text;
  if (!content) {
    throw new Error(
      `No content in Tavily response: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }

  return typeof content === 'string' ? JSON.parse(content) : content;
}

export async function callTavily(
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = getApiKey();
  const body = buildMcpRequest(toolName, args);

  const response = await fetch(TAVILY_MCP_URL, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Tavily HTTP ${response.status}: ${await response.text()}`);
  }

  const raw = await response.text();
  return parseSseResponse(raw);
}
