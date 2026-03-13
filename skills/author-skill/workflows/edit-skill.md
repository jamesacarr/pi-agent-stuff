# Edit Existing Skill

> Make a targeted, verified improvement to an existing skill without introducing regressions.

## Goal

Apply a specific change to an existing skill, verify it works, and ensure nothing else broke.

## Prerequisites

Read references/skill-structure.md and references/writing-effective-skills.md before starting.

## Steps

### Step 1: Read Current Skill

Read the existing SKILL.md and all supporting files. Understand:
- Current structure (simple vs router pattern)
- What the skill does
- How the files relate to each other

### Step 2: Identify Changes

Clarify what needs to change:

| Change Type | Approach |
|-------------|----------|
| Bug fix | Skill doesn't work as intended — identify the specific failure |
| Enhancement | Add new capability — check if it fits current structure |
| Structural upgrade | Apply template structure — consider upgrade-to-router workflow instead |
| Bulletproofing | Skill is being rationalised around — strengthen specific instructions |

### Step 3: Apply the Edit

Make the targeted change. Follow these principles:
- **Minimal diff** — change only what's needed
- **Explain why** — if adding a new rule, include the reasoning
- **No duplication** — don't repeat instructions that exist elsewhere in the skill
- **Bundle repeated work** — if you notice the agent keeps writing similar helper scripts when following the skill, that's a signal to bundle the script in `scripts/` and instruct the skill to use it

### Step 4: Verify the Change

1. Re-read the modified files end-to-end — does the change fit naturally?
2. Walk through a scenario that exercises the changed behaviour — are the instructions clear?
3. Walk through an unrelated scenario — did the change break anything?
4. If the change affects the description: verify trigger accuracy — would the description correctly match intended requests and reject unrelated ones?

### Step 5: Validation

Run applicable gates:
1. **Description freshness** — if capabilities changed, update the YAML description
2. **Structure** — headings still match template, no XML tags introduced
3. **Token efficiency** — edit didn't introduce filler, duplication, or verbose prose
4. **Frontmatter** — name still matches directory, description within limits

### Step 6: Completion Report

Present:
- What was changed (files and specific edits)
- Verification results
- Any remaining issues requiring user attention

## Rollback

Revert modified files via git: `git checkout -- {skills-dir}/{skill-name}/`
