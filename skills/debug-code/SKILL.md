---
name: debug-code
description: Guides systematic root-cause investigation for bugs and failures. Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes.
---

## Essential Principles

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## Quick Start

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed the Root Cause Investigation step, you cannot propose fixes. Complete each phase before proceeding to the next.

| Phase | Key Activities | Output |
|-------|---------------|--------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## When to Use

Use for ANY technical issue: test failures, bugs, unexpected behavior, performance problems, build failures, integration issues.

**Use ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- You don't fully understand the issue

## Process

### Step 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings — they often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably? What are the exact steps?
   - Does it happen every time?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences

4. **Gather Evidence in Multi-Component Systems**

   **WHEN system has multiple components (CI → build → signing, API → service → database):**

   For EACH component boundary, add diagnostic logging:
   - What data enters the component
   - What data exits the component
   - Environment/config propagation
   - State at each layer

   Run once → analyse evidence showing WHERE it breaks → investigate that specific component.

5. **Trace Data Flow**

   **WHEN error is deep in call stack:**

   See `references/root-cause-tracing.md` for the complete backward tracing technique.

### Step 2: Pattern Analysis

**Find the pattern before fixing:**

1. **Find Working Examples** — Locate similar working code in same codebase
2. **Compare Against References** — Read reference implementation COMPLETELY, don't skim
3. **Identify Differences** — List every difference between working and broken, however small
4. **Understand Dependencies** — What components, settings, config, environment does this need?

### Step 3: Hypothesis and Testing

**Scientific method:**

1. **Form Single Hypothesis** — State clearly: "I think X is the root cause because Y"
2. **Test Minimally** — SMALLEST possible change, one variable at a time
3. **Verify Before Continuing** — Worked? → Next step. Didn't work? → NEW hypothesis, don't add more fixes on top
4. **When You Don't Know** — Say "I don't understand X." Don't pretend to know.

### Step 4: Implementation

**Fix the root cause, not the symptom:**

1. **Create Failing Test Case** — Simplest reproduction, automated if possible. Use the `test-driven-development` skill (see ../test-driven-development/SKILL.md).

2. **Implement Single Fix** — ONE change addressing root cause. No "while I'm here" improvements.

3. **Verify Fix** — Test passes? No other tests broken? Issue resolved?

4. **If Fix Doesn't Work**
   - Count fixes attempted
   - If < 3: Return to Root Cause Investigation with new information
   - **If ≥ 3: STOP and question the architecture (item 5)**

5. **If 3+ Fixes Failed: Question Architecture**

   **Pattern indicating architectural problem:**
   - Each fix reveals new shared state/coupling/problem in different place
   - Fixes require massive refactoring
   - Each fix creates new symptoms elsewhere

   **STOP and question fundamentals:**
   - Is this pattern fundamentally sound?
   - Are we sticking with it through sheer inertia?
   - Should we refactor architecture vs. continue fixing symptoms?

   **Discuss with the user before attempting more fixes.** This is NOT a failed hypothesis — this is a wrong architecture.

6. **If No Root Cause Found After Full Investigation**

   If systematic investigation reveals issue is truly environmental, timing-dependent, or external:
   - Document what you investigated
   - Implement appropriate handling (retry, timeout, error message)
   - Add monitoring/logging for future investigation

   **But:** 95% of "no root cause" cases are incomplete investigation.

## Anti-Patterns

If you catch yourself thinking any of these, **STOP. Return to Root Cause Investigation.**

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- **"I can SEE the bug, I don't need to investigate"**
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals new problem in different place**

**If 3+ fixes failed:** Question the architecture (see Step 4, item 5).

### Watch for These User Redirections

- "Is that not happening?" — You assumed without verifying
- "Will it show us...?" — You should have added evidence gathering
- "Stop guessing" — You're proposing fixes without understanding
- "We're stuck?" (frustrated) — Your approach isn't working

**When you see these:** STOP. Return to Root Cause Investigation.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "I can SEE the bug, no investigation needed" | You see the symptom, not all the callers, edge cases, or recent changes. |
| "User explicitly told me to skip investigation" | User is in pain, not debugging. Your job is to find root cause, not comply with panic. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question pattern, don't fix again. |

## Success Criteria

- Root cause identified with evidence before any fix proposed
- Single hypothesis tested at a time
- Failing test created before implementing fix
- Fix addresses root cause, not symptom
- No bundled "while I'm here" changes
- 3+ failed fixes triggers architectural discussion with user

## References

- **`references/root-cause-tracing.md`** — Trace bugs backward through call stack to find original trigger
- **`references/defense-in-depth.md`** — Add validation at multiple layers after finding root cause
- **`references/condition-based-waiting.md`** — Replace arbitrary timeouts with condition polling
