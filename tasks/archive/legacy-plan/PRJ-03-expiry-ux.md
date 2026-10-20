---
id: "PRJ-03"
title: "Expiry and grace-period UX"
milestone: "M2 — Project workspace"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["PRJ-02"]
spec_refs: ["§0.2 Q7","§10.2"]
---

# PRJ-03 · Expiry and grace-period UX

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | M |
| Depends on | PRJ-02 |
| Spec | §0.2 Q7, §10.2 |

## Context

Projects live 7 days with no extension, then return 410 for 3 more days. Users must not be surprised by this.

## Scope

- Countdown badge based on `expiresAt`.
- Warning banner under 24 hours, including on save.
- Expired page explaining 410, the grace window and the no-extension rule.
- CTA to create a new project; disable all write actions when expired.

## Acceptance criteria

- [ ] The countdown updates at least once per minute and is correct across a reload.
- [ ] Under 24 h, a persistent warning is visible on the overview and endpoint pages.
- [ ] Expired projects show the 410 state and no edit controls.
- [ ] The expired page explains the 3-day grace period before purge.
- [ ] All timestamps are labelled as UTC in the UI where relevant.

## Implementation notes

- Use the server `expiresAt` as the source of truth; do not rely on a locally computed 7-day window.
- Handle small client/server clock skew by preferring the API's clock where available.

## Testing

- Unit tests with fake timers for the countdown formatting.
- Manual state check with a fixture expiring in 1 hour and one already expired.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
