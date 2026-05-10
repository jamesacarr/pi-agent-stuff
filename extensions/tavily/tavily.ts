/**
 * Tavily Web Tools Extension
 *
 * Provides web_search and web_extract tools powered by Tavily's API.
 * Requires: TAVILY_API_KEY environment variable.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { callTavily } from './client.ts';
import { formatExtractResults, formatSearchResults } from './format.ts';
import { ExtractParams, SearchParams } from './schemas.ts';
import type {
  ExtractInput,
  SearchInput,
  TavilyExtractResponse,
  TavilySearchResponse,
} from './types.ts';

export default (pi: ExtensionAPI) => {
  pi.registerTool({
    description:
      'Search the web using Tavily. Returns relevant results with content snippets, scores, and metadata. Break complex queries into sub-queries for better results.',

    async execute(_toolCallId, params: SearchInput, signal) {
      const data = (await callTavily(
        'search',
        params as Record<string, unknown>,
        signal,
      )) as TavilySearchResponse;

      return {
        content: [{ text: formatSearchResults(data), type: 'text' as const }],
        details: { query: params.query, resultCount: data.results.length },
      };
    },
    label: 'Web Search',
    name: 'web_search',
    parameters: SearchParams,
    promptGuidelines: [
      'Break complex queries into sub-queries — better results than one massive query.',
      'Use include_domains to focus on trusted sources.',
      'Use time_range for recent information.',
    ],
    promptSnippet: 'Search the web for information on any topic',
  });

  pi.registerTool({
    description:
      'Extract content from specific URLs using Tavily. Returns clean markdown/text from web pages. Max 20 URLs per request.',

    async execute(_toolCallId, params: ExtractInput, signal) {
      const data = (await callTavily(
        'extract',
        params as Record<string, unknown>,
        signal,
      )) as TavilyExtractResponse;

      return {
        content: [{ text: formatExtractResults(data), type: 'text' as const }],
        details: {
          failedCount: data.failed_results.length,
          successCount: data.results.length,
          urlCount: params.urls.length,
        },
      };
    },
    label: 'Web Extract',
    name: 'web_extract',
    parameters: ExtractParams,
    promptGuidelines: [
      'Try basic extract_depth first, fall back to advanced if content is missing (JS-rendered pages).',
      'Use query + chunks_per_source to get only relevant content — avoids context bloat.',
      'Check failed_results in the response for URLs that could not be extracted.',
    ],
    promptSnippet: 'Extract content from specific URLs as clean markdown/text',
  });
};
