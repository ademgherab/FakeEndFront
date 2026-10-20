---
id: "RUN-07"
title: "Clear request logs"
milestone: "M3 — Try it and logs"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: ["RUN-03"]
spec_refs: ["§10.3.15"]
---

# RUN-07 · Clear request logs

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P2 |
| Size | S |
| Depends on | RUN-03 |
| Spec | §10.3.15 |

## Context

A reset is useful before a demo or after noisy debugging.

## Scope

- `DELETE /projects/{slug}/logs` behind a confirmation dialog.
- Empty the table, reset `latestId`, stop/rearm polling.
- Success toast and failure inline error.

## Acceptance criteria

- [ ] Confirmation is required and names the project.
- [ ] The table becomes empty without a reload and `latestId` resets.
- [ ] Polling does not resurrect deleted rows.
- [ ] Failure leaves the table unchanged and reports the error.

## Implementation notes

- Clear the local cache for the logs query, not just the component state.

## Testing

- MSW test for 204 and failure.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
