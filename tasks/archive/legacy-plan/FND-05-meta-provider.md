---
id: "FND-05"
title: "Meta provider and limits hook"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-03"]
spec_refs: ["§10.3.1","§0.2 Q8"]
---

# FND-05 · Meta provider and limits hook

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-03 |
| Spec | §10.3.1, §0.2 Q8 |

## Context

`GET /meta` owns every limit, method, success status and generator definition. Hard-coding any value breaks silently when backend configuration changes.

## Scope

- Meta provider plus `useMeta()` exposing `data`, `isLoading`, `error` and `refresh()`.
- Cache in memory and `sessionStorage`, keyed by API base URL and app version.
- Gate only the routes that need meta (builder, workspace); keep the landing page usable without it.

## Acceptance criteria

- [ ] Exactly one network request per session; manual refresh updates the cache and consumers.
- [ ] Generator dropdowns and numeric bounds in the builder derive from meta.
- [ ] A meta failure renders a retry action, not a blank page.
- [ ] A malformed meta response is rejected with a readable error.

## Implementation notes

- Keep the raw response available in development for debugging.
- Bump the cache key when the frontend depends on a newer meta shape.

## Testing

- MSW test: success, failure + retry, cached second mount makes no request.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
