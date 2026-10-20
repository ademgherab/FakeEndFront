---
id: "RUN-08"
title: "Quota and rate-limit UX"
milestone: "M3 — Try it and logs"
priority: "P1"
size: "S"
status: "todo"
owner: ""
depends_on: ["RUN-01","PRJ-02"]
spec_refs: ["§9.4","§11.1","§11.2"]
---

# RUN-08 · Quota and rate-limit UX

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P1 |
| Size | S |
| Depends on | RUN-01, PRJ-02 |
| Spec | §9.4, §11.1, §11.2 |

## Context

Limits are part of the product. A 429 must explain what happened and when to retry, not look like a broken mock.

## Scope

- Render `429 daily_quota_exceeded` with a countdown to 00:00 UTC.
- Render `rate_limited` with `Retry-After` for management and runtime calls.
- Show a quota-exhausted state on the overview without hiding the URL.
- Refresh usage after a quota error.

## Acceptance criteria

- [ ] The retry time is computed from `Retry-After`, not a hard-coded delay.
- [ ] The countdown reaches zero and re-enables the action without a reload.
- [ ] Quota errors are visually distinct from injected 429s (`injected_error`).
- [ ] The explanation states the limit and the UTC reset for daily quota.

## Implementation notes

- Injected 429s come from the runtime and carry `Retry-After: 3`; do not confuse them with platform limits.
- Do not auto-retry writes on 429.

## Testing

- Unit test for countdown formatting and MSW tests for both 429 codes.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
