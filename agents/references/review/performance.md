# Performance Review Checklist

> Sources: web.dev Core Web Vitals (LCP, INP, CLS), OWASP API Security, Node.js streams/backpressure docs, HTTP caching (RFC 9111)
> Severity: Blocking / Suggestion / Observation
> Updated: 2026-03-11
>
> CWV Thresholds (75th percentile): LCP ≤ 2.5s | INP ≤ 200ms | CLS ≤ 0.1

## 1. Bundle & Loading

| # | Item | Source | Severity |
|---|------|--------|----------|
| 1.1 | New route-level code behind dynamic `import()` / `React.lazy` / equivalent — not in main bundle | web.dev LCP: resource load delay | Suggestion |
| 1.2 | No new dependency > 50KB gzipped without justification | Lighthouse audits | Suggestion |
| 1.3 | Named imports (`import { specific }`) instead of `import *` or barrel file re-exports to enable tree shaking | Webpack/Rollup docs | Suggestion |
| 1.4 | No synchronous `<script>` without `async` or `defer` | web.dev LCP: render-blocking | Blocking |
| 1.5 | CSS not loaded via `@import` chains (sequential loading); prefer `<link>` or bundled CSS | web.dev LCP | Suggestion |
| 1.6 | Preload (`<link rel="preload">`) used for LCP-critical resources discovered late in HTML | web.dev LCP: resource load delay | Suggestion |
| 1.7 | No duplicate polyfills or libraries (e.g., two date libs) | Lighthouse: duplicate modules | Suggestion |

## 2. Rendering

| # | Item | Source | Severity |
|---|------|--------|----------|
| 2.1 | Expensive computations in render path wrapped in `useMemo` / `computed` with correct deps | web.dev INP: processing time | Suggestion |
| 2.2 | Stable callback references (`useCallback` with correct deps) to avoid unnecessary child re-renders | web.dev INP: main thread work | Suggestion |
| 2.3 | Lists > ~100 items use virtualized rendering (`react-window`, `@tanstack/virtual`) | INP: DOM size | Suggestion |
| 2.4 | No forced synchronous layout: reading layout props then immediately writing styles | web.dev INP: layout thrashing | Blocking |
| 2.5 | `key` props use stable unique identifiers — not array index (unless list is static, never reordered) | React reconciliation | Suggestion |
| 2.6 | No `JSON.parse`/`JSON.stringify` of large objects in render paths or event handlers on main thread | web.dev INP: input delay | Suggestion |
| 2.7 | Long tasks (>50ms) broken up using `scheduler.yield()`, `setTimeout(0)`, or `scheduler.postTask()` | web.dev INP: yield to main thread | Suggestion |
| 2.8 | Large DOM mutations (100+ nodes) batched or use `requestAnimationFrame` | web.dev INP: presentation delay | Suggestion |

## 3. Network & Caching (Frontend)

| # | Item | Source | Severity |
|---|------|--------|----------|
| 3.1 | Hashed/fingerprinted static assets use `Cache-Control: public, max-age=31536000, immutable` | RFC 9111; web.dev caching | Suggestion |
| 3.2 | No waterfall fetches: sequential `await fetch()` that could be `Promise.all`/`Promise.allSettled` | web.dev LCP: TTFB | Blocking |
| 3.3 | `<link rel="preconnect">` for critical third-party origins (CDN, API, font provider) | web.dev LCP | Suggestion |
| 3.4 | Request deduplication: multiple components requesting same data share a single request (SWR, React Query) | SWR/React Query docs | Suggestion |
| 3.5 | GraphQL queries request only needed fields; REST uses sparse fieldsets where available | API best practice | Suggestion |

## 4. Assets

| # | Item | Source | Severity |
|---|------|--------|----------|
| 4.1 | New images use modern formats: WebP or AVIF with fallback | web.dev LCP: resource load time | Suggestion |
| 4.2 | All `<img>` have explicit `width`/`height` or CSS `aspect-ratio` (prevents CLS) | web.dev CLS: #1 cause | Blocking |
| 4.3 | Below-fold images use `loading="lazy"`; LCP images must NOT have `loading="lazy"` | web.dev LCP | Blocking |
| 4.4 | LCP image has `fetchpriority="high"` | web.dev LCP: resource load delay | Suggestion |
| 4.5 | Responsive images use `srcset` + `sizes` | web.dev LCP | Suggestion |
| 4.6 | Fonts use `font-display: swap` or `optional` to avoid invisible text (FOIT) | web.dev CLS | Suggestion |
| 4.7 | Font files preloaded: `<link rel="preload" as="font" crossorigin>` for critical text | web.dev LCP | Suggestion |
| 4.8 | SVGs optimized (SVGO or equivalent) | General practice | Observation |

## 5. Third-Party Scripts

| # | Item | Source | Severity |
|---|------|--------|----------|
| 5.1 | Third-party scripts use `async` or `defer`; never synchronous in critical path | web.dev LCP | Blocking |
| 5.2 | Third-party scripts loaded conditionally (analytics after consent, chat only on support pages) | web.dev: third-party JS | Suggestion |
| 5.3 | Third-party `<iframe>` use `loading="lazy"` | Reduces main thread work | Suggestion |
| 5.4 | No third-party scripts injecting DOM elements without dimensions (causes CLS) | web.dev CLS | Blocking |

## 6. Database

| # | Item | Source | Severity |
|---|------|--------|----------|
| 6.1 | No N+1 queries: loop executing a query per iteration instead of batch `WHERE IN` or JOIN | OWASP perf; most common backend issue | Blocking |
| 6.2 | New query columns in `WHERE`/`JOIN`/`ORDER BY` have corresponding indexes | PostgreSQL/MySQL docs | Blocking |
| 6.3 | `SELECT *` not used in production; only needed columns selected | Reduces I/O and memory | Suggestion |
| 6.4 | Queries include `LIMIT`/pagination; no unbounded `SELECT` returning millions of rows | API security; OOM prevention | Blocking |
| 6.5 | Bulk operations use batch inserts/updates instead of row-by-row | DB performance | Suggestion |
| 6.6 | Transactions appropriately scoped; no transactions held open across network calls | Lock contention, WAL bloat | Blocking |
| 6.7 | Connection pooling configured; no open/close per request | PgBouncer/HikariCP docs | Suggestion |
| 6.8 | ORM eager-loading explicit: no lazy-loading relied upon in loops | Django/Rails/SQLAlchemy docs | Blocking |
| 6.9 | No raw string interpolation in SQL (injection risk AND prevents query plan caching) | OWASP SQL Injection CS | Blocking |
| 6.10 | Migrations add indexes concurrently where possible (`CREATE INDEX CONCURRENTLY`) | PostgreSQL docs | Suggestion |

## 7. API Design (Backend)

| # | Item | Source | Severity |
|---|------|--------|----------|
| 7.1 | List endpoints paginated (cursor-based preferred) with server-enforced max page size | OWASP API4:2023 | Blocking |
| 7.2 | Responses include only needed fields; no full DB row serialization | OWASP API3:2023 | Suggestion |
| 7.3 | Independent downstream calls parallel (`Promise.all`, `asyncio.gather`, goroutines) not sequential | Backend perf | Blocking |
| 7.4 | Heavy computations offloaded to background jobs/queues | 12-factor methodology | Suggestion |
| 7.5 | Request timeouts configured for all outbound HTTP calls | Resilience engineering | Blocking |
| 7.6 | Rate limiting on expensive endpoints | OWASP API4:2023 | Suggestion |

## 8. Caching (Backend)

| # | Item | Source | Severity |
|---|------|--------|----------|
| 8.1 | Appropriate cache layer: in-process (hot path, small), distributed (Redis/Memcached, shared), CDN (static) | Caching architecture | Suggestion |
| 8.2 | Cache keys deterministic and include all variables affecting cached value (role, locale, flags) | Cache correctness | Blocking |
| 8.3 | TTL set explicitly; no indefinite caching without invalidation strategy | Redis best practices | Suggestion |
| 8.4 | Cache stampede prevention: lock-based recomputation, probabilistic early expiration, or stale-while-revalidate | Facebook TAO paper | Suggestion |
| 8.5 | Cache failures handled gracefully: degrade to origin fetch, don't crash | Resilience engineering | Suggestion |
| 8.6 | No user-specific data in shared caches without proper `Vary` headers or key segmentation | HTTP caching security | Blocking |

## 9. Memory

| # | Item | Source | Severity |
|---|------|--------|----------|
| 9.1 | Large file processing uses streaming (Node.js Readable/Transform, Go io.Reader, Python generators) | Node.js streams docs | Blocking |
| 9.2 | Resources cleaned up in `finally`/`defer`/`using`/`with`: DB connections, file handles, sockets, timers | Resource leak prevention | Blocking |
| 9.3 | No unbounded in-memory collections: arrays/maps growing with request count without cap | Memory leak patterns | Blocking |
| 9.4 | Event listeners/subscriptions removed on cleanup | Common memory leak source | Blocking |
| 9.5 | Global/module-level caches have eviction policy (LRU, TTL) or size limits | Memory management | Suggestion |
| 9.6 | No string concatenation in loops for large output: use `StringBuilder`/`Buffer`/`join()` (O(n²) → O(n)) | Algorithmic complexity | Suggestion |

## 10. Concurrency

| # | Item | Source | Severity |
|---|------|--------|----------|
| 10.1 | `Promise.all` for independent async operations instead of sequential `await` | JS concurrency | Blocking |
| 10.2 | Backpressure for producer-consumer: queue/stream has max size, producer pauses when consumer slow | Node.js backpressure docs | Suggestion |
| 10.3 | Shared mutable state protected: mutex, atomic, actor model — no unguarded concurrent access | Race condition prevention | Blocking |
| 10.4 | Concurrent request fan-out bounded (`p-limit`, semaphore) — not unbounded `Promise.all` over 10K items | Resource exhaustion prevention | Blocking |
| 10.5 | Retry logic includes exponential backoff + jitter; no tight retry loops | AWS architecture blog | Suggestion |
| 10.6 | No `async void` / fire-and-forget without error handling | Unhandled rejections crash Node.js | Blocking |
| 10.7 | Distributed locks (if used) have TTL to prevent deadlocks from crashed holders | Redis Redlock docs | Suggestion |

## 11. Algorithmic Complexity

| # | Item | Source | Severity |
|---|------|--------|----------|
| 11.1 | No nested loops where index/map/set lookup suffices: O(n²) → O(n) | Algorithm analysis | Blocking |
| 11.2 | Array searched repeatedly: convert to `Set` or `Map` for O(1) lookups | JS engine optimization | Suggestion |
| 11.3 | No repeated computation in loops: hoist invariant calculations | Loop optimization | Suggestion |
| 11.4 | No synchronous blocking on event loop: file I/O, crypto, DNS — use async or worker threads | Node.js event loop docs | Blocking |
| 11.5 | Regex reviewed for catastrophic backtracking (ReDoS): no nested quantifiers on overlapping patterns | OWASP ReDoS | Blocking |
| 11.6 | Debounce/throttle on high-frequency event handlers (scroll, resize, input, mousemove) | web.dev INP | Suggestion |
| 11.7 | No `Array.find`/`Array.filter` inside `Array.map`/`Array.forEach` (hidden O(n²)) | Common code review finding | Blocking |
| 11.8 | Deep cloning used judiciously: not on large objects when shallow copy suffices | Performance overhead | Suggestion |
