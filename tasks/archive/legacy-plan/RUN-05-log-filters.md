---
id: "RUN-05"
title: "Log filters and URL state"
milestone: "M3 — Try it and logs"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["RUN-03"]
spec_refs: ["§10.3.14"]
---

# RUN-05 · Log filters and URL state

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P1 |
| Size | M |
| Depends on | RUN-03 |
| Spec | §10.3.14 |

## Context

A busy project produces noise. Filters must be combinable, shareable and correct with cursors.

## Scope

- Filters: endpoint, exact status (100–599), injected (all/true/false).
- Persist filters in the URL query.
- Reset cursors and refetch on any filter change; 'Clear filters'.

## Acceptance criteria

- [ ] All three filters combine and map to the documented query parameters.
- [ ] Refreshing or sharing the URL restores the same view.
- [ ] Changing a filter discards old cursors and starts from the newest page.
- [ ] Invalid status input is rejected inline, not sent.
- [ ] The Logs tab passes `endpointId` by default and the page can clear it.

## Implementation notes

- Use `useSearchParams` with a shallow update to avoid remounting the table.
- Do not decode/encode booleans inconsistently; send `true`/`false` strings.

## Testing

- MSW assertions for each query parameter and combinations.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
