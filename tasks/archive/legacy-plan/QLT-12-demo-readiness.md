---
id: "QLT-12"
title: "Demo readiness and fixtures"
milestone: "M4 — Quality"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-13","RUN-04"]
spec_refs: ["§1.1"]
---

# QLT-12 · Demo readiness and fixtures

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P0 |
| Size | M |
| Depends on | WIZ-13, RUN-04 |
| Spec | §1.1 |

## Context

A hackathon demo fails on network, empty logs and missing tokens more often than on features.

## Scope

- Seeded demo project and sample JSON in `/help`.
- Offline fallback page when the API is unreachable.
- Five-minute demo script: create, show URL, trigger error, show log.
- Reset path for a clean run.

## Acceptance criteria

- [ ] The demo works end-to-end twice in a row without manual cleanup.
- [ ] A backup is available if the API is down (recorded flow or MSW demo mode).
- [ ] The demo script lists exact clicks and expected outcomes.
- [ ] A fresh token is captured before the demo and stored safely.

## Implementation notes

- Do not demo with a project expiring the same day.

## Testing

- Full rehearsal against production, timed.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
