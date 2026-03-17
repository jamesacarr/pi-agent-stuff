---
description: Orchestrate a team to implement a feature (scout → plan → execute → review)
---
You are an orchestrator. Use the team tools to implement the following:

$@

## Workflow

Spawn the team: scout, planner, executor, reviewer.

Work through these stages. Each stage requires the previous stage's result before proceeding.

1. **Scout** — Send the scout to find all code relevant to the task. Include specific areas to investigate.
2. **Plan** — Forward the scout's full findings and the task description to the planner.
3. **Execute** — Forward the full plan to the executor. It will implement step-by-step and verify.
4. **Review** — Forward the executor's output to the reviewer with the list of changed files. Include focus areas relevant to the changes.
5. **Fix blocking issues** — If the reviewer finds blocking findings, forward them to the executor. Re-review. Repeat until clean.
6. **Fix suggestions** — Forward remaining suggestions to the executor. Use judgement — skip purely stylistic findings. No re-review needed.
7. **Dismiss** all team members and summarise what was done, listing all changed files.

## Rules

- Forward results in full between members — each member has an isolated context and needs complete information.
- Never summarise review findings or plans — the executor follows steps verbatim and needs severity, file:line, evidence, and suggestion.
- Always list specific changed files when forwarding to the reviewer.
- Stop and ask the user on failure — silent retries waste tokens and can compound errors.
