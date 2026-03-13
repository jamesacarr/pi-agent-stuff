---
name: web-search
description: Search the web using Tavily's LLM-optimised search API. Returns relevant results with content snippets, scores, and metadata. Use when you need to find web content on any topic without writing code.
---

## Quick Start

```bash
scripts/search.sh '{"query": "your search query"}'
```

## Examples

```bash
# Basic search
scripts/search.sh '{"query": "python async patterns"}'

# Recent results with domain filter
scripts/search.sh '{"query": "AI news", "time_range": "week", "include_domains": ["arxiv.org", "github.com"], "search_depth": "advanced"}'

# Full page content included
scripts/search.sh '{"query": "React hooks tutorial", "max_results": 3, "include_raw_content": true}'
```

## Key Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | Required | Search query (keep under 400 chars) |
| `max_results` | integer | 10 | Maximum results (0-20) |
| `search_depth` | string | `"basic"` | `basic` for general use, `advanced` for precision |
| `time_range` | string | null | `day`, `week`, `month`, `year` |
| `include_domains` | array | [] | Restrict to these domains |
| `exclude_domains` | array | [] | Exclude these domains |
| `include_raw_content` | boolean | false | Include full page content |

Run `scripts/search.sh` with no arguments for the full parameter list.

## Tips

- Break complex queries into sub-queries — better results than one massive query
- Use `include_domains` to focus on trusted sources
- Use `time_range` for recent information
- Filter by `score` (0-1) in the response to get highest relevance results

## When to Use Another Skill

| Need | Skill |
|------|-------|
| Have specific URLs, need their content | `web-extract` |
