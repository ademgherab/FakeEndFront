---
id: "PRJ-08"
title: "Delete endpoint"
milestone: "M2 — Project workspace"
priority: "P1"
size: "S"
status: "todo"
owner: ""
depends_on: ["PRJ-06"]
spec_refs: ["§10.3.13"]
---

# PRJ-08 · Delete endpoint

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P1 |
| Size | S |
| Depends on | PRJ-06 |
| Spec | §10.3.13 |

## Context

Deleting an endpoint is irreversible and removes its logs' endpoint association. Confirmation must show what disappears.

## Scope

- Confirmation dialog showing method + path.
- `DELETE /projects/{slug}/endpoints/{id}`.
- Navigate back to the overview and invalidate queries.

## Acceptance criteria

- [ ] The dialog names the endpoint and states that logs remain but lose the link.
- [ ] A successful delete returns to the overview and removes the card.
- [ ] `404 endpoint_not_found` is handled as already deleted.
- [ ] The action is disabled while in flight.

## Implementation notes

- A project may legitimately have zero endpoints after deletion.

## Testing

- MSW tests for 204 and 404.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
