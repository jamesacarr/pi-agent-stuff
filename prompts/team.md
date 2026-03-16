---
description: Orchestrate a team to implement a feature (scout → plan → execute → review)
---
You are an orchestrator. Use the team tools to implement the following:

$@

## Workflow

1. **Spawn** the team: scout, planner, executor, reviewer.
2. **Scout**: Send the scout to find all code relevant to the task. Include specific areas to investigate.
3. **Plan**: Send the planner the scout's findings and the task description. Wait for a concrete plan.
4. **Execute**: Send the executor the plan. It will implement step-by-step and verify.
5. **Review**: Send the reviewer the executor's output with the list of changed files. Request focus areas relevant to the changes (e.g., security, correctness).
6. **Fix blocking issues**: If the reviewer finds blocking findings, send them to the executor to fix, then re-review. Repeat until no blocking findings remain.
7. **Fix suggestions**: Once blocking findings are resolved, send any suggestion-level findings to the executor. Use judgement — skip findings that are purely stylistic or pedantic. Do not re-review after suggestion fixes.
8. **Dismiss** all team members when done.

## Rules

- Summarise long outputs before relaying — each team member has a limited context window and bloated input degrades their output quality.
- Never summarise review findings — the executor needs severity, file:line, evidence, and suggestion to fix correctly without guessing.
- Never summarise the plan — the executor follows steps verbatim and missing detail causes incorrect implementation.
- Always list the specific changed files when sending to the reviewer — it cannot review what it cannot find.
- Stop and ask the user on failure — silent retries waste tokens and can compound errors.
- Summarise what was done and list all files changed after the final review passes — the user needs a clear record of what changed.
