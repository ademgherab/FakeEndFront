# T11 — Mock runtime pipeline

- **Milestone:** M3
- **Depends on:** T06, T10, T12 (T02, T08 rules reused for expiry semantics)
- **Spec refs:** §2.2, §9 (all), §11.1, §11.2

## Goal

`/m/{slug}/{**path}` behaves exactly as §9: method handling, CORS, matching, delay, injected errors, headers, and generation.

## Scope

- Route `/m/{slug}` and `/m/{slug}/{**path}`.
- Pipeline steps 0–11 in the exact order.
- Path matcher with static-over-template precedence.
- Runtime error envelope and all runtime headers.
- `OPTIONS` preflight handling.

## Implementation checklist

- [ ] Methods handled: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`; everything else (`HEAD`, `PATCH`, …) → `405` with `Allow`.
- [ ] Step 0 `OPTIONS`: `204` immediately; no delay, no errors, not logged, not counted.
- [ ] Step 1: project from cache, DB fallback → `404 project_not_found`.
- [ ] Step 2: `now > expires_at` → `410 project_expired`.
- [ ] Step 3: runtime rate limit → `429 rate_limited` (wired in T15; call through an interface).
- [ ] Step 4: daily quota → `429 daily_quota_exceeded`, `Retry-After` = seconds until 00:00 UTC.
- [ ] Step 5: body > 64 KB → `413 payload_too_large`.
- [ ] Step 6: match method + path → `404 endpoint_not_found`; if the path matches other methods only → `405 method_not_allowed` + `Allow`.
- [ ] Step 7: validate `page`/`limit` when pagination enabled → `400 invalid_pagination` (T12).
- [ ] Step 8: delay random int in `[minMs, maxMs]` via `Task.Delay(..., RequestAborted)`.
- [ ] Step 9: error roll `Random.Shared.NextDouble()*100 < ratePercent`; pick a status with equal probability; respond with the injected envelope. Add `Retry-After: 3` for `429`/`503`.
- [ ] Step 10: generate with `successStatus`; no body for `204`; generation failure → `500 generation_failed`.
- [ ] Step 11: enqueue log entry non-blocking and increment usage (T13); never block the response on the queue.
- [ ] Steps 1–5 are **not** logged; steps 6–10 are logged including `404`/`405`/`400` and injected errors.
- [ ] Path matching: percent-decoded, segment-wise, case-insensitive, trailing slash ignored; `{name}` matches exactly one non-empty segment; static beats template left-to-right; query ignored.
- [ ] Always send: `Content-Type` (except 204), `Cache-Control: no-store`, `X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`, `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers`.
- [ ] Delay header reports the actual applied delay, `0` when step 8 was not reached.
- [ ] Preflight: `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Allow-Headers: *`, `Max-Age: 86400`; never `Allow-Credentials`.
- [ ] `X-Mock-Injected-Error: true` only for step 9 errors; `false` otherwise, including system errors.
- [ ] Runtime system errors use `{ error: { ... } }` with `injected: false` and the T02 codes.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] Unknown slug must not reveal whether a similar slug exists.

## Acceptance criteria

- [ ] A valid GET returns generated JSON with all required headers and CORS `*`.
- [ ] A `POST` to a path registered as GET-only returns `405` + `Allow: GET`.
- [ ] With `ratePercent = 100`, every non-preflight call returns the selected status with `injected: true` and `Retry-After` where applicable.
- [ ] Delay of `{minMs: 300, maxMs: 1500}` produces `X-Mock-Delay-Ms` in range and a matching wall-clock wait.
- [ ] `/m/{slug}` (no trailing path) matches the endpoint path `/`.
- [ ] Trailing slashes and case differences match; query strings do not affect matching.
- [ ] Static `/users/me` wins over `/users/{id}` regardless of registration order.
- [ ] Expired project returns `410` even if the endpoint exists.
- [ ] Preflight is answered without touching the cache, logs, or counters.

## Tests

- Pipeline step-order tests using a fake clock/limiter to prove `404` precedes `429`, etc.
- Path-matching table tests (case, decoding, templates, precedence, trailing slash).
- Header assertion tests for success, injected error, and system error.
- Delay tests with a fake `TimeProvider` or bounded real waits.
- CORS preflight test.
- Test that steps 1–5 produce no log rows and steps 6–10 do.

## Notes

- Keep runtime responses independent of the management ProblemDetails shape.
- `HEAD` must be rejected, so do not let the framework auto-handle it.
