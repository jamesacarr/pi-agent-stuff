# Anti-Patterns

> Common mistakes in skill authoring. Covers structural, content, and process anti-patterns.

## Structural Anti-Patterns

- **XML tags in skill files:** Use Markdown headings (`## Objective`) not XML (`<objective>`).
- **Missing required headings:** See references/skill-structure.md for required headings by template type.
- **Deeply nested references:** Keep one level deep from SKILL.md. Models may partially read nested files.
- **Windows paths:** Always forward slashes: `scripts/helper.py` not `scripts\helper.py`.
- **Name mismatch:** Directory name must match frontmatter `name` exactly.

## Content Anti-Patterns

- **Vague description:** "Helps with documents" → "Extracts text and tables from PDF files. Use when working with PDF documents."
- **Workflow in description:** Summarising process in description → model follows description, skips skill body. Use triggering conditions only.
- **Inconsistent POV:** Never "I can help you..." → Always third person: "Processes Excel files."
- **Narrative storytelling:** "In session 2025-10-03, we found..." → Extract the technique, discard the narrative.
- **Multi-language dilution:** One excellent example in the most relevant language. Models can port.
- **Generic labels:** `helper1`, `step3` → Use semantic names.
- **Phase headings instead of steps:** `## Phase 1` → Use `## Step N: Title` inside workflows.
- **Inconsistent heading names:** Use standardised names from references/skill-structure.md.
- **Description missing half:** Only trigger ("Use when...") or only capability ("Guides...") → Always include both.
- **Too many options:** One default approach + escape hatch for special cases.

## Token Waste Anti-Patterns

See references/token-efficiency.md for principles, checklist, and common waste patterns table.

## Process Anti-Patterns

- **Batch creation:** Creating multiple skills without testing each. Stop after writing any skill — verify before moving on.

## Code Examples

Choose most relevant language. Good examples: complete, runnable, commented (WHY not WHAT), from real scenarios. See references/token-efficiency.md principle #5 for compression rules.
