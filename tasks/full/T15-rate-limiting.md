# T15 — Rate limiting and forwarded headers

- **Milestone:** M4
- **Depends on:** T09, T11
- **Spec refs:** §11.2, §9.1 (step 3), §11.1, Q13

## Goal

Apply the six rate-limit policies with correct partition keys, rejection bodies per surface, and trustworthy client IPs behind a proxy.

## Scope

- ASP.NET Core `Microsoft.AspNetCore.RateLimiting` policies.
- IP resolution via `ForwardedHeaders` with known proxies/networks only.
- Rejection responses: ProblemDetails on management, runtime envelope on `/m`.

## Implementation checklist

- [ ] Policies and defaults:
  - `create-project` — client IP — 10/hour — `POST /projects`
  - `infer-preview` — client IP — 30/min — `POST /infer`, `POST /preview`
  - `mgmt-write` — client IP — 60/min — other management `POST/PUT/PATCH/DELETE`
  - `mgmt-read` — client IP — 120/min — management `GET`
  - `runtime-slug` — slug — 120/min (token bucket, short bursts) — mock calls
  - `runtime-ip` — client IP — 600/min — mock calls
- [ ] All limits/periods from configuration; no magic numbers.
- [ ] `429` includes `Retry-After` in seconds.
- [ ] Management rejection body is the T02 ProblemDetails with `code: "rate_limited"`.
- [ ] Runtime rejection body is the T11 envelope with `code: "rate_limited"`, `injected: false`, CORS headers, and `X-Request-Id`.
- [ ] `ForwardedHeaders`: process `X-Forwarded-For` and `X-Forwarded-Proto`; configure `KnownProxies`/`KnownNetworks`; clear the default "trust everything" behavior.
- [ ] Rate-limit partitions use the resolved client IP, never a raw header.
- [ ] `OPTIONS` preflight is exempt (must answer `204` regardless of limits).
- [ ] Health endpoints are exempt.
- [ ] Verify policy ordering does not make management routes double-counted or bypassed (route-level vs global).
- [ ] Do not rate-limit `/meta` (read, but public bootstrap; confirm and document if changed).
- [ ] Log rejections with the policy name and partition, never the token.

## Acceptance criteria

- [ ] The 11th project creation per IP in an hour returns `429` with `Retry-After`.
- [ ] `/infer` and `/preview` share the `infer-preview` budget.
- [ ] Runtime per-slug limit triggers before the per-IP limit for a single abusive slug.
- [ ] A spoofed `X-Forwarded-For` from an untrusted source does not change the partition.
- [ ] `Retry-After` is present and positive on every `429`.
- [ ] Rate limiter state resets on process restart (documented; in-memory by design).

## Tests

- Integration tests with a test clock or short configured windows.
- Header-trust tests with a trusted and an untrusted proxy address.
- Response-shape tests for both surfaces.
- Preflight exemption test.

## Notes

- In-memory limiters are per instance. Multi-instance requires Redis/distributed counters (Q13 open).
- Token buckets for `runtime-slug` should allow short bursts but keep the sustained rate at 120/min.
