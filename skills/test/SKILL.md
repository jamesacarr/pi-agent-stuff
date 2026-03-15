---
name: test
description: Enforces test quality — behavioral assertions, minimal mocking, descriptive naming. Use when writing, reviewing, or evaluating any test. Do NOT use for TDD process discipline (use jc:test-driven-development).
---

## Essential Principles

Test what the code does, not what the mocks do.

1. **Real code over mocks.** Mocks hide integration bugs and make tests brittle to refactoring — use real implementations. Mock only external services, non-deterministic inputs, or expensive I/O. If the function under test accepts a callback or dependency — pass a real one.
2. **Assert on behavior, not internals.** Assert on return values, thrown errors, observable side effects. Never assert on call counts, internal state, or framework internals (e.g., `setTimeout` spy).
3. **One behavior per test.** "and" in the test name → split it. Each test verifies one observable outcome.
4. **Names describe behavior.** Test name = what the code does, stated as behavior. Good: `retries 3 times then throws the last error`. Bad: `respects maxAttempts`.
5. **No duplicate coverage.** Two tests proving the same behavior = delete one. Each test must verify something no other test covers.

## Quick Start

Before writing any test, ask:
1. What observable behavior am I testing?
2. Can I test this with real code instead of mocks?
3. Does the test name describe what broke if it fails?

If any answer is unclear, return to `## Essential Principles` before writing the test.

## Process

1. Identify the behavior to test — one observable outcome
2. Name the test as a behavioral sentence
3. Write the test using real code (mock only if forced by external deps/IO)
4. Assert on return values, thrown errors, or observable side effects — not internals
5. Check: does this duplicate an existing test? If yes, delete one
6. Check edge cases: zero/null inputs, boundary values, error paths

## Mock Discipline

**Mock only when you must.** If the function accepts a dependency you can construct, use a real one.

| Situation | Action |
|-----------|--------|
| Function accepts `() => Promise<T>` | Pass a real async function, not `vi.fn().mockResolvedValue()` |
| External HTTP API | Mock the HTTP layer |
| Database in unit tests | Mock the DB client |
| Time-sensitive behavior | Use fake timers only if real timing is impractical (>1s delays) |
| Filesystem in unit tests | Mock or use temp directory |

**Never mock the code under test.** If you mock it, you're not testing it.

**Gate before mocking:** "What happens if I use the real thing?" If nothing bad → don't mock.

**Gate before asserting on a mock:** "Am I testing real behavior or mock wiring?" If mock wiring → delete the assertion.

See `references/testing-anti-patterns.md` for detailed examples.

## Naming

Test names are sentences describing behavior. They should tell you what broke without reading the test body.

| Bad | Good | Why |
|-----|------|-----|
| `respects maxAttempts` | `stops retrying after N failures and throws` | Describes observable behavior |
| `uses default delayMs of 100` | `waits 100ms between retries by default` | States what happens, not which param |
| `test1`, `it works` | `returns the result on first success` | Specific behavior |
| `handles edge case` | `throws immediately when maxAttempts is 0` | Names the edge case |

## Assertions

Assert on observable outcomes. Never on internals.

| Bad | Good | Why |
|-----|------|-----|
| `expect(fn).toHaveBeenCalledTimes(3)` | `expect(attempts).toBe(3)` (where `attempts` is a real counter) | Tests behavior via real code, not mock wiring |
| `expect(setTimeout).toHaveBeenCalledWith(_, 100)` | Test that the function doesn't resolve before the delay elapses | Don't spy on framework internals |
| `expect(internalState.retryCount)` | `expect(result).toBe('success')` | Test outputs, not how the code works |

Assert exact strings, ordering, or formatting only when downstream code parses or depends on the exact bytes. Otherwise use `toContain`, `toMatch`, structural checks, or parsed values.

Don't runtime-test compile-time guarantees. If TypeScript enforces it, use type-test coverage (`expectTypeOf`, `// @ts-expect-error`) — not `expect(typeof x).toBe('string')`.

## Edge Cases

Cover what's relevant — not everything, but don't skip the obvious:
- Empty/null/zero inputs (e.g., `maxAttempts = 0`, `maxAttempts = 1`)
- Boundary values
- Error paths (thrown errors, rejected promises)
- The "just barely succeeds" case (success on last attempt)

## Test Independence

Tests must not depend on execution order or shared mutable state — a test that passes only in sequence hides coupling bugs and breaks parallel runners. Each test creates its own state and cleans up.

## Success Criteria

- [ ] Every test uses real code where possible (mocks only for external deps/IO)
- [ ] No assertions on call counts, spies, or framework internals
- [ ] Each test name describes the behavior that would break
- [ ] No two tests verify the same behavior
- [ ] Edge cases covered (zero, one, boundary, error paths)
- [ ] Tests pass in isolation and in any order

For fixing violations, see `references/testing-anti-patterns.md`.
