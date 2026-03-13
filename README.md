# pi-agent-stuff

Skills and extensions for the [pi coding agent](https://github.com/badlogic/pi-mono).

## Installation

Add as a pi package in your settings:

```json
{
  "packages": ["git:github.com/jamesacarr/pi-agent-stuff"]
}
```

Or clone locally and point to it:

```json
{
  "extensions": ["./path/to/pi-agent-stuff/extensions"],
  "skills": ["./path/to/pi-agent-stuff/skills"]
}
```

## Skills

| Skill | Description |
|-------|-------------|
| [author-skill](skills/author-skill/) | Creates, edits, audits, and upgrades Agent Skills |
| [glab](skills/glab/) | Manages GitLab merge requests using the glab CLI |
| [jira](skills/jira/) | Manages Jira issues, epics, sprints, and boards using jira-cli |

## Extensions

| Extension | Description |
|-----------|-------------|
| [context](extensions/context/) | `/context` command — shows loaded extensions, skills, context window usage, and session costs |

## Development

```bash
pnpm install
pnpm typecheck    # Type checking
pnpm lint         # Lint and format
pnpm test         # Run tests
```
