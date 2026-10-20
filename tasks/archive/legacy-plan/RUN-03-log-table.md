---
id: "RUN-03"
title: "Request log table"
milestone: "M3 — Try it and logs"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["PRJ-06","FND-12"]
spec_refs: ["§10.3.14"]
---

# RUN-03 · Request log table

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P0 |
| Size | L |
| Depends on | PRJ-06, FND-12 |
| Spec | §10.3.14 |

## Context

Logs are how users debug their own integration. The table must be fast, scannable and reliable under polling.

## Scope

- Newest-first table: time, method, path, status, injected badge, delay, latency, endpoint.
- Initial load `limit=50`; 'Load older' uses `nextCursor` as `before`.
- Skeletons, empty state and error with retry.
- Row click opens the detail drawer.

## Acceptance criteria

- [ ] The first page loads with no `before`/`after` and shows newest first.
- [ ] Loading older appends rows and stops when `nextCursor` is null.
- [ ] Statuses are colour-coded with text, not colour alone.
- [ ] Rows preserve scroll position when older entries load.
- [ ] An empty project explains how to generate the first log entry.
- [ ] Timestamps render in local time with a UTC tooltip.

## Implementation notes

- Use the row `id` as the stable key.
- Do not refetch the whole table when new rows arrive; prepend.

## Testing

- MSW tests for first page, next page and exhausted cursor.
- Manual 1,000-row project performance check.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
