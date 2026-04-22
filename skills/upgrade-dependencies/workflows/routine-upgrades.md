# Routine Upgrades

> Update outdated packages to their latest versions, one at a time, classified by risk.

## Goal

Upgrade all outdated dependencies with atomic commits, ordered by risk (patch → minor → major), with full verification after each.

## Prerequisites

- Clean git state (no uncommitted changes)
- `web-search` skill available for minor+ changelog research

## Steps

### Step 1: Pre-flight

1. **Detect environment:** package manager, monorepo, test runner, build tool
2. **Detect commit convention:** scan `git log --oneline -50` (or any `commitlint.config.*`) for prior dependency commits. Use the project's existing format. If none is obvious, default to `build(deps): ...` (conventional-commits standard, matches Dependabot/Renovate).
3. Verify clean git state
4. Create branch: `git checkout -b deps/routine-upgrades-<YYYY-MM-DD>`
5. Run verification suite to confirm green baseline
6. List outdated packages:
   ```bash
   pnpm outdated --recursive
   yarn outdated
   npm outdated
   ```

### Step 2: Classify and Order

Classify every outdated package using the risk table from SKILL.md.

**Critical edge case:** `@types/*` packages — check the TYPED library's major version, not the @types semver. `@types/react@19` targets React 19 = MAJOR risk.

Order for execution: **patch → minor → major** (lowest risk first).

Within same risk tier, order alphabetically.

### Step 3: Execute Upgrades

Process packages **one at a time.** For each:

1. **Patch:** Upgrade directly. No research needed.
2. **Minor:** Fetch changelog via `web-search`. Skim for notable changes.
3. **Major:** Fetch full migration guide via `web-search`. Review breaking changes.

Then:
1. Upgrade the single package:
   ```bash
   pnpm update <package>@latest --recursive
   ```
2. Apply any required code changes
3. Run verification suite (types → tests → build)
4. **Stop on failure.** Fix the issue before moving to the next package.
5. Commit using the convention detected in Step 1. Default format: `build(deps): upgrade <package> <old> → <new>`

**On unfixable failure:** `git reset --hard HEAD~1` to undo the upgrade. Document why it's blocked (e.g., incompatible peer dep, removed API with no migration path). Skip to next package.

**One package per commit. No batching. No "grouping patches together."**

### Step 4: Final Validation

1. Full verification suite across all workspaces
2. Start dev server — manual smoke test
3. Re-run `<pm> outdated` — confirm no remaining outdated packages (or document intentionally skipped ones)
4. Review commit history: one clean commit per dependency

## Validation

- Every upgraded dependency has its own atomic commit
- Changelogs fetched for all minor+ upgrades
- Verification suite passed after each individual upgrade
- Skipped packages documented with reason

## Rollback

Revert individual upgrades: `git revert <commit-hash>` for any upgrade that causes issues after merging. Atomic commits make this safe — each revert affects exactly one package.
