# Create New Skill

> Create a new skill from scratch, tested with inline verification before shipping.

## Goal

Produce a validated skill that demonstrably provides useful guidance. Gather requirements, choose structure, write content, verify, and validate.

## Prerequisites

Read references/skill-structure.md and references/writing-effective-skills.md before starting.

## Steps

### Step 1: Requirements Gathering

**If user provided context** (e.g., "build a skill for X"):
→ Analyse what's stated, what can be inferred, what's unclear
→ Skip to asking about genuine gaps only

**If the conversation already contains a workflow** (e.g., "turn this into a skill"):
→ Extract from conversation history: tools used, sequence of steps, corrections made, input/output formats observed
→ Infer structure, scope, and skill type from extracted context
→ Only ask about genuine gaps

**If user just invoked skill without context:**
→ Ask what they want to build

Ask 2–4 domain-specific questions based on actual gaps:
- "What specific operations should this skill handle?"
- "Should this also handle [related thing] or stay focused on [core thing]?"
- "Task-execution skill, tool-usage skill (CLI/MCP), or domain expertise skill?"

After initial questions, ask: "Ready to proceed, or should I ask more questions?"

### Step 2: Decide Structure

| Type | Criteria | Template |
|------|----------|----------|
| Tool skill | Teaches use of a CLI or MCP server | templates/tool-skill-template.md |
| Simple skill | Single workflow, <200 lines | templates/simple-skill-template.md |
| Complex skill | Multiple workflows or domain knowledge | templates/router-skill-template.md (see references/skill-structure.md) |

### Step 3: Write Skill Files

Create the skill directory and write all files:

```bash
mkdir -p {skills-dir}/{skill-name}
# If router pattern:
mkdir -p {skills-dir}/{skill-name}/{workflows,references}
```

Read the chosen template before writing. Follow references/skill-structure.md for frontmatter rules and heading conventions.

Self-review before proceeding:
- Does every instruction explain WHY, not just WHAT?
- Could any section be misinterpreted by a model following it literally?
- Is anything repeated across files?

### Step 4: Inline Verification

Walk through 2–3 realistic scenarios that a user might bring to this skill. **Make test prompts messy and specific like real user input** — include file paths, personal context, company names, casual speech, typos, abbreviations, and backstory. Clean abstract prompts like "Format this data" test nothing; a real user writes "ok so my boss sent me this xlsx file and she wants me to add a column showing profit margin as a percentage, revenue is in column C and costs in column D i think".

For each scenario:
1. Read the skill as if encountering it for the first time
2. Trace through the instructions — are they clear and complete?
3. Check for gaps: what would go wrong if the model followed these instructions literally?
4. Check for ambiguity: are there decision points without clear guidance?

Fix any issues found before proceeding.

### Step 5: Validation

Run the validation checklist:
1. **Frontmatter** — name matches directory, description includes capability + trigger, ≤64 char name, ≤1024 char description
2. **Structure** — headings match template, no XML tags
3. **Token efficiency** — run checklist from references/token-efficiency.md against all files
4. **Description quality** — would the description correctly trigger this skill and not trigger for unrelated requests?

### Step 6: Completion Report

Present:
- Files created and their purposes
- Verification results: scenarios checked, issues found and fixed
- Any remaining items requiring user attention

## Rollback

Delete the skill directory: `rm -r {skills-dir}/{skill-name}/`
