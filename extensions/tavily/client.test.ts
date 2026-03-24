import { describe, expect, it } from 'vitest';

import { buildMcpRequest, parseSseResponse } from './client.ts';

// ---------------------------------------------------------------------------
// buildMcpRequest
// ---------------------------------------------------------------------------

describe('buildMcpRequest', () => {
  it('builds a valid JSON-RPC request for the given tool and arguments', () => {
    const result = buildMcpRequest('tavily_search', { query: 'test' });

    expect(result).toEqual({
      id: 1,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: { query: 'test' },
        name: 'tavily_search',
      },
    });
  });

  it('passes through all arguments unchanged', () => {
    const args = {
      include_domains: ['example.com'],
      max_results: 5,
      query: 'hello',
    };

    const result = buildMcpRequest('tavily_search', args);
    expect(result.params.arguments).toEqual(args);
  });
});

// ---------------------------------------------------------------------------
// parseSseResponse
// ---------------------------------------------------------------------------

describe('parseSseResponse', () => {
  it('extracts structuredContent from an SSE data line', () => {
    const payload = {
      result: {
        structuredContent: { query: 'test', results: [] },
      },
    };
    const raw = `event: message\ndata:${JSON.stringify(payload)}\n\n`;

    expect(parseSseResponse(raw)).toEqual({ query: 'test', results: [] });
  });

  it('falls back to content[0].text when structuredContent is absent', () => {
    const inner = JSON.stringify({
      query: 'fallback',
      results: [{ title: 'A' }],
    });
    const payload = {
      result: {
        content: [{ text: inner, type: 'text' }],
      },
    };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(parseSseResponse(raw)).toEqual({
      query: 'fallback',
      results: [{ title: 'A' }],
    });
  });

  it('parses string content as JSON', () => {
    const inner = { parsed: true };
    const payload = {
      result: {
        content: [{ text: JSON.stringify(inner), type: 'text' }],
      },
    };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(parseSseResponse(raw)).toEqual(inner);
  });

  it('returns structuredContent directly when it is already an object', () => {
    const structured = { already: 'an object' };
    const payload = { result: { structuredContent: structured } };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(parseSseResponse(raw)).toEqual(structured);
  });

  it('throws when the response contains no data line', () => {
    expect(() => parseSseResponse('event: message\n\n')).toThrow(
      'Unexpected Tavily response',
    );
  });

  it('throws when the response contains an error', () => {
    const payload = { error: { code: -1, message: 'rate limited' } };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(() => parseSseResponse(raw)).toThrow('Tavily API error');
    expect(() => parseSseResponse(raw)).toThrow('rate limited');
  });

  it('throws when the result has no content', () => {
    const payload = { result: {} };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(() => parseSseResponse(raw)).toThrow(
      'No content in Tavily response',
    );
  });

  it('prefers structuredContent over content[0].text', () => {
    const payload = {
      result: {
        content: [{ text: JSON.stringify({ from: 'text' }), type: 'text' }],
        structuredContent: { from: 'structured' },
      },
    };
    const raw = `data:${JSON.stringify(payload)}`;

    expect(parseSseResponse(raw)).toEqual({ from: 'structured' });
  });

  it('handles multiple lines and picks the first data line', () => {
    const first = { result: { structuredContent: { first: true } } };
    const second = { result: { structuredContent: { second: true } } };
    const raw = `event: open\ndata:${JSON.stringify(first)}\ndata:${JSON.stringify(second)}`;

    expect(parseSseResponse(raw)).toEqual({ first: true });
  });
});
