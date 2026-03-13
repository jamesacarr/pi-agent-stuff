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
| [debug-code](skills/debug-code/) | Systematic root-cause investigation for bugs and failures |
| [frontend-design](skills/frontend-design/) | Influences frontend output towards distinctive, production-grade design |
| [gh](skills/gh/) | Manages GitHub PRs, issues, and CI runs using the gh CLI |
| [glab](skills/glab/) | Manages GitLab merge requests using the glab CLI |
| [jira](skills/jira/) | Manages Jira issues, epics, sprints, and boards using jira-cli |
| [test](skills/test/) | Enforces test quality — behavioural assertions, minimal mocking, descriptive naming |
| [test-driven-development](skills/test-driven-development/) | Enforces RED-GREEN-REFACTOR TDD process discipline |
| [upgrade-dependencies](skills/upgrade-dependencies/) | Safe, atomic dependency upgrades in JavaScript projects |
| [web-extract](skills/web-extract/) | Extract content from specific URLs via Tavily |
| [web-search](skills/web-search/) | Search the web via Tavily |

## Extensions

| Extension | Description |
|-----------|-------------|
| [access-control](extensions/access-control/) | Blocks dangerous commands and protects sensitive files |
| [answer](extensions/answer/) | `/answer` command — extracts questions from assistant responses into interactive Q&A |
| [context](extensions/context/) | `/context` command — shows loaded extensions, skills, context window usage, and session costs |
| [notify](extensions/notify/) | Plays a sound when the agent finishes and is waiting for input |
| [redact-output](extensions/redact-output/) | Redacts sensitive values from tool output |
| [session-breakdown](extensions/session-breakdown/) | `/breakdown` command — shows token usage and cost breakdown for the current session |

## Development

```bash
pnpm install
pnpm lint         # Lint and format
pnpm typecheck    # Type checking
pnpm test         # Run tests
```
