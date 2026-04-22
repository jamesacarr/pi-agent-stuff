# Security Patches

> Fix security vulnerabilities identified by package manager audit, one CVE at a time.

## Goal

Remediate all high/critical security vulnerabilities with atomic commits per CVE, verified after each fix.

## Prerequisites

- Clean git state (no uncommitted changes)
- `web-search` skill available for CVE research

## Steps

### Step 1: Pre-flight

1. Detect package manager and monorepo structure
2. **Detect commit convention** (see SKILL.md principle 5)
3. **Ask before branching** (see SKILL.md principle 6). Suggested name: `deps/security-patches-<YYYY-MM-DD>`.

### Step 2: Audit

1. Run security audit:
   ```bash
   pnpm audit
   yarn audit
   npm audit
   ```
2. Parse findings into a table:

   | Severity | Package | Current | Fixed In | CVE | Direct/Transitive | Workspaces |
   |----------|---------|---------|----------|-----|-------------------|------------|
   | *(fill per finding)* | | | | | | |

3. Group findings by CVE — one CVE = one remediation unit

### Step 3: Research

For each CVE (**use the `web-search` skill — not training data**):

1. Confirm the fix version actually addresses the CVE (check changelog/advisory)
2. For **direct deps:** verify the fix version is compatible with the project
3. For **transitive deps:** find which parent package pulls it in:
   ```bash
   pnpm why <vulnerable-package>
   ```
4. Determine fix strategy:

   | Situation | Strategy |
   |-----------|----------|
   | Direct dependency | Upgrade the package |
   | Transitive — parent has update | Upgrade the parent package |
   | Transitive — no parent update | Use `overrides` (pnpm/npm) or `resolutions` (yarn) |

### Step 4: Remediate

For each CVE (ordered by severity, highest first):

1. Apply the fix (upgrade or override)
2. In monorepos: apply across ALL affected workspaces
3. Run verification suite for affected workspaces
4. Run `<pm> audit` to confirm the specific CVE is resolved
5. Commit using the convention detected in Step 1. Default format: `fix(security): resolve <CVE-ID> — upgrade <package> to <version>`.

   `fix(security)` is a project-agnostic Conventional Commits format. Some projects use `fix(deps)` for security fixes; follow the detected convention.


**On unfixable CVE:** Document the blocker, inform the user, and move to the next CVE. Do not force upgrades that break the build.

**One CVE per commit.** Multiple packages may share a commit if they all address the same CVE.

### Step 5: Final Validation

1. Full `<pm> audit` — should report zero high/critical findings
2. Full verification suite across all workspaces
3. Start dev server — manual smoke test
4. If compliance context (SOC 2, etc.): document remediations with CVE IDs and fix versions for audit trail

## Validation

- Every CVE has its own atomic commit
- Fix versions confirmed via real sources (not training data)
- Verification suite passed after each remediation
- `<pm> audit` shows zero high/critical findings

## Rollback

Revert individual CVE fixes: `git revert <commit-hash>`. If a security fix introduced a regression, revert and research alternative remediation (e.g., different fix version, override strategy).
