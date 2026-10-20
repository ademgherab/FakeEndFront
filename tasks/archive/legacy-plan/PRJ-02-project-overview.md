---
id: "PRJ-02"
title: "Project overview"
milestone: "M2 — Project workspace"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["PRJ-01","FND-12"]
spec_refs: ["§10.3.5","§10.5"]
---

# PRJ-02 · Project overview

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | L |
| Depends on | PRJ-01, FND-12 |
| Spec | §10.3.5, §10.5 |

## Context

The project home shows what exists, how to call it, how much quota is left and when it disappears.

## Scope

- Header: name, slug, base URL with copy, expiry countdown, usage progress.
- Endpoint cards: method badge, path, full URL copy, settings summary, updated time.
- Actions: add endpoint, open endpoint, delete endpoint.
- Empty state when the project has zero endpoints.

## Acceptance criteria

- [ ] All values come from `GET /projects/{slug}` and no field is invented client-side.
- [ ] Copy produces the exact runtime URL, including template placeholders.
- [ ] Usage shows `requestsToday / dailyLimit` and caps visually at 100%.
- [ ] Add endpoint is disabled at the meta limit with the reason shown.
- [ ] The page refetches on window focus and after any mutation.
- [ ] Zero endpoints renders an empty state with a working CTA.

## Implementation notes

- Do not compute quota from local counters; read it from the API.
- Show settings as a compact summary, not the full JSON.

## Testing

- MSW test for populated and empty projects.
- Manual copy of root and template URLs.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
