import type { Static } from '@sinclair/typebox';

import type { ExtractParams, SearchParams } from './schemas.ts';

export type SearchInput = Static<typeof SearchParams>;
export type ExtractInput = Static<typeof ExtractParams>;

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
}

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results: Array<{ url: string; error: string }>;
}
