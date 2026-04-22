---
name: debug-code
description: Guides systematic root-cause investigation. Use any time something isn't working and you're about to change code — whether it looks like a bug, a test failure, or just something that needs a quick fix. Load before investigating or changing anything.
---

# Debug Code

## Essential Principles

Random fixes waste time and create new bugs. Quick patches mask underlying issues; the same bug returns in a different form and the next debug session starts from scratch.

**Find root cause before attempting fixes.** If you haven't completed Root Cause Investigation (Step 1), don't propose a fix. Work through the steps in order.

## When to Use

Use for any technical issue: test failures, bugs, unexpected behaviour, performance problems, build failures, integration issues.

**Use especially when:**

- Under time pressure (emergencies make guessing tempting, and guessing is slower)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- You don't fully understand the issue

## Steps

| Step | Key Activities | Output |
|------|---------------|--------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT happened and WHY |
| **2. Pattern** | Find working examples, compare against broken case | Identify differences |
| **3. Hypothesis** | Enumerate causes, test one at a time | Confirmed root cause |
| **4. Implementation** | Create test, fix, verify, clean up | Bug resolved, instrumentation removed |

### Step 1: Root Cause Investigation

1. **Read error messages carefully**
   - Don't skip past errors or warnings — they often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce consistently**
   - Can you trigger it reliably? What are the exact steps?
   - Does it happen every time?
   - If not reproducible: gather more data, don't guess

3. **Check recent changes**
   - `git diff`, `git log`, recent commits
   - `git bisect` if the regression window is wide — binary-search the commit that broke it. See `references/bisection.md`.
   - New dependencies, config changes, environmental differences

4. **Instrument, reproduce, analyse**

   When the cause isn't obvious from existing logs, add diagnostic logging first, then reproduce:
   - What data enters each component or function boundary
   - What data exits
   - State at each layer, including environment variables and config
   - For multi-component systems (CI → build → signing, API → service → database): log at every boundary on one run, then analyse to see WHERE it breaks before investigating WHY

5. **Trace the cause**

   Pick the technique that matches the failure:
   - **Call-chain tracing** — for errors deep in the stack or unclear data origin. See `references/root-cause-tracing.md`.
   - **5-whys** — for recurring bugs, systemic failures, or "why did this ship?" questions where the cause isn't in the code itself. See `references/5-whys.md`.
   - Both can apply: use call-chain to find the immediate technical trigger, then 5-whys to find why the trigger went unguarded.

### Step 2: Pattern Analysis

Compare the broken case to a working one before fixing:

1. **Find working examples** — Locate similar working code in the same codebase. If none exists in-tree, find a reference implementation.
2. **Read references completely** — Don't skim. Partial understanding guarantees bugs.
3. **Identify differences** — List every difference between working and broken, however small. Differential debugging: the delta between working and broken usually contains the cause.
4. **Understand dependencies** — What components, settings, config, environment does this need?

### Step 3: Hypothesis and Testing

1. **Enumerate hypotheses** — List every plausible cause with likelihood (high/medium/low), reasoning, and what evidence would confirm or reject each. Three or more hypotheses prevent tunnel vision. One candidate is usually the first thing you thought of, not the answer.

2. **Test one hypothesis at a time** — Start with the highest-likelihood or cheapest-to-test. Make the smallest possible change, one variable at a time. Parallel changes leave you unable to tell which one produced the new behaviour.

3. **Verify before continuing**
   - Confirmed: move to Step 4.
   - Rejected: update the ledger, pick the next hypothesis. Don't stack fixes on top of unverified ones.
   - Inconclusive: gather more evidence before picking the next hypothesis.

4. **When you don't know** — Say "I don't understand X." Don't pretend to know.

### Step 4: Implementation

Fix the root cause, not the symptom:

1. **Create a failing reproduction** — Simplest reproduction, automated where practical. For binary-correctness bugs, a failing unit test (see `test-driven-development` skill at `../test-driven-development/SKILL.md`). For performance bugs, a benchmark or regression threshold. For intermittent/flaky bugs, a stress loop that reliably triggers the failure. A failing reproduction first proves the fix addresses the real cause and guards against regression.

2. **Implement a single fix** — One change addressing root cause. No "while I'm here" improvements: mixed changes obscure whether the real bug was fixed and make the diff harder to review.

3. **Verify the fix** — Test passes? No other tests broken? Issue resolved in the original reproduction?

4. **Clean up** — Remove debug instrumentation added in Step 1. Leaving it in rots the codebase and pollutes future logs.

5. **If the first fix doesn't work**
   - Count fixes attempted
   - If less than 3: return to Root Cause Investigation with the new information
   - If 3 or more: stop and question the architecture (item 6)

6. **After 3+ failed fixes: question the architecture**

   Pattern indicating an architectural problem rather than a local bug:
   - Each fix reveals new shared state or coupling
   - Fixes require massive refactoring
   - Each fix creates new symptoms elsewhere

   Stop and question fundamentals:
   - Is this pattern fundamentally sound?
   - Are we sticking with it through inertia?
   - Should we refactor the architecture rather than continue patching symptoms?

   Run 5-whys on "why does this keep happening?" (see `references/5-whys.md`) rather than yet another technical hypothesis. Discuss with the user before attempting more fixes. This is not a failed hypothesis; this is a wrong architecture.

7. **If no root cause found after full investigation**

   If systematic investigation reveals the issue is truly environmental, timing-dependent, or external:
   - Document what you investigated
   - Implement appropriate handling (retry, timeout, error message)
   - Add monitoring/logging for future investigation

   But: 95% of "no root cause" cases are incomplete investigation.

## Course-Correction Signals

Specific user phrasing usually means the investigation has gone off-track. Treat each as a signal to stop proposing fixes and return to Step 1:

| User says | Likely meaning |
|-----------|---------------|
| "Is that not happening?" | You asserted behaviour without verifying |
| "Will it show us...?" | You should have added evidence gathering before proposing a fix |
| "Stop guessing" | You're proposing fixes without understanding |
| "We're stuck?" (frustrated) | Your current approach isn't working |

**Self-triggered signal:** after every Step, briefly state what was confirmed, what was ruled out, and what's next. If the investigation has gone 10+ tool calls without a confirmed hypothesis, pause and summarise to the user before continuing — you're likely tunnel-visioning or missing evidence.

## Anti-Patterns

If you catch yourself thinking any of these, stop and return to Root Cause Investigation:

| Excuse | Reality |
|--------|---------|
| "Quick fix for now, investigate later" / "Issue is simple, process not needed" | Process is fast for simple bugs. "Later" investigation rarely happens. |
| "Emergency, no time for process" | Systematic investigation is faster than guess-and-check thrashing. |
| "Just try changing X and see" / "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "Skip the test, I'll manually verify" / "Write the test after the fix works" | Untested fixes don't stick. A failing test first proves the fix addresses the real cause. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" / "Pattern says X but I'll adapt it" | Partial understanding guarantees bugs. Read references completely. |
| "I can see the bug, no investigation needed" / "It's probably X, let me fix that" | You see the symptom, not all the callers, edge cases, or recent changes. |
| "I don't fully understand but this might work" | Untested guesses mask the real cause. Name what you don't understand. |
| "User explicitly told me to skip investigation" | User is in pain, not debugging. Your job is root cause, not compliance with panic. |
| "One more fix attempt" (after 2+ failures) / "Each fix reveals a new problem" | 3+ failures = architectural problem. Question the pattern (Step 4 item 6). |

## Success Criteria

- Root cause identified with evidence before any fix proposed
- Multiple hypotheses enumerated; tested one at a time
- Failing test created before implementing fix
- Fix addresses root cause, not symptom
- Debug instrumentation cleaned up after fix
- No bundled "while I'm here" changes
- 3+ failed fixes triggers architectural discussion with user

## References

- `references/root-cause-tracing.md` — Trace bugs backward through the call stack to find the original trigger
- `references/5-whys.md` — Ask why repeatedly to find systemic/procedural root cause
- `references/bisection.md` — Binary-search commits, tests, or inputs to isolate a bug
- `references/defense-in-depth.md` — Add validation at multiple layers after finding root cause
- `references/condition-based-waiting.md` — Replace arbitrary timeouts with condition polling
- `scripts/find-polluter.sh` — Bisect test files to find which test creates unwanted state
