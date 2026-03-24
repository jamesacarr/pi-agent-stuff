import { describe, expect, it } from 'vitest';

import { formatExtractResults, formatSearchResults } from './format.ts';
import type { TavilyExtractResponse, TavilySearchResponse } from './types.ts';

// ---------------------------------------------------------------------------
// formatSearchResults
// ---------------------------------------------------------------------------

describe('formatSearchResults', () => {
  it('formats a single result with title, URL, score, and content', () => {
    const data: TavilySearchResponse = {
      query: 'test',
      results: [
        {
          content: 'Some snippet about the topic.',
          score: 0.95,
          title: 'Test Page',
          url: 'https://example.com',
        },
      ],
    };

    const output = formatSearchResults(data);
    expect(output).toContain('### Test Page');
    expect(output).toContain('**URL:** https://example.com');
    expect(output).toContain('**Score:** 0.95');
    expect(output).toContain('Some snippet about the topic.');
  });

  it('includes an answer when present', () => {
    const data: TavilySearchResponse = {
      answer: 'The answer is 42.',
      query: 'meaning of life',
      results: [],
    };

    const output = formatSearchResults(data);
    expect(output).toContain('**Answer:** The answer is 42.');
  });

  it('omits answer section when absent', () => {
    const data: TavilySearchResponse = {
      query: 'test',
      results: [{ content: 'c', score: 0.5, title: 't', url: 'u' }],
    };

    expect(formatSearchResults(data)).not.toContain('**Answer:**');
  });

  it('includes raw content when present', () => {
    const data: TavilySearchResponse = {
      query: 'test',
      results: [
        {
          content: 'snippet',
          raw_content: 'Full page content here.',
          score: 0.8,
          title: 'Full',
          url: 'https://example.com',
        },
      ],
    };

    const output = formatSearchResults(data);
    expect(output).toContain('**Full content:**');
    expect(output).toContain('Full page content here.');
  });

  it('formats multiple results separated by dividers', () => {
    const data: TavilySearchResponse = {
      query: 'test',
      results: [
        { content: 'first', score: 0.9, title: 'A', url: 'https://a.com' },
        { content: 'second', score: 0.8, title: 'B', url: 'https://b.com' },
      ],
    };

    const output = formatSearchResults(data);
    expect(output).toContain('### A');
    expect(output).toContain('### B');
    expect(output.match(/---/g)?.length).toBe(2);
  });

  it('returns empty string for no results and no answer', () => {
    const data: TavilySearchResponse = { query: 'empty', results: [] };
    expect(formatSearchResults(data)).toBe('');
  });

  it('rounds score to two decimal places', () => {
    const data: TavilySearchResponse = {
      query: 'test',
      results: [{ content: 'c', score: 0.123456, title: 't', url: 'u' }],
    };

    expect(formatSearchResults(data)).toContain('**Score:** 0.12');
  });
});

// ---------------------------------------------------------------------------
// formatExtractResults
// ---------------------------------------------------------------------------

describe('formatExtractResults', () => {
  it('formats a single successful extraction', () => {
    const data: TavilyExtractResponse = {
      failed_results: [],
      results: [
        {
          raw_content: '# Page Title\n\nSome content.',
          url: 'https://example.com',
        },
      ],
    };

    const output = formatExtractResults(data);
    expect(output).toContain('### https://example.com');
    expect(output).toContain('# Page Title\n\nSome content.');
  });

  it('formats multiple successful extractions', () => {
    const data: TavilyExtractResponse = {
      failed_results: [],
      results: [
        { raw_content: 'Content A', url: 'https://a.com' },
        { raw_content: 'Content B', url: 'https://b.com' },
      ],
    };

    const output = formatExtractResults(data);
    expect(output).toContain('### https://a.com');
    expect(output).toContain('### https://b.com');
    expect(output.match(/---/g)?.length).toBe(2);
  });

  it('lists failed extractions', () => {
    const data: TavilyExtractResponse = {
      failed_results: [
        { error: 'timeout', url: 'https://fail.com' },
        { error: '403 forbidden', url: 'https://blocked.com' },
      ],
      results: [],
    };

    const output = formatExtractResults(data);
    expect(output).toContain('**Failed extractions:**');
    expect(output).toContain('- https://fail.com: timeout');
    expect(output).toContain('- https://blocked.com: 403 forbidden');
  });

  it('includes both successful and failed results', () => {
    const data: TavilyExtractResponse = {
      failed_results: [{ error: 'not found', url: 'https://gone.com' }],
      results: [{ raw_content: 'OK', url: 'https://ok.com' }],
    };

    const output = formatExtractResults(data);
    expect(output).toContain('### https://ok.com');
    expect(output).toContain('**Failed extractions:**');
    expect(output).toContain('- https://gone.com: not found');
  });

  it('returns empty string when no results and no failures', () => {
    const data: TavilyExtractResponse = { failed_results: [], results: [] };
    expect(formatExtractResults(data)).toBe('');
  });
});
