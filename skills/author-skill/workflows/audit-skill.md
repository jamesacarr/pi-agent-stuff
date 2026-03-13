# Audit Skill

> Audit a skill's structure, content quality, and instruction effectiveness, producing a report with severity ratings and actionable fixes.

## Goal

Produce an audit report covering structural compliance, instruction quality, token efficiency, and coverage gaps — then fix issues found.

## Steps

### Step 1: Select Skill

```bash
ls {skills-dir}/
```

Present as numbered list, ask: "Which skill would you like to audit?"

### Step 2: Read Everything

Read SKILL.md and all supporting files (workflows/, references/, templates/, scripts/). Build a complete picture before assessing.

### Step 3: Structural Audit

Check against references/skill-structure.md:

| Check | What to verify |
|-------|----------------|
| Frontmatter | `name` matches directory, `description` present with capability + trigger, ≤64 char name, ≤1024 char description |
| Name format | Lowercase, hyphens only, no leading/trailing/consecutive hyphens |
| Headings | Match template for skill type (simple/tool/router) |
| Format | No XML tags, pure Markdown |
| Router structure | If router: has `## Intake`, `## Routing`, workflows/ and references/ directories |
| File depth | References one level deep from SKILL.md (no nesting) |
| Cross-references | All referenced files exist, no broken paths |

### Step 4: Content Quality Review

Check against references/writing-effective-skills.md and references/anti-patterns.md:

| Check | What to verify |
|-------|----------------|
| Why over what | Instructions explain reasoning, not just mandates |
| Authority paired | Any MUST/NEVER language includes the "because" |
| No filler | No hedging, meta-commentary, or obvious statements |
| No duplication | Same instruction doesn't appear in multiple files |
| Examples | Minimal, non-redundant (one per concept) |
| Tables over prose | Decision logic uses tables, not if/then paragraphs |
| Description quality | Includes both capability and trigger; no workflow summary |

### Step 5: Coverage Gap Analysis

Identify scenarios the skill should handle but doesn't:
- What happens at each decision point — is the guidance clear?
- Are there edge cases without instructions?
- Are there error scenarios without recovery guidance?
- Does the skill handle the "unhappy path"?

### Step 6: Token Efficiency Review

Run the checklist from references/token-efficiency.md against all files.

### Step 7: Produce Report

```
## Audit Report: {skill-name}

### Assessment
[1-2 sentence verdict]

### Critical Issues
[Findings rated Critical or High — must fix]

1. **[Title]** — file:line — {Critical|High}
   - Current: [what exists]
   - Should be: [what's correct]
   - Why: [impact]
   - Fix: [specific action]

### Recommendations

| # | Title | Severity | Location | Current | Recommendation | Benefit |
|---|-------|----------|----------|---------|----------------|---------|

### Gaps

| # | Scenario | Location | Impact | Suggestion |
|---|----------|----------|--------|------------|

### Strengths
- [Specific strength with file:line]

### Summary
- Skill type: [simple / router / tool]
- Lines: [SKILL.md] / [total all files]
- Critical issues: [count]
- Recommendations: [count]
- Gaps: [count]
```

### Step 8: Auto-Fix

Apply fixes for issues found:
- **Structural fixes** (formatting, missing headings, frontmatter): apply directly
- **Content fixes** (wording, duplication, filler): rewrite following references/writing-effective-skills.md
- **Gap fixes** (missing instructions): add minimal coverage

After applying fixes, re-read modified files to verify the fixes don't introduce new issues.

Present: list of fixes applied with file references. Ask user only if a fix is ambiguous or could change the skill's behaviour significantly.

## Validation

Verify the report includes all required sections. Confirm all critical issues have been addressed or flagged for user attention.

## Rollback

Audits start read-only. If fixes were applied and introduced regressions, revert via git.
