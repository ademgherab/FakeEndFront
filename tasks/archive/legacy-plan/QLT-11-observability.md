---
id: "QLT-11"
title: "Error observability"
milestone: "M4 — Quality"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: ["FND-06"]
spec_refs: ["§3"]
---

# QLT-11 · Error observability

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P2 |
| Size | S |
| Depends on | FND-06 |
| Spec | §3 |

## Context

When something breaks during the demo, the request id is the fastest path to the backend logs.

## Scope

- Surface `traceId` / `X-Request-Id` in error UI with copy.
- Optional Sentry integration with token/body scrubbing.
- Log client-side failures without request bodies.

## Acceptance criteria

- [ ] Every 5xx UI shows a copyable reference id.
- [ ] Error reports contain route, status and request id only.
- [ ] No token, sample or request body is sent to the error service.

## Implementation notes

- If Sentry is skipped, keep the request id visible; it costs nothing.

## Testing

- Throttle the API to force a 500 and check the reference renders.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
