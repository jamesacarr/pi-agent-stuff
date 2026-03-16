# Security Review Checklist

> Sources: OWASP Top 10 (2021), OWASP ASVS v4.0, OWASP Cheat Sheet Series (110+ sheets), CWE database
> Severity: Blocking / Suggestion / Observation
> Updated: 2026-03-11

## 1. Input Validation

| # | Item | Source | Severity |
|---|------|--------|----------|
| 1.1 | User input used without allow-list validation (positive validation); reject-lists are insufficient | ASVS 5.1.3 | Blocking |
| 1.2 | Missing schema validation on structured data (JSON, XML payloads) | ASVS 13.2.2 | Blocking |
| 1.3 | No type/length/range checks: unbounded strings, negative numbers where only positive expected | ASVS 5.1.4 | Suggestion |
| 1.4 | Mass assignment: request body bound directly to model without field allow-listing | ASVS 5.1.2, CWE-915 | Blocking |
| 1.5 | Validation performed only client-side (JS) with no server-side enforcement | ASVS 4.1.1 | Blocking |
| 1.6 | Missing `Content-Type` checking on incoming requests | ASVS 13.1.5 | Suggestion |

## 2. Injection

| # | Item | Source | Severity |
|---|------|--------|----------|
| 2.1 | String concatenation/interpolation in SQL instead of parameterized queries | ASVS 5.3.4, CWE-89 | Blocking |
| 2.2 | Raw OS command execution with user input (`exec()`, `system()`, `child_process.exec()`) | ASVS 5.3.8, CWE-78 | Blocking |
| 2.3 | User input in file paths without canonicalization: path traversal via `../` | ASVS 5.3.9, CWE-22 | Blocking |
| 2.4 | XML parsing with external entity resolution enabled (DTD, external entities) | ASVS 5.5.2, CWE-611 | Blocking |
| 2.5 | `eval()`, `new Function()`, `setTimeout(string)` with user-controlled data | ASVS 5.2.4, CWE-95 | Blocking |
| 2.6 | Template injection: user input in server-side template expressions | ASVS 5.2.5, CWE-94 | Blocking |
| 2.7 | Unsafe deserialization of untrusted data (pickle, Java ObjectInputStream, YAML.load) | ASVS 5.5.1, CWE-502 | Blocking |
| 2.8 | JSON injection: user input concatenated into JSON strings instead of `JSON.stringify()` | ASVS 5.3.6 | Blocking |
| 2.9 | LDAP/XPath injection: user input in LDAP or XPath queries without escaping | ASVS 5.3.7, CWE-90 | Blocking |
| 2.10 | SMTP injection: user input in mail headers without sanitization | ASVS 5.2.3, CWE-147 | Blocking |

## 3. Authentication & Authorization

| # | Item | Source | Severity |
|---|------|--------|----------|
| 3.1 | IDOR: resource access by user-supplied ID without ownership verification | ASVS 4.2.1, CWE-639 | Blocking |
| 3.2 | Authorization enforced only client-side or UI layer — no server-side check | ASVS 4.1.1, CWE-602 | Blocking |
| 3.3 | Missing authorization check on new API endpoint or controller action | ASVS 4.1.3 | Blocking |
| 3.4 | Access control fails open: exception during auth check results in access granted | ASVS 4.1.5, CWE-285 | Blocking |
| 3.5 | Missing rate limiting on login/auth endpoints (brute force unprotected) | ASVS 2.2.1, CWE-307 | Blocking |
| 3.6 | Weak password hashing: MD5, SHA1, unsalted. Must use bcrypt ≥10, PBKDF2 ≥100k, scrypt, Argon2 | ASVS 2.4.1, CWE-916 | Blocking |
| 3.7 | Session token not regenerated after authentication (session fixation) | ASVS 3.2.1, CWE-384 | Blocking |
| 3.8 | Session tokens in URLs or query parameters | ASVS 3.1.1, CWE-598 | Blocking |
| 3.9 | Cookie missing `Secure`, `HttpOnly`, `SameSite` attributes | ASVS 3.4.1-3.4.4, CWE-614 | Suggestion |
| 3.10 | Missing session invalidation on logout | ASVS 3.3.1, CWE-613 | Suggestion |
| 3.11 | Password recovery reveals whether account exists (enumeration) | ASVS 2.5.3 | Suggestion |

## 4. Output Encoding / XSS

| # | Item | Source | Severity |
|---|------|--------|----------|
| 4.1 | User data rendered in HTML without context-appropriate encoding (HTML body, attributes, JS, CSS, URL) | ASVS 5.3.1, CWE-79 | Blocking |
| 4.2 | `dangerouslySetInnerHTML` (React), `v-html` (Vue), `[innerHTML]` (Angular) with user data | XSS Prevention CS | Blocking |
| 4.3 | User input in `<script>` blocks, event handlers (`onclick`, `onerror`), or `javascript:` URIs | ASVS 5.3.3, CWE-79 | Blocking |
| 4.4 | Missing encoding in JSON contexts embedded in HTML (`<script>var data = ...`) | ASVS 5.3.6 | Blocking |
| 4.5 | SVG upload/rendering without sanitization — SVGs can contain inline scripts | ASVS 5.2.7 | Blocking |
| 4.6 | Rich text/Markdown rendered without HTML sanitizer (DOMPurify or equivalent) | ASVS 5.2.1, CWE-116 | Blocking |
| 4.7 | Character set not specified in `Content-Type` header | ASVS 14.4.1 | Suggestion |

## 5. CSRF

| # | Item | Source | Severity |
|---|------|--------|----------|
| 5.1 | State-changing operation (POST/PUT/DELETE) missing CSRF token or equivalent protection | ASVS 4.2.2, CWE-352 | Blocking |
| 5.2 | CSRF token not validated server-side, or bypassable by omitting token | CSRF Prevention CS | Blocking |
| 5.3 | Cookie-based API auth without CSRF protection (Bearer header auth is inherently resistant) | ASVS 13.2.3 | Blocking |
| 5.4 | `SameSite` cookie attribute not set | ASVS 3.4.3 | Suggestion |
| 5.5 | CORS: `Access-Control-Allow-Origin` reflects request origin or allows `null` | ASVS 14.5.3, CWE-346 | Blocking |

## 6. Secrets & Sensitive Data

| # | Item | Source | Severity |
|---|------|--------|----------|
| 6.1 | Hardcoded secrets, API keys, passwords, or tokens in source code | ASVS 6.4.1, CWE-798 | Blocking |
| 6.2 | Sensitive data transmitted in URL query parameters (logs, referrer headers, browser history) | ASVS 8.3.1, CWE-319 | Blocking |
| 6.3 | Sensitive data in browser localStorage/sessionStorage (accessible to XSS) | ASVS 8.2.2, CWE-922 | Suggestion |
| 6.4 | Weak/deprecated crypto: MD5, SHA1 for integrity; DES, 3DES, ECB mode | ASVS 6.2.5, CWE-326 | Blocking |
| 6.5 | `Math.random()` or `random.random()` for security-sensitive values (tokens, keys, nonces) | ASVS 6.3.1, CWE-338 | Blocking |
| 6.6 | Custom cryptography instead of proven libraries | ASVS 6.2.2, CWE-327 | Blocking |
| 6.7 | Sensitive data stored unencrypted at rest | ASVS 6.1.1, CWE-311 | Blocking |
| 6.8 | Missing encryption in transit — not enforcing TLS | ASVS 9.1.1, CWE-319 | Blocking |

## 7. Security Headers

| # | Item | Source | Severity |
|---|------|--------|----------|
| 7.1 | Missing `Content-Security-Policy`: at minimum `default-src 'self'`; avoid `unsafe-inline`/`unsafe-eval` | ASVS 14.4.3 | Blocking |
| 7.2 | Missing `Strict-Transport-Security` (HSTS): `max-age=31536000; includeSubDomains` | ASVS 14.4.5 | Blocking |
| 7.3 | Missing `X-Content-Type-Options: nosniff` | ASVS 14.4.4 | Suggestion |
| 7.4 | Missing `X-Frame-Options` or CSP `frame-ancestors` (clickjacking) | ASVS 14.4.7, CWE-1021 | Suggestion |
| 7.5 | Missing/permissive `Referrer-Policy`: use `strict-origin-when-cross-origin` or `no-referrer` | ASVS 14.4.6 | Suggestion |
| 7.6 | Server/framework version leaked in headers (`X-Powered-By`, `Server`) | ASVS 14.3.3 | Observation |
| 7.7 | Debug mode enabled in production | ASVS 14.3.2 | Blocking |
| 7.8 | CORS `Access-Control-Allow-Origin` set to `*` on endpoints returning sensitive data | ASVS 14.5.3 | Blocking |

## 8. Error Handling & Information Leakage

| # | Item | Source | Severity |
|---|------|--------|----------|
| 8.1 | Stack traces, SQL errors, or internal paths exposed in error responses | ASVS 7.4.1, CWE-210 | Blocking |
| 8.2 | Different error messages for "user not found" vs "wrong password" (account enumeration) | CWE-203 | Suggestion |
| 8.3 | Error responses reflect request data back (potential XSS) | CWE-209 | Suggestion |
| 8.4 | Catch blocks silently swallow exceptions without logging | ASVS 7.4.2 | Suggestion |
| 8.5 | Missing global exception handler | ASVS 7.4.3 | Suggestion |

## 9. API Security

| # | Item | Source | Severity |
|---|------|--------|----------|
| 9.1 | No rate limiting on API endpoints | ASVS 2.2.1, CWE-770 | Blocking |
| 9.2 | Unbounded list endpoints — no pagination or max page size enforced server-side | REST Security CS, CWE-770 | Blocking |
| 9.3 | GraphQL: no query depth limiting, no cost analysis | ASVS 13.4.1, CWE-770 | Blocking |
| 9.4 | Batch endpoints without per-item authorization (only first item checked) | ASVS 4.2.1 | Blocking |
| 9.5 | API allows unintended HTTP methods (DELETE on GET-only resource) | ASVS 13.2.1 | Suggestion |
| 9.6 | API doesn't validate incoming `Content-Type` | ASVS 13.2.5 | Suggestion |
| 9.7 | Missing JSON schema validation on request bodies | ASVS 13.2.2 | Suggestion |

## 10. Logging Safety

| # | Item | Source | Severity |
|---|------|--------|----------|
| 10.1 | Logging passwords, tokens, session IDs, API keys, or credit card numbers | ASVS 7.1.1, CWE-532 | Blocking |
| 10.2 | Logging PII in violation of privacy policy (GDPR, etc.) | ASVS 7.1.2 | Blocking |
| 10.3 | Log injection: user input written to logs without sanitization | ASVS 7.3.1, CWE-117 | Blocking |
| 10.4 | Missing security event logging: failed auth, access control failures, validation failures | ASVS 7.1.3, CWE-778 | Suggestion |
| 10.5 | Log entries missing timestamp, user ID, source IP, or correlation ID | ASVS 7.1.4 | Suggestion |

## 11. File Upload

| # | Item | Source | Severity |
|---|------|--------|----------|
| 11.1 | No file size limit (DoS via disk exhaustion) | ASVS 12.1.1, CWE-400 | Blocking |
| 11.2 | File type validated only by extension/MIME, not by content (magic bytes) | ASVS 12.2.1, CWE-434 | Blocking |
| 11.3 | Uploaded file stored in web root and directly accessible/executable | ASVS 12.4.1, CWE-552 | Blocking |
| 11.4 | User-supplied filename used in filesystem operations (path traversal) | ASVS 12.3.1, CWE-22 | Blocking |
| 11.5 | Uploaded files served with original Content-Type (allows HTML/JS execution) | ASVS 12.5.2, CWE-434 | Blocking |
| 11.6 | Compressed file upload without uncompressed size check (zip bomb) | ASVS 12.1.2, CWE-409 | Suggestion |

## 12. SSRF

| # | Item | Source | Severity |
|---|------|--------|----------|
| 12.1 | User-supplied URL fetched server-side without domain/IP allow-list | ASVS 5.2.6, CWE-918 | Blocking |
| 12.2 | Internal/private IP ranges not blocked (10.x, 172.16.x, 192.168.x, 127.x, 169.254.169.254) | SSRF Prevention CS | Blocking |
| 12.3 | Redirect following on user-supplied URLs (SSRF via open redirect chain) | SSRF Prevention CS | Blocking |
| 12.4 | Missing protocol allow-list: user can specify `file://`, `gopher://` schemes | SSRF Prevention CS | Blocking |
| 12.5 | Response body from internal fetch returned to user (data exfiltration) | CWE-918 | Blocking |

## 13. Open Redirect

| # | Item | Source | Severity |
|---|------|--------|----------|
| 13.1 | Redirect URL from user input without allow-list validation | ASVS 5.1.5, CWE-601 | Suggestion |
| 13.2 | Redirect validation using only prefix/startsWith (bypassable) | Unvalidated Redirects CS | Suggestion |
| 13.3 | Open redirect on authentication flows (can chain with OAuth token theft) | CWE-601 | Blocking |
| 13.4 | URL encoding/double encoding bypass of redirect validation | Unvalidated Redirects CS | Suggestion |
