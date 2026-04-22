# Bisection

> Binary-search the space of commits, tests, or inputs to isolate a bug. When linear investigation is slow or the surface area is wide, bisection is usually the fastest way to a reproduction.

## When to Use

Three situations, same underlying technique:

| Space to search | Question | Tool |
|-----------------|----------|------|
| Commit history | "Which change broke this?" | `git bisect` |
| Test suite | "Which test creates this side effect?" | `find-polluter.sh` |
| Failing input | "What's the smallest input that still fails?" | Delta debugging |

Use bisection when reading code linearly is slow, when "it used to work" is true, or when a reproduction is too large to reason about.

## Git Bisect — finding the breaking commit

Use when a regression exists between a known-good and a known-bad commit and the window is wide enough that reading each change is expensive.

```bash
git bisect start
git bisect bad                 # current commit is broken
git bisect good <sha>          # last known-good commit
# Git checks out the middle. Run tests or reproduce manually.
git bisect good                # if this commit works
git bisect bad                 # if this commit is broken
# Repeat until git reports the first bad commit.
git bisect reset               # return to HEAD when done
```

**Automate it** with `git bisect run <command>`. The command must exit 0 for good, non-zero for bad, and 125 for "skip this commit" (e.g., build fails):

```bash
git bisect start HEAD <good-sha>
git bisect run npm test -- path/to/failing.test.ts
```

Bisect finishes with the first commit that caused the regression. Inspect it with `git show`.

**Pitfalls:**

- **Flaky test in the range** — a test that fails intermittently will mislead bisect. Use `git bisect skip` or run the test multiple times per step.
- **Build failures in the range** — return exit code 125 from the test script so bisect skips instead of marking bad.
- **Dependency changes in the range** — `git bisect` doesn't reinstall dependencies. Add `npm ci` (or equivalent) to the run command if `package-lock.json` differs.
- **Regression introduced by a merge** — bisect lands on the merge commit. Rerun with `git bisect --first-parent` or inspect the merge's constituent commits manually.

## Test Bisection — finding a polluter

Use when a test fails or leaves unwanted state only when the full suite runs, but passes in isolation. The cause is usually a prior test mutating shared state (filesystem, env vars, module cache, network mocks).

The existing `scripts/find-polluter.sh` runs test files one at a time and stops at the first one that creates the side effect:

```bash
./find-polluter.sh '.git' 'src/**/*.test.ts'
./find-polluter.sh '/tmp/shared.lock' 'packages/**/test/*.test.ts'
```

**When the polluter is found:**

1. Run the suspect test in isolation to confirm it reproduces the pollution
2. Identify which fixture or setup creates the state
3. Add a corresponding teardown (afterEach/afterAll) — the fix is almost always a missing cleanup
4. Pair with `defense-in-depth.md` if the resource is shared across processes (add a process-level guard)

**When the symptom is a failing test rather than a filesystem artifact:** adapt the script to run tests in pairs — `testA followed by testB` — and binary-search the order. Most test runners support this directly (vitest: `--sequence.seed=<n>`; jest: `--testSequencer`).

## Delta Debugging — shrinking a failing input

Use when you have a large failing input (a file, config, payload, HTML page, SQL query) and need to find the minimal subset that still fails. Formalised by Zeller's `ddmin` algorithm.

**Manual process:**

1. Split the input in half
2. Test each half against the failing condition
3. Keep the half that still fails; discard the other
4. Repeat until halves no longer fail when removed
5. Switch to removing smaller chunks until you reach a single-element granularity

**Automate it** with a test harness:

```bash
#!/usr/bin/env bash
# dd.sh <input-file> <test-command>
# test-command must exit 0 if input passes, non-zero if it fails (bug present)
```

Libraries exist for most languages — `creduce` for C/C++, `picireny` / `hdd` for Python, `ddmin` implementations in most debugging toolkits. *The Debugging Book* (`debuggingbook.org`) has a chapter-length treatment and a reusable Python implementation.

**Pitfalls:**

- **Non-determinism** — if the bug only fires intermittently, delta debugging converges on misleading minimal inputs. Stabilise the repro first.
- **Dependencies between parts of the input** — removing one element makes the input malformed before it gets to the buggy code. Split along semantic boundaries (statements, fields, array elements) rather than byte offsets.
- **Parallel runs mutating shared state** — test runs must be independent. Use a fresh temp dir or database per run.

## When to Stop Bisecting

Bisection finds *where*, not *why*. Once it identifies the commit, test, or minimal input:

- **Commit**: read the diff. If the cause is obvious, fix it. If not, run call-chain tracing (`root-cause-tracing.md`) from the change site.
- **Polluter test**: find the missing cleanup. If multiple tests share the resource, consider 5-whys (`5-whys.md`) — the system allowed shared mutable state, not just this one test.
- **Minimal input**: you have a reproduction small enough to reason about. Return to Step 2 (Pattern Analysis) to compare against a known-working input.

Bisection ends where structured debugging resumes. It answers the question "what changed", not "what is wrong".
