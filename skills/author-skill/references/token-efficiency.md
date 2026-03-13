# Token Efficiency

> Every token in a skill loads into context on every invocation — bloat compounds. Skills should be as lean as possible while remaining clear and complete.

## Principles

1. **Every token earns its place.** If removing a sentence doesn't change agent behaviour, remove it.
2. **Say it once.** Never repeat the same instruction in different words. Cross-file duplication (SKILL.md echoing a workflow) is the most common violation.
3. **Prefer structure over prose.** Tables and lists compress information. A 3-column table replaces paragraphs of if/then prose.
4. **Eliminate filler.** Remove: introductory phrases, hedging, obvious statements, meta-commentary about the skill itself.
5. **Compress examples.** One excellent example > three mediocre ones. Show the pattern, not every variation.
6. **Use references for detail.** If a section exceeds 20 lines of specialised content, extract to a reference file.
7. **Headings are free structure.** A `## Validation` heading replaces "The following section covers validation steps:" — saves tokens while improving parseability.

## Checklist

- [ ] No repeated instructions across files
- [ ] No filler phrases or hedging language
- [ ] Tables used where prose would be longer
- [ ] Examples are minimal and non-redundant (one per concept)
- [ ] No obvious statements ("This step is important because...")
- [ ] SKILL.md routes, doesn't re-teach workflow content
- [ ] Inline content that could be a reference is extracted (20+ line threshold)
- [ ] No narrative storytelling or session history
- [ ] Every sentence changes agent behaviour — if removed, output would differ

## Common Waste Patterns

| Pattern | Example | Fix |
|---------|---------|-----|
| Restating the obvious | "This skill helps you create skills" | Delete |
| Double instruction | Rule in SKILL.md AND workflow | Keep in one place, reference from other |
| Verbose conditions | "If the user wants to X, and they have Y, then..." | Table with conditions → actions |
| Example avalanche | 5 examples showing same pattern | Keep best one, delete rest |
| Meta-commentary | "The following section explains how to..." | Delete, let the section speak |
| Defensive hedging | "You might want to consider checking..." | "Check X" |
| History as content | "In our testing we found that..." | Extract the finding, delete the story |
