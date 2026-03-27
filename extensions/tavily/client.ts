const TAVILY_API_BASE = 'https://api.tavily.com';

function getApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }
  return key;
}

export async function callTavily(
  endpoint: 'search' | 'extract',
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = getApiKey();

  const response = await fetch(`${TAVILY_API_BASE}/${endpoint}`, {
    body: JSON.stringify({ api_key: apiKey, ...args }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tavily HTTP ${response.status}: ${body}`);
  }

  return response.json();
}
