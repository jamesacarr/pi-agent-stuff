---
name: author-skill
description: Creates, edits, audits, and upgrades Agent Skills (agentskills.io). Use when working with SKILL.md files or skill directories.
compatibility: Requires Pi agent harness with read, write, edit, and bash tools
---

# author-skill

## Essential Principles

1. **Skills are prompts.** Be clear, be direct, use Markdown headings. Only add context the model doesn't already have.
2. **SKILL.md is always loaded.** Keep it lean — details go in workflows/ and references/. Layout: references/skill-structure.md.
3. **Pure Markdown structure.** No XML tags. Standardized headings per template. Anti-patterns: references/anti-patterns.md.
4. **Token efficiency.** Every token loads on every invocation. Say it once, tables over prose, eliminate filler. Checklist: references/token-efficiency.md.
5. **Write for understanding.** Models generalize better from reasoning than mandates — explain why, not just what. Escalate to authority language only when reasoning fails in testing. Details: references/writing-effective-skills.md.
6. **Test before shipping.** After writing or editing a skill, verify it works by walking through realistic scenarios inline. Check that instructions are clear, complete, and unambiguous.

## Intake

Resolve `{skills-dir}` before proceeding. Check cwd for project skill directories first, fall back to global:

| Check | `{skills-dir}` |
|-------|-----------------|
| `.pi/skills/` or `.agents/skills/` exists in cwd or ancestor dirs | That project directory |
| Otherwise | `~/.pi/agent/skills/` or `~/.agents/skills/` |

Announce resolved context (global vs project, resolved path) before proceeding.

What would you like to do?

1. Create a skill
2. Edit a skill
3. Audit a skill
4. Upgrade a simple skill to router pattern

## Routing

| Response | Workflow |
|----------|----------|
| 1, "create", "new", "build" | workflows/create-skill.md |
| 2, "edit", "improve", "modify", "update" | workflows/edit-skill.md |
| 3, "audit", "review", "check" | workflows/audit-skill.md |
| 4, "upgrade", "router", "convert", "split" | workflows/upgrade-to-router.md |
