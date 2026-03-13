---
name: skill-name
description: What it does with the tool. Use when trigger conditions. Do NOT use for negative triggers (use other-skill).
---

# Skill Name

## Essential Principles

- **Convention:** Tool-specific conventions and gotchas
- ...

## Prerequisites

```bash
command -v {tool} >/dev/null 2>&1
```

If not found: `{install-command}`.

If the tool requires authentication:

```bash
{tool} auth status
```

If not authenticated: `{auth-command}`.

## Quick Start

```bash
{tool} common-command-1
{tool} common-command-2
```

## {Operation Group 1}

### Step 1: ...

```bash
{tool} subcommand --flag value
```

| Flag | Purpose |
|------|---------|
| `--flag` | What it does |

### Step 2: ...

...

## {Operation Group 2}

### {Named Sub-Operation A}

...

### {Named Sub-Operation B}

...

## Other Operations

| Operation | Command |
|-----------|---------|
| List items | `{tool} list` |

## Success Criteria

- ...
