---
id: "QLT-06"
title: "Responsive and mobile pass"
milestone: "M4 — Quality"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["PRJ-02"]
spec_refs: ["§1.1"]
---

# QLT-06 · Responsive and mobile pass

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P1 |
| Size | M |
| Depends on | PRJ-02 |
| Spec | §1.1 |

## Context

Developers often open a FakeEnd URL on a phone while debugging; the workspace still needs to be usable.

## Scope

- Audit 360, 768, 1024 and 1440 px.
- Tables become cards; tabs scroll; code blocks scroll internally.
- Dialogs/drawers fit short viewports and the on-screen keyboard.
- Touch targets ≥ 44 px.

## Acceptance criteria

- [ ] No horizontal page scroll at 360 px on any route.
- [ ] Log table, schema tree and settings forms remain operable on touch.
- [ ] Copy buttons and primary CTAs are not hidden on mobile.
- [ ] Dialogs stay reachable when the keyboard opens.

## Implementation notes

- Prefer CSS container queries for the log table/card switch.

## Testing

- Playwright viewport snapshots; manual iOS Safari check.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
