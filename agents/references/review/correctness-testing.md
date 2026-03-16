# Correctness & Testing Review Checklist

> Sources: Testing Library Guiding Principles, Kent C. Dodds (Testing Implementation Details, Common Mistakes with RTL, Write Tests), Martin Fowler (Testing Guide, Eradicating Non-Determinism in Tests), CWE database
> Severity: Blocking / Suggestion / Observation
> Updated: 2026-03-11

## 1. Logic Bugs

| # | Item | Severity |
|---|------|----------|
| 1.1 | Off-by-one in loops/slices: `<` vs `<=`, `.slice(0, n)` boundary, array index starts at 0 | Blocking |
| 1.2 | Wrong boolean operators: `&&` vs `\|\|`, De Morgan's law violations (`!a && !b` vs `!(a \|\| b)`) | Blocking |
| 1.3 | Inverted conditions: early returns, guard clauses, ternaries with wrong polarity | Blocking |
| 1.4 | JS falsy traps: `if (value)` when `0` or `""` is valid. `{count && <Component />}` renders `"0"` | Blocking |
| 1.5 | Loose equality (`==`): type coercion traps — `0 == ""`, `null == undefined`, `"" == false` | Suggestion |
| 1.6 | Nullish coalescing vs OR: `??` catches only `null`/`undefined`; `\|\|` catches all falsy values | Blocking |
| 1.7 | Optional chaining misuse: `obj?.prop` returns `undefined` not `null` — downstream handling correct? | Suggestion |
| 1.8 | Incorrect sort: `[].sort()` without comparator sorts as strings (`[10, 2, 1]` → `[1, 10, 2]`) | Blocking |
| 1.9 | Float comparisons: `0.1 + 0.2 !== 0.3` — direct equality on floats | Suggestion |
| 1.10 | Regex anchoring: missing `^`/`$` anchors, greedy vs lazy quantifiers | Suggestion |

## 2. Error Handling

| # | Item | Severity |
|---|------|----------|
| 2.1 | Swallowed errors: empty `catch {}` or `catch(e) { console.log(e) }` in production | Blocking |
| 2.2 | Generic catch-all without discrimination: single `catch` for all error types | Suggestion |
| 2.3 | Missing error states in UI: async operations without error rendering | Blocking |
| 2.4 | Unhandled Promise rejections: `async` called without `await` or `.catch()` | Blocking |
| 2.5 | `fetch()` doesn't reject on 4xx/5xx: `response.ok` not checked | Blocking |
| 2.6 | Re-throwing loses stack trace: `throw new Error("failed")` without `{ cause: e }` | Suggestion |
| 2.7 | try/catch scope too broad: wrapping too much code in a single try block | Suggestion |
| 2.8 | Error boundary gaps (React): new component trees without error boundaries | Suggestion |
| 2.9 | Missing `finally`/cleanup: resources opened in try without cleanup | Blocking |

## 3. Type Safety

| # | Item | Severity |
|---|------|----------|
| 3.1 | Explicit `any` usage: prefer `unknown` then narrow. Flag `as any` casts | Blocking |
| 3.2 | Unsafe type assertions (`as X`): bypasses type checking without runtime validation | Blocking |
| 3.3 | Non-null assertions (`!`): `value!.property` — is the value genuinely never null? | Blocking |
| 3.4 | `typeof x === "object"` doesn't exclude `null` (`typeof null === "object"`) | Blocking |
| 3.5 | Non-exhaustive switches on unions: missing `never` assertion in default case | Suggestion |
| 3.6 | External data typed without runtime validation: API responses, JSON.parse, URL params | Blocking |
| 3.7 | Generic type defaults to `any`: `<T = any>` opts out of type checking | Suggestion |
| 3.8 | Missing return types on exports: accidental return type changes become invisible | Suggestion |

## 4. Edge Cases

| # | Item | Severity |
|---|------|----------|
| 4.1 | Null/undefined at boundaries: API responses, user input, URL params, localStorage | Blocking |
| 4.2 | Empty collections: `.reduce()` without initial value on `[]` throws | Blocking |
| 4.3 | Empty strings: distinguish `""` (cleared) from `undefined` (untouched) | Suggestion |
| 4.4 | Boundary values: first/last element, 0-length, max-length, min/max numeric | Suggestion |
| 4.5 | Date/timezone: `new Date()` uses local tz, date strings parsed inconsistently across browsers | Blocking |
| 4.6 | Unicode: `"😀".length === 2`, RTL text, zero-width characters | Observation |
| 4.7 | Concurrent/duplicate submissions: double-click, rapid navigation, multiple inflight requests | Blocking |
| 4.8 | Large data volumes: O(n²) at 10K items, unbounded list rendering, missing pagination | Suggestion |

## 5. State Management

| # | Item | Severity |
|---|------|----------|
| 5.1 | Race conditions in async state: stale response overwrites fresh one, no abort controller | Blocking |
| 5.2 | Stale closures: missing deps in `useEffect`/`useCallback`/`useMemo` | Blocking |
| 5.3 | Derived state stored separately: computed values in `useState` that should be derived | Suggestion |
| 5.4 | Missing cleanup in effects: no return cleanup for subscriptions, timers, event listeners | Blocking |
| 5.5 | State update on stale state: `setState(count + 1)` vs `setState(prev => prev + 1)` | Suggestion |
| 5.6 | Global state mutation: direct mutation of objects in stores instead of new references | Blocking |
| 5.7 | Optimistic update without rollback: no error handler to revert on failure | Suggestion |
| 5.8 | Incomplete state machine: missing loading/error/success state transitions | Suggestion |

## 6. Breaking Changes

| # | Item | Severity |
|---|------|----------|
| 6.1 | Renamed or removed exports: breaks downstream consumers | Blocking |
| 6.2 | Function signature changes: new required params, changed param order, changed return type | Blocking |
| 6.3 | Changed default values: callers relying on previous defaults see silent behavior change | Suggestion |
| 6.4 | Interface/type modifications: removed properties, changed types, optional → required | Blocking |
| 6.5 | CSS class/selector changes: affects consumers using CSS selectors for styling or testing | Suggestion |
| 6.6 | Event/callback contract changes: when callbacks fire, argument shapes, new required callbacks | Blocking |
| 6.7 | Environment variable renames: affects deployment and infrastructure | Blocking |

## 7. Test Coverage

| # | Item | Source | Severity |
|---|------|--------|----------|
| 7.1 | New behavior has tests: every feature/bugfix/behavioral change needs at least one test | Fowler: self-testing code | Blocking |
| 7.2 | Error paths tested: happy path tested but no test for failure scenarios | Dodds: testing trophy | Blocking |
| 7.3 | Edge cases tested: null, empty, boundary values have explicit test cases | Boundary value analysis | Suggestion |
| 7.4 | Regression test for bug fix: test that fails before fix, passes after | Standard practice | Blocking |
| 7.5 | Deleted/disabled tests justified: `test.skip`, `.only`, commented-out tests need explanation | Fowler: test cancer | Blocking |
| 7.6 | Modified behavior has updated tests: changed behavior → tests reflect new expectations | Test-behavior coupling | Blocking |

## 8. Test Quality

| # | Item | Source | Severity |
|---|------|--------|----------|
| 8.1 | Tests verify behavior, not implementation: assert on user-visible outputs, not internal state | Dodds: "Testing Implementation Details" | Blocking |
| 8.2 | Queries follow Testing Library priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId` | Testing Library Guiding Principles | Suggestion |
| 8.3 | No `container.querySelector` or CSS selectors: bypasses accessibility tree | Dodds: Common Mistakes #8 | Suggestion |
| 8.4 | Minimal mocking: mock only network, timers, external services — not internal modules | Dodds: "Write Tests" | Blocking |
| 8.5 | Use `userEvent` over `fireEvent`: `userEvent` simulates full interaction sequence | Dodds: Common Mistakes #12 | Suggestion |
| 8.6 | Descriptive test names: describe expected behavior, not implementation | BDD principle | Suggestion |
| 8.7 | Specific assertions: `toEqual(expected)` over `toBeTruthy()` — weak assertions hide bugs | Assertion specificity | Suggestion |

## 9. Test Isolation

| # | Item | Source | Severity |
|---|------|--------|----------|
| 9.1 | No shared mutable state between tests: each test sets up its own preconditions | Fowler: non-determinism | Blocking |
| 9.2 | Deterministic: no wall-clock time, no unseeded random, no real network | Fowler: "disease that must be stamped out" | Blocking |
| 9.3 | No real network calls: use MSW, nock, or equivalent | Test isolation principle | Blocking |
| 9.4 | Proper cleanup: restored mocks, cleared timers, reset storage between runs | Test independence | Blocking |
| 9.5 | No implicit environment dependencies: timezone, locale, OS, file system state | CI reproducibility | Suggestion |

## 10. Test Patterns

| # | Item | Source | Severity |
|---|------|--------|----------|
| 10.1 | Explicit assertions: test queries elements but never calls `expect()` | Dodds: Common Mistakes #18 | Blocking |
| 10.2 | No snapshot overuse: prefer targeted assertions. Snapshots test implementation by definition | Dodds, Fowler | Suggestion |
| 10.3 | No side effects in `waitFor`: callback may execute multiple times | Dodds: Common Mistakes #17 | Blocking |
| 10.4 | Use `findBy*` instead of `waitFor` + `getBy*` | Dodds: Common Mistakes #14 | Suggestion |
| 10.5 | Use `queryBy*` for absence assertions: `getBy` throws before the assertion runs | Dodds: Common Mistakes #13 | Suggestion |
| 10.6 | Single assertion per `waitFor`: first failure retries all | Dodds: Common Mistakes #16 | Suggestion |
| 10.7 | Arrange-Act-Assert structure: clear separation of setup, action, verification | Standard pattern | Observation |
