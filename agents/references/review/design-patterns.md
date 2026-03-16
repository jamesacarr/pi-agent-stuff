# Design & Patterns Review Checklist

> Sources: Martin Fowler (Refactoring catalog, Code Smells taxonomy), Refactoring Guru (22 smells, 5 categories), Robert C. Martin (SOLID), Sandi Metz ("The Wrong Abstraction")
> Severity: Blocking / Suggestion / Observation
> Updated: 2026-03-11
>
> **Meta-principle:** Pattern violations should only be flagged when they cause concrete problems, not because they violate a rule in the abstract. Always check whether the existing codebase follows the pattern before flagging a deviation. Consistency with the codebase trumps theoretical best practice.

## 1. Naming & Conventions

| # | Item | Source | Severity |
|---|------|--------|----------|
| 1.1 | Names reveal intent: can you understand what it does without reading the implementation? Flag `data`, `info`, `temp`, `result`, `handle` | Fowler: Rename Variable | Suggestion |
| 1.2 | Naming consistent with surrounding code: same casing, prefixes, verb/noun patterns as codebase | Pragmatic principle | Suggestion |
| 1.3 | Boolean names read as predicates: `isX`, `hasX`, `canX`, `shouldX` — not `flag`, `status` | Industry convention | Suggestion |
| 1.4 | Function names describe action or query. Names that hide side effects are Blocking | Fowler: Separate Query from Modifier | Suggestion / Blocking |
| 1.5 | Magic literals extracted to named constants | Fowler: Replace Magic Literal | Suggestion |
| 1.6 | Abbreviations are project-standard or universally understood (`ctx`, `req` ok; `cstmrAcctBal` not) | Pragmatic principle | Suggestion |

## 2. DRY & Duplication

| # | Item | Source | Severity |
|---|------|--------|----------|
| 2.1 | Identical logic in 3+ places: Rule of Three — extract | Fowler: Duplicate Code smell | Blocking at 3+ |
| 2.2 | Near-duplicate code with slight variations: can often be parameterized | Fowler: Parameterize Function | Suggestion |
| 2.3 | Data clumps: same 3+ fields passed together across multiple function signatures | Fowler: Data Clumps smell | Suggestion |
| 2.4 | Don't extract coincidental duplication: two blocks that look similar but represent different domain concepts should stay separate. "Duplication is far cheaper than the wrong abstraction" | Sandi Metz | Observation |
| 2.5 | Bug fixed in one copy but not others: if duplication exists and a fix is applied to only one instance | Logical consequence | Blocking |

## 3. Separation of Concerns

| # | Item | Source | Severity |
|---|------|--------|----------|
| 3.1 | Business logic in UI/presentation layer: domain rules, validation, calculations in components | Fowler: layering | Blocking if untestable |
| 3.2 | Infrastructure in domain logic: DB queries, HTTP calls, file I/O directly in business functions | SOLID: DIP | Blocking if prevents testing |
| 3.3 | Formatting/display logic mixed with data processing | SoC principle | Suggestion |
| 3.4 | Single function doing unrelated things: the "and" test — if you need "and" to describe it | SOLID: SRP | Suggestion |
| 3.5 | Cross-cutting concerns interleaved: logging, auth, metrics in business logic where middleware exists | Industry convention | Suggestion |

## 4. Complexity

| # | Item | Source | Severity |
|---|------|--------|----------|
| 4.1 | Function exceeds ~30 lines (language-dependent) | Fowler: Long Method smell | Suggestion at 30+, Blocking at 60+ |
| 4.2 | Nesting depth exceeds 3 levels: use guard clauses, early returns, or extract | Fowler: Replace Nested Conditional with Guard Clauses | Suggestion at 3, Blocking at 4+ |
| 4.3 | Function takes more than 3-4 parameters | Fowler: Long Parameter List smell | Suggestion at 4, Blocking at 6+ |
| 4.4 | Complex boolean expressions without extraction to named variable/function | Fowler: Decompose Conditional | Suggestion |
| 4.5 | Flag arguments controlling function behavior: boolean params making function do different things | Fowler: Remove Flag Argument | Suggestion |
| 4.6 | Loop body doing multiple unrelated things | Fowler: Split Loop | Suggestion |
| 4.7 | Deeply chained method calls: `a.b().c().d()` crossing architectural boundaries | Fowler: Message Chains smell | Suggestion |

## 5. SOLID Principles

| # | Item | Source | Severity |
|---|------|--------|----------|
| 5.1 | Class/module has multiple reasons to change (SRP): handles DB + email + validation | SRP; Fowler: Divergent Change | Suggestion |
| 5.2 | Adding a variant requires modifying existing code (OCP): switch in 5 places instead of new class | OCP; Fowler: Switch Statements smell | Suggestion at 1, Blocking at multiple locations |
| 5.3 | Subclass breaks parent contract (LSP): throws unexpected exceptions, ignores parent methods | LSP; Fowler: Refused Bequest | Blocking |
| 5.4 | Interface forces empty implementations (ISP): 10-method interface, most implementors use 3 | ISP | Suggestion |
| 5.5 | High-level module directly instantiates low-level deps (DIP): `new MySQLConnection()` in service | DIP | Suggestion in app code, Blocking in library code |
| 5.6 | **Do not apply SOLID dogmatically.** Small scripts, prototypes, simple CRUD don't need heavy abstraction. Always ask: "Does violating this cause a concrete problem here?" | Pragmatic principle | N/A |

## 6. Code Smells

### Bloaters

| # | Smell | What to Look For | Severity |
|---|-------|------------------|----------|
| 6.1 | Long Method | Function doing too much, hard to name, requires scrolling | Suggestion / Blocking |
| 6.2 | Large Class | Class with many fields, methods, or responsibilities | Suggestion |
| 6.3 | Primitive Obsession | Strings/ints for domain concepts (e.g., currency as `float`, status as `string` instead of enum) | Suggestion, Blocking if causes bugs |
| 6.4 | Long Parameter List | More than 3-4 parameters | Suggestion |
| 6.5 | Data Clumps | Same group of fields always appearing together | Suggestion |

### Change Preventers

| # | Smell | What to Look For | Severity |
|---|-------|------------------|----------|
| 6.6 | Divergent Change | One class modified for multiple unrelated reasons | Suggestion |
| 6.7 | Shotgun Surgery | Single logical change requires edits to many files | Blocking |
| 6.8 | Parallel Inheritance | Adding subclass in one hierarchy requires adding one in another | Suggestion |

### Dispensables

| # | Smell | What to Look For | Severity |
|---|-------|------------------|----------|
| 6.9 | Dead Code | Unreachable code, unused variables, commented-out code | Suggestion |
| 6.10 | Speculative Generality | Abstract class with single implementation, unused parameters/hooks | Suggestion |
| 6.11 | Lazy Class | Class doing too little to justify its existence | Suggestion |
| 6.12 | Comments as Deodorant | Comments explaining *what* bad code does instead of making code clear. Comments explaining *why* are fine | Observation |

### Couplers

| # | Smell | What to Look For | Severity |
|---|-------|------------------|----------|
| 6.13 | Feature Envy | Method uses more data from another class than its own | Suggestion |
| 6.14 | Inappropriate Intimacy | Classes accessing each other's private/internal details | Blocking if crosses module boundaries |
| 6.15 | Middle Man | Class that delegates almost everything, adding no value | Suggestion |

## 7. Over/Under-Engineering

| # | Item | Source | Severity |
|---|------|--------|----------|
| 7.1 | YAGNI: interface with one implementation, factory for one type, generic for one concrete need | XP; Fowler: Speculative Generality | Suggestion |
| 7.2 | Premature abstraction: base class after seeing only 1-2 instances. Wait for three | Rule of Three / Sandi Metz | Suggestion |
| 7.3 | Design pattern forced where simpler solution works: Strategy for 2 cases, Observer for 1 subscriber | Gang of Four (judicious) | Suggestion |
| 7.4 | Missing necessary abstraction: 500-line function, scattered business rules, raw data where domain object needed | Fowler: Long Method, Primitive Obsession | Blocking if causes bugs/duplication |
| 7.5 | Unnecessary configurability: extra parameters, feature flags for hypothetical future needs | YAGNI | Suggestion |
| 7.6 | Layers of indirection with no value: Controller → Service → Manager → Handler → Repository with 2+ no-op layers | Middle Man smell | Suggestion |

## 8. Tech Debt

| # | Item | Source | Severity |
|---|------|--------|----------|
| 8.1 | New TODO/FIXME/HACK without tracking: must reference a ticket/issue | Industry practice | Suggestion |
| 8.2 | Workaround without explanation: no comment explaining why and when it can be removed | Pragmatic principle | Suggestion |
| 8.3 | Deprecated API usage in new code: using APIs marked `@deprecated` or documented as sunset | API documentation | Blocking |
| 8.4 | Suppressed lint rules without explanation: `// eslint-disable` without reason comment | Industry practice | Suggestion |
| 8.5 | Increasing scope of existing debt: more code added to already-too-large function/class | Fowler: Boy Scout Rule | Suggestion |
| 8.6 | Commented-out code: delete it, version control preserves history | Fowler: Dead Code | Suggestion |

## 9. API Design

| # | Item | Source | Severity |
|---|------|--------|----------|
| 9.1 | Breaking change to public interface without migration path: use Expand-Contract pattern | Fowler: Parallel Change | Blocking |
| 9.2 | Leaking implementation details: exposing DB column names, internal hierarchies through public API | Fowler: Encapsulate Record/Collection | Blocking for libraries, Suggestion for internal |
| 9.3 | Unclear function contract: can it return null? Can it throw? What are valid inputs? | Fowler: Introduce Assertion | Suggestion |
| 9.4 | Inconsistent API patterns: existing uses `getX()` / `setX()`, new code uses `fetchX()` / `updateX()` | Consistency principle | Suggestion |
| 9.5 | Mutable return values: returning internal collection directly, callers can modify internal state | Fowler: Encapsulate Collection | Suggestion, Blocking if causes bugs |
| 9.6 | Error handling contract unclear: throws vs returns null vs Result type — inconsistent with codebase pattern | Consistency principle | Suggestion |

## Severity Escalation Guide

- **Observation**: "I noticed X. No action needed, just flagging."
- **Suggestion**: "This could be improved. Consider fixing in this PR or a follow-up."
- **Blocking**: "This will likely cause bugs, break consumers, or create a maintenance trap. Fix before merge."

A pattern violation should only be **Blocking** if it meets at least one: (a) will likely cause a bug, (b) breaks a public contract, (c) makes code untestable, (d) creates a maintenance trap significantly harder to fix later.
