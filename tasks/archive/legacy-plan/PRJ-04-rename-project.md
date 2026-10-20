---
id: "PRJ-04"
title: "Rename project"
milestone: "M2 — Project workspace"
priority: "P1"
size: "S"
status: "todo"
owner: ""
depends_on: ["PRJ-02"]
spec_refs: ["§10.3.6"]
---

# PRJ-04 · Rename project

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P1 |
| Size | S |
| Depends on | PRJ-02 |
| Spec | §10.3.6 |

## Context

Projects are created with an optional name. Renaming keeps the list meaningful, and `null` clears it.

## Scope

- Inline edit or dialog with a 1–60 character limit when non-empty.
- `PATCH /projects/{slug}` with `{ name }`; `null` clears.
- Optimistic update with rollback on failure.

## Acceptance criteria

- [ ] Saving updates the header and the recent-projects list.
- [ ] Empty input sends `null` and renders an 'Untitled project' fallback.
- [ ] A failed request restores the previous name and shows an error.
- [ ] The request cannot be submitted while another save is pending.

## Implementation notes

- Trim whitespace before sending; do not send an empty string.

## Testing

- MSW tests for success, null name and failure rollback.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
