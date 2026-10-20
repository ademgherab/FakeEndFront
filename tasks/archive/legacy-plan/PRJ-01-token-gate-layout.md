---
id: "PRJ-01"
title: "Project token gate and workspace layout"
milestone: "M2 — Project workspace"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-08","FND-06"]
spec_refs: ["§10.2","§10.3.5"]
---

# PRJ-01 · Project token gate and workspace layout

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | M |
| Depends on | FND-08, FND-06 |
| Spec | §10.2, §10.3.5 |

## Context

Projects have no accounts; access is slug plus token. The gate must validate the pair before rendering any project data and explain every auth failure.

## Scope

- Client-rendered `/p/[slug]` layout that reads the token and enables project queries only when present.
- Token entry form with slug prefilled from the route.
- Handle `401 missing_token`, `403 invalid_token`, `404 project_not_found`, `410 project_expired` distinctly.
- Clear-stored-token action after a 403 confirmation.
- Redirect expired projects to `/expired?slug=`.

## Acceptance criteria

- [ ] No project data is server-rendered or flashed before the token is validated.
- [ ] A missing token shows the entry form, not a generic 401 page.
- [ ] A wrong token shows 'token does not match' with re-entry and clear options.
- [ ] 404 and 410 render dedicated states with the right call to action.
- [ ] A successful entry stores the token only when the user opted in.
- [ ] The token never appears in the URL or DOM attributes.

## Implementation notes

- Gate on the client; do not attempt SSR with a token from localStorage.
- Disable React Query until a token exists to avoid a guaranteed 401.

## Testing

- MSW tests for all four auth outcomes.
- Manual: open a project in a fresh browser profile with no stored token.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
