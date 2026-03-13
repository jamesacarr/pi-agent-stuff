# Upgrade to Router

> Convert a simple single-file skill to the router pattern with workflows and references.

## Goal

Convert a monolithic skill into the router pattern without losing content or degrading behaviour.

## Prerequisites

Read references/skill-structure.md before starting.

## Steps

### Step 1: Select Skill

```bash
ls {skills-dir}/
```

Present numbered list, ask: "Which skill should be upgraded to the router pattern?"

### Step 2: Verify It Needs Upgrading

Read the skill. Check:

| State | Action |
|-------|--------|
| Already a router (has workflows/, `## Intake`, `## Routing`) | Offer to add workflows instead |
| Partial router (has workflows/ but missing intake/routing) | Alert user — offer to audit first or complete the upgrade |
| Under 200 lines, single workflow | Explain router may be overkill, ask if they want to proceed |
| Over 200 lines or multiple use cases | Good candidate — proceed |

### Step 3: Identify Components

Analyse the monolithic SKILL.md and identify:
1. **Essential principles** — rules that apply to ALL use cases (stay in SKILL.md)
2. **Distinct workflows** — different things a user might want to do (extract to workflows/)
3. **Reusable knowledge** — patterns, examples, technical details (extract to references/)

Present the breakdown and ask: "Does this look right?"

### Step 4: Extract and Restructure

Create the directory structure:

```bash
mkdir -p {skills-dir}/{skill-name}/{workflows,references}
```

Write files following these rules:
- **SKILL.md** — rewrite as router: essential principles + intake menu + routing table. Target ~100 lines.
- **workflows/*.md** — each gets a `# Title` + `> summary` entry block, then step-by-step procedure
- **references/*.md** — each gets a `# Title` + `> summary` entry block, then reference content

Use templates/ as structural guides.

### Step 5: Verify Completeness

Compare original against new structure:

| Check | Verify |
|-------|--------|
| Content preserved | All principles, procedures, and knowledge accounted for |
| No orphaned content | Nothing from the original was dropped without reason |
| SKILL.md is lean | Under ~100 lines, routes rather than teaches |
| Cross-references work | All file paths in SKILL.md resolve to real files |
| Headings match templates | Each file follows the appropriate template |

Walk through 2–3 scenarios that exercise different workflows — verify the routing table directs correctly and each workflow is self-contained.

### Step 6: Completion Report

Present:
- New file structure with line counts
- Content mapping (original section → new location)
- Verification results
- Any decisions made during extraction

## Validation

Run the validation checklist from workflows/audit-skill.md Steps 3–6 against the upgraded skill.

## Rollback

Restore original SKILL.md from git, delete the created `workflows/` and `references/` directories:

```bash
git checkout -- {skills-dir}/{skill-name}/SKILL.md
rm -r {skills-dir}/{skill-name}/workflows {skills-dir}/{skill-name}/references
```
