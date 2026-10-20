---
id: "LAU-03"
title: "QA regression checklist"
milestone: "M5 — Launch"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["LAU-01"]
spec_refs: ["§10","§11"]
---

# LAU-03 · QA regression checklist

| Field | Value |
|---|---|
| Milestone | M5 — Launch |
| Priority | P0 |
| Size | M |
| Depends on | LAU-01 |
| Spec | §10, §11 |

## Context

One structured pass over the flows that matter prevents shipping a demo-breaking regression.

## Scope

- Execute the create, manage, runtime/logs and cross-cutting checklists from the master plan.
- File and fix blockers; document accepted issues.
- Re-run after fixes.

## Acceptance criteria

- [ ] All P0 checklist items pass against production.
- [ ] Every failure has an owner and a decision (fix/defer).
- [ ] The final run is recorded with date, build and tester.

## Implementation notes

- Use a fresh browser profile for token and first-run checks.

## Testing

- Checklist in `frontend-tasks.md` §10.1.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
