# Writing Effective Skills

> How to write skill instructions that actually change model behaviour. Covers instruction style, content organisation, and self-review.

## Explain Why, Not Just What

The single most impactful thing you can do: explain the reasoning behind every instruction.

Models generalise better from understood principles than from mandates. When given a reason, they adapt the principle to novel situations. When given only a mandate, they follow it literally or rationalise around it.

| Approach | Example | Effect |
|----------|---------|--------|
| **Why-first** (preferred) | "Use semantic commit messages because they make changelogs auto-generatable and help reviewers understand intent at a glance" | Model applies the principle even in edge cases |
| **Authority** (escalation) | "YOU MUST use semantic commit messages" | Model complies literally but may not generalise |

Start with reasoning. Escalate to authority language (MUST/NEVER) only when reasoning alone doesn't change behaviour in testing — and even then, pair it with the why.

## Keep It Lean

Every token in a skill loads on every invocation. After writing a draft:

- Read each section and ask: "If I remove this, does agent behaviour change?" If not, cut it.
- Each iteration should remove as much as it adds.

See references/token-efficiency.md for the full checklist.

## Generalise, Don't Overfit

You'll iterate on a few test cases, but the skill runs on many prompts. Resist fiddly changes that fix one case but narrow the skill. If a stubborn issue persists, try a different framing rather than piling on constraints.

## One Excellent Example

A single well-chosen example teaches the pattern. Three mediocre examples waste tokens repeating the same lesson. Choose the example that covers the most edge cases and shows the reasoning, not just the format.

## Domain Organisation

When a skill supports multiple frameworks or platforms, organise by variant:
```
cloud-deploy/
├── SKILL.md (workflow + selection logic)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```
The model reads only the relevant reference file, keeping context lean.

## Self-Review

After writing or revising skill files, review before finalising:
- Does every instruction explain WHY, not just WHAT?
- Could any section be misinterpreted by a model following it literally?
- Is anything repeated across SKILL.md and workflow/reference files?
- Would removing any sentence change the model's behaviour? If not, remove it.
