---
name: upgrade-dependencies
description: "Guides safe, atomic dependency upgrades in JavaScript projects. Use when upgrading packages, migrating major versions, or fixing security vulnerabilities in npm/yarn/pnpm/bun projects."
---

# Upgrade Dependencies

## Essential Principles

**1. One dependency, one commit.** Every package upgrade gets its own atomic commit. No batching, no grouping "low-risk" patches together. This enables `git bisect`, clean reverts, and clear failure attribution.

**2. Research with real sources.** Use the `web-search` skill (see ../web-search/SKILL.md) to fetch current changelogs and migration guides. NEVER rely on training data for version-specific details — it may be stale or wrong.

**3. Verify after every single upgrade.** Run the full verification suite after each individual package upgrade. Stop on first failure — fix before proceeding.

**Verification suite (run in order):**
1. Type check: `tsc --noEmit` (skip if no tsconfig.json)
2. Tests: project's test runner
3. Build: project's build command
4. In monorepos: run across ALL affected workspaces

**4. Detect, don't assume.** Auto-detect package manager, monorepo structure, test runner, and build tool from the project before starting.

**5. Match the project's commit convention.** Scan `git log --oneline -50` and any `commitlint.config.*` for prior dependency commits. If none is obvious, default to `build(deps): ...` — `build` is a Conventional Commits type and `(deps)` is the scope Dependabot and Renovate use. Workflow commit steps show default formats; substitute the detected convention when it differs. If history is mixed, pick the most recent form; ask if still unclear.

**6. Prompt before creating a branch.** The user may already be on a suitable branch. Offer a suggested name from the workflow and wait for confirmation.

## Intake

Detect upgrade type from user context. If ambiguous, ask:

"What kind of dependency work?"
1. **Major migration** — upgrading to a new major version with breaking changes
2. **Routine upgrades** — updating outdated packages to latest
3. **Security patches** — fixing vulnerabilities from audit

## Routing

| Signal | Workflow |
|--------|----------|
| Specific package + major version (e.g., "upgrade React to 19") | workflows/major-migration.md |
| "update dependencies", "npm outdated", general maintenance | workflows/routine-upgrades.md |
| "security", "vulnerability", "audit", "CVE" | workflows/security-patches.md |
| Ambiguous | Ask user using intake question |

## Anti-Patterns

| Rationalization | Reality |
|---|---|
| "Batch patches — they're low risk" | Atomic commits let you bisect ANY failure. 30 extra seconds per commit prevents hours of debugging. |
| "Individual commits pollute history" | Bisectable history is a feature. Squash-merge PRs for compact history. |
| "I know this version's changes" | Training data is stale. Fetch current changelogs via `web-search`. |
| "@types updates are minor" | `@types/react` 18→19 is breaking. Always check what library version the types target, not @types semver. |
| "Tests passed, skip the build" | Build catches bundling, tree-shaking, and runtime import errors that tests miss. |
| "Update everything at once, fix later" | When 50 tests fail after upgrading 10 packages, you cannot attribute failures. |
| "These are related, upgrade together" | Even related packages (react + react-dom) get separate commits unless they MUST be upgraded simultaneously to avoid broken intermediate states. |

## Risk Classification

Classify each package before upgrading:

| Risk | Criteria | Research Required |
|------|----------|-------------------|
| Patch | `x.y.Z` bump only | None |
| Minor | `x.Y.z` bump | Skim changelog via `web-search` |
| Major | `X.y.z` bump | Full migration guide via `web-search` |
| **@types** | Check the TYPED library's version, not @types semver | Match the typed library's risk level |

**Edge case:** `@types/react@19` targets React 19 and contains breaking type changes — it is MAJOR risk even though it looks like a type definition update.

## Success Criteria

- Every upgraded dependency has its own atomic commit
- Changelogs/migration guides fetched via `web-search` for all minor+ upgrades
- Verification suite passed after each individual upgrade
- Monorepo workspaces handled correctly (if applicable)
- No batch upgrades of unrelated packages

## Workflows

| Workflow | Purpose |
|----------|---------|
| major-migration.md | Major version upgrades with breaking changes |
| routine-upgrades.md | Updating outdated packages to latest versions |
| security-patches.md | Fixing security vulnerabilities from audit |
