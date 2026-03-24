import { StringEnum } from '@mariozechner/pi-ai';
import { Type } from '@sinclair/typebox';

export const SearchParams = Type.Object({
  exclude_domains: Type.Optional(
    Type.Array(Type.String(), { description: 'Exclude these domains' }),
  ),
  include_domains: Type.Optional(
    Type.Array(Type.String(), { description: 'Restrict to these domains' }),
  ),
  include_raw_content: Type.Optional(
    Type.Boolean({ description: 'Include full page content' }),
  ),
  max_results: Type.Optional(
    Type.Integer({
      default: 10,
      description: 'Maximum results (1-20)',
      maximum: 20,
      minimum: 1,
    }),
  ),
  query: Type.String({ description: 'Search query (keep under 400 chars)' }),
  search_depth: Type.Optional(
    StringEnum(['basic', 'advanced'] as const, {
      description: '"basic" for general use, "advanced" for precision',
    }),
  ),
  time_range: Type.Optional(
    StringEnum(['day', 'week', 'month', 'year'] as const, {
      description: 'Restrict to recent results',
    }),
  ),
});

export const ExtractParams = Type.Object({
  chunks_per_source: Type.Optional(
    Type.Integer({
      description: 'Chunks per URL (1-5, requires query)',
      maximum: 5,
      minimum: 1,
    }),
  ),
  extract_depth: Type.Optional(
    StringEnum(['basic', 'advanced'] as const, {
      description: '"basic" for static pages, "advanced" for JS-rendered',
    }),
  ),
  format: Type.Optional(
    StringEnum(['markdown', 'text'] as const, { description: 'Output format' }),
  ),
  query: Type.Optional(
    Type.String({ description: 'Reranks chunks by relevance to this query' }),
  ),
  timeout: Type.Optional(
    Type.Number({
      description: 'Max wait (1-60 seconds)',
      maximum: 60,
      minimum: 1,
    }),
  ),
  urls: Type.Array(Type.String(), { description: 'URLs to extract (max 20)' }),
});
