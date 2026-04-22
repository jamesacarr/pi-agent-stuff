# Major Migration

> Upgrade a package to a new major version with breaking changes, including ecosystem library compatibility.

## Goal

Safely upgrade a core package to a new major version, then upgrade all affected ecosystem libraries, with atomic commits and full verification at each step.

## Prerequisites

- Clean git state (no uncommitted changes)
- `web-search` skill available for migration guide research

## Steps

### Step 1: Pre-flight

1. **Detect environment:**
   - Package manager: check for `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, `package-lock.json` → npm
   - Monorepo: check for `pnpm-workspace.yaml` or `workspaces` in root `package.json`
   - Test runner: check for vitest/jest/mocha config
   - Build tool: check for next.config, vite.config, webpack.config, etc.

2. **Verify clean state:** `git status` must show no uncommitted changes

3. **Detect commit convention:** scan `git log --oneline -50` (or any `commitlint.config.*`) for prior dependency commits. Use the project's existing format. If none is obvious, default to `build(deps): ...` (conventional-commits standard, matches Dependabot/Renovate).

4. **Create branch:** `git checkout -b deps/upgrade-<package>-v<version>`

5. **Run verification suite** to confirm green baseline before changing anything

### Step 2: Research

**MANDATORY: Use the `web-search` skill. Do NOT use training data.**

1. Fetch the official migration guide for the target major version
2. Fetch the changelog — focus on breaking changes
3. Identify all ecosystem libraries that have a peer/direct dependency on the package being upgraded:
   ```bash
   pnpm why <package> --recursive
   yarn why <package>
   npm explain <package>
   ```
4. For each ecosystem library, check compatibility with the new version:

   | Library | Current | Compatible Version | Breaking Changes? |
   |---------|---------|-------------------|-------------------|
   | *(fill per project)* | | | |

5. **Blocker check:** If any critical ecosystem library does NOT support the new version, stop and present resolution options:

   | Strategy | When to Use | Atomic Commits? |
   |----------|-------------|-----------------|
   | **Migrate ecosystem first** — upgrade blocked libraries to compatible versions on the CURRENT core version, then upgrade core | Library's new version works with both old and new core | Yes — each library gets its own commit |
   | **Compatibility bridge** — use official compat mode (e.g., `@vue/compat`) to run new core with old API, then migrate libraries individually | Core package offers a compatibility layer | Yes — bridge first, then one library at a time |
   | **Override peer dependency** — force install with `overrides`/`resolutions`, test thoroughly | Only if runtime compatibility is confirmed via research (not assumed) | Yes — but flag as tech debt to resolve |
   | **Wait** — defer upgrade until ecosystem catches up | No viable migration path exists | N/A |

   **Never recommend batching multiple library migrations into a single commit to "avoid broken intermediate states."** If no atomic path exists, present the tradeoffs and let the user choose.

### Step 3: Upgrade Core Package

1. Upgrade the core package across all workspaces:
   ```bash
   pnpm update <package>@<version> --recursive
   yarn upgrade <package>@<version> -W
   npm install <package>@<version> --workspaces
   ```
2. Upgrade associated types if applicable (e.g., `@types/react@19`)
3. Run verification suite (types → tests → build)
4. Fix any breaking changes identified in research
5. Commit using the convention detected in Step 1. Default format: `build(deps): upgrade <package> to v<version>`

**Core package + its types may share one commit ONLY if they must be upgraded simultaneously to avoid a broken intermediate state.**

### Step 4: Upgrade Ecosystem Libraries

For each ecosystem library needing an update (order: lowest-risk first):

1. **Research** the library's changelog via `web-search`
2. Upgrade the single library
3. Apply any required code changes (API changes, renamed imports, etc.)
4. Run verification suite
5. Fix any issues
6. Commit using the convention detected in Step 1. Default format: `build(deps): upgrade <library> to v<version> for <core>@<version> compat`

**One library per commit. No exceptions.**

### Step 5: Final Validation

1. Full verification suite across all workspaces
2. Start dev server — manual smoke test
3. `git log --oneline` — confirm clean, atomic commit history
4. Inform user of completed upgrades and any remaining items

## Validation

- Every package has its own atomic commit
- Migration guide was fetched from real sources (not training data)
- Verification suite passed after each step
- No batched commits of unrelated packages

## Rollback

On unfixable failure at any step: `git reset --hard HEAD~1` to undo the last upgrade. Document the blocker (incompatible library, missing migration path) and inform the user before skipping to the next package.
