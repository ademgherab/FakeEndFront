# T17 — Security hardening

- **Milestone:** M5
- **Depends on:** T15
- **Spec refs:** §5.4, §11.3, §3, §9.3

## Goal

Close the security checklist from §11.3 and prove the risky properties with tests.

## Scope

- Transport, headers, strict JSON, secret hygiene, SSRF surface, dependency hygiene.
- Review of body-size limits and error leakage.

## Implementation checklist

- [ ] HTTPS only; HSTS enabled in production with a sensible max-age/includeSubDomains (no preload unless confirmed).
- [ ] Management responses add `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- [ ] Runtime responses add `Content-Type: application/json; charset=utf-8` (except 204) and `X-Content-Type-Options: nosniff`.
- [ ] CORS: management origins from config only (`Cors:ManagementOrigins`), methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`, headers `Authorization, Content-Type`, exposed `Retry-After, X-Request-Id, Location`, no credentials.
- [ ] Runtime CORS is `*` with no credentials, as specified.
- [ ] Strict JSON: `MaxDepth = 32`, unknown members rejected, content type required (`415` otherwise), request size limits enforced (256 KB management, 64 KB runtime).
- [ ] Verify no outbound HTTP client is reachable from user input; image URLs are strings only.
- [ ] Token handling: never logged, never in URLs, fixed-time compare, hash-only storage.
- [ ] No IP stored in the DB; verify with a schema/test scan.
- [ ] EF Core only, parameterized queries; no string-built SQL.
- [ ] Error responses never include stack traces, SQL, file paths, or config values.
- [ ] Dependency update automation (Dependabot/Renovate) for NuGet; lock file policy documented.
- [ ] Container runs as non-root; no secrets baked into the image.
- [ ] Add a security checklist runbook item to the release process.

## Acceptance criteria

- [ ] A user-supplied URL in a string field causes no outbound request (verified by a network-guard test).
- [ ] Oversized bodies are rejected with `413` before JSON parsing allocates heavily.
- [ ] Wrong content type returns `415`.
- [ ] Unknown JSON properties return `400` with the property path.
- [ ] Management CORS rejects an unlisted origin.
- [ ] Tokens never appear in logs, traces, or error bodies.
- [ ] `HEAD /m/{slug}` returns `405` (no implicit body handling).

## Tests

- Security regression tests for CORS, content type, body limits, and error leakage.
- Log-scan canary test.
- Optional: OWASP ZAP baseline or equivalent in CI (manual if not feasible).

## Notes

- Do not add `Allow-Credentials` to the runtime CORS `*` policy.
- HSTS only in production; local HTTP development must keep working.
