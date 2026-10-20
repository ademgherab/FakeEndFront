---
id: "FND-08"
title: "Edit-token storage service"
milestone: "M0 — Foundations"
priority: "P0"
size: "S"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§10.3.4","§11.3"]
---

# FND-08 · Edit-token storage service

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | S |
| Depends on | FND-01 |
| Spec | §10.3.4, §11.3 |

## Context

There are no accounts. The `editToken` is the only key to a project, returned once and never recoverable. Storage must be deliberate and leak-free.

## Scope

- Implement `saveToken(slug, token, remember)`, `getToken(slug)`, `removeToken(slug)` and `listKnownProjects()`.
- Use `localStorage` when `remember` is true; otherwise keep the token in memory for the session only.
- Store recent-project metadata separately: slug, name, expiry, last opened.
- Provide a masked formatter (`et_Qm3v…`) and a destructive clear action.

## Acceptance criteria

- [ ] Tokens are keyed per slug and never overwrite another project's token.
- [ ] `remember: false` leaves nothing token-related in persistent storage.
- [ ] Nothing in the module writes the token to console, analytics or error reports.
- [ ] Corrupt or legacy stored data is ignored and cleaned up.

## Implementation notes

- Do not encrypt in localStorage; it adds no real protection and complicates recovery. Document the limitation instead.
- Clear the React Query cache for a slug when its token is removed.

## Testing

- Unit tests with a mocked `localStorage`: save/get/remove, remember off, corrupted JSON.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
