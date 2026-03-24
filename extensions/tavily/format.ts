import type { TavilyExtractResponse, TavilySearchResponse } from './types.ts';

export function formatSearchResults(data: TavilySearchResponse): string {
  const lines: string[] = [];

  if (data.answer) {
    lines.push(`**Answer:** ${data.answer}`, '');
  }

  for (const result of data.results) {
    lines.push(`### ${result.title}`);
    lines.push(`**URL:** ${result.url}`);
    lines.push(`**Score:** ${result.score.toFixed(2)}`);
    lines.push('', result.content);

    if (result.raw_content) {
      lines.push('', '**Full content:**', result.raw_content);
    }

    lines.push('', '---', '');
  }

  return lines.join('\n');
}

export function formatExtractResults(data: TavilyExtractResponse): string {
  const lines: string[] = [];

  for (const result of data.results) {
    lines.push(`### ${result.url}`, '', result.raw_content, '', '---', '');
  }

  if (data.failed_results.length > 0) {
    lines.push('**Failed extractions:**');
    for (const fail of data.failed_results) {
      lines.push(`- ${fail.url}: ${fail.error}`);
    }
  }

  return lines.join('\n');
}
