# 5-Whys Analysis

> Ask "why?" repeatedly to find systemic root cause. Use when the cause isn't in the code itself — it's in the process, tests, or environment that allowed the bug to exist or ship.

## When to Use

Use when call-chain tracing (see `root-cause-tracing.md`) doesn't apply or has run out:

- Bug shipped to production despite review and CI
- Same class of bug keeps recurring
- Step 4 architecture question reached (3+ fixes failed)
- "Why wasn't this caught by tests/review/CI?"
- Integration or process failure, not a pure code bug

Don't use for straightforward technical bugs where call-chain tracing resolves the cause directly.

## Process

Ask "why?" about each answer. Back every answer with **evidence** (a log line, a git blame, a reproduced behaviour), not speculation. Continue until the answer passes all four checks:

- **Specific and actionable** — you can change it, concretely
- **Systemic** — changing it prevents a class of future bugs, not just this one
- **Within your control** — you (or the team) can actually modify it
- **Logically connected** — each step follows from the previous with evidence, no leaps

"5" is a guideline, not a rule. Typical depth is 3-7 levels. Stop when the next "why?" produces no new information or when the answer is outside your control.

## Example

**Symptom:** Production deploy failed because `signed_artifact_hash` was null.

| # | Why? | Answer | Evidence |
|---|------|--------|----------|
| 1 | Why was the hash null? | Signing step wrote an empty file | `signing.log` shows 0-byte output |
| 2 | Why did signing write an empty file? | Source artifact was 0 bytes | `ls -la` on build output, size=0 |
| 3 | Why was the source 0 bytes? | Build step exit code was ignored | Pipeline log: `npm run build` returned 1 but job continued |
| 4 | Why was the exit code ignored? | Pipeline uses `\|\| true` on the build | `ci.yml` line 47: `npm run build \|\| true` |
| 5 | Why `\|\| true`? | Added in 2023 to mask flaky test failures | `git blame` → commit `a3f2b1c`, PR #1247 |

**Surface cause:** null hash. **Root cause:** flaky tests were never fixed, so a workaround was added that now hides all build failures.

**Fix at every level (pair with `defense-in-depth.md`):**

- Level 1-2: validate artifact size before signing
- Level 3-4: fail the pipeline on non-zero build exit; remove `|| true`
- Level 5: fix the original flaky tests

Fixing only level 1 leaves a pipeline that silently ships bad artifacts the next time anything else breaks.

## Pitfalls

- **Stopping at "human error"** — every human error has a system around it. "Why did the system allow the error?" is the next why.
- **Whys that only blame people** — "why did X ship it?" is a dead-end. "Why didn't the process catch it?" is actionable.
- **Ignoring branches** — causes fork. If an answer has multiple plausible whys, record them all and explore each. Don't commit to one branch because it's convenient.
- **Answers without evidence** — if you can't cite a log, diff, or reproduced behaviour for an answer, it's a guess. Verify before continuing down the chain.
- **Stopping too early** — asking only 2-3 whys and calling it done. The first few levels are usually symptoms of symptoms. Push until the answer passes all four validation checks.

## Distinguishing from Call-Chain Tracing

| Technique | Traces | Answers |
|-----------|--------|---------|
| Call-chain (`root-cause-tracing.md`) | Code execution backward through the stack | "What value triggered this?" |
| 5-whys | Causation backward through process, time, decisions | "Why does this class of failure exist?" |

Both can apply to the same bug. Call-chain finds the immediate technical trigger; 5-whys finds why the trigger was allowed to exist unguarded.
