---
name: web-extract
description: Extract content from specific URLs using Tavily's extraction API. Returns clean markdown/text from web pages. Use when you have specific URLs and need their content without writing code.
---

## Quick Start

```bash
scripts/extract.sh '{"urls": ["https://example.com/article"]}'
```

## Examples

```bash
# Single URL
scripts/extract.sh '{"urls": ["https://docs.python.org/3/tutorial/classes.html"]}'

# Multiple URLs with query focus (returns only relevant chunks)
scripts/extract.sh '{"urls": ["https://example.com/docs"], "query": "authentication API", "chunks_per_source": 3}'

# JavaScript-heavy pages
scripts/extract.sh '{"urls": ["https://app.example.com"], "extract_depth": "advanced", "timeout": 60}'
```

## Key Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `urls` | array | Required | URLs to extract (max 20) |
| `query` | string | null | Reranks chunks by relevance to this query |
| `chunks_per_source` | integer | 3 | Chunks per URL (1-5, requires `query`) |
| `extract_depth` | string | `"basic"` | `basic` for static pages, `advanced` for JS-rendered |
| `format` | string | `"markdown"` | `markdown` or `text` |
| `timeout` | float | varies | Max wait (1-60 seconds) |

Run `scripts/extract.sh` with no arguments for the full parameter list.

## Tips

- Try `basic` first, fall back to `advanced` if content is missing (JS-rendered pages)
- Use `query` + `chunks_per_source` to get only relevant content — avoids context bloat
- Check `failed_results` in the response for URLs that couldn't be extracted
- Max 20 URLs per request — batch larger lists into multiple calls

## When to Use Another Skill

| Need | Skill |
|------|-------|
| Don't have specific URLs, need to find content | `web-search` |
