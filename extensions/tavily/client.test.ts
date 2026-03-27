import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { callTavily } from './client.ts';

// ---------------------------------------------------------------------------
// callTavily
// ---------------------------------------------------------------------------

const fetchMock =
  vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>();

beforeAll(() => {
  vi.stubEnv('TAVILY_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

describe('callTavily', () => {
  it('throws when TAVILY_API_KEY is not set', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');

    await expect(callTavily('search', { query: 'test' })).rejects.toThrow(
      'TAVILY_API_KEY environment variable is not set',
    );

    vi.stubEnv('TAVILY_API_KEY', 'test-key');
  });

  it('posts to the correct endpoint with api_key and args in the body', async () => {
    const payload = { query: 'hello', results: [] };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    await callTavily('search', { max_results: 3, query: 'hello' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/search');
    expect(JSON.parse(init?.body as string)).toEqual({
      api_key: 'test-key',
      max_results: 3,
      query: 'hello',
    });
  });

  it('returns parsed JSON on success', async () => {
    const payload = { query: 'test', results: [{ title: 'A' }] };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    const result = await callTavily('search', { query: 'test' });

    expect(result).toEqual(payload);
  });

  it('throws with status and body on HTTP error', async () => {
    fetchMock.mockResolvedValue(
      new Response('rate limit exceeded', { status: 429 }),
    );

    await expect(callTavily('search', { query: 'test' })).rejects.toThrow(
      'Tavily HTTP 429: rate limit exceeded',
    );
  });

  it('forwards the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const controller = new AbortController();

    await callTavily(
      'extract',
      { urls: ['https://example.com'] },
      controller.signal,
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBe(controller.signal);
  });
});
