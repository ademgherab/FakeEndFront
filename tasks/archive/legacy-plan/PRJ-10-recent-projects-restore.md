---
id: "PRJ-10"
title: "Recent projects and restore access"
milestone: "M2 — Project workspace"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["PRJ-01"]
spec_refs: ["§10.2","§0.2 D2"]
---

# PRJ-10 · Recent projects and restore access

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P1 |
| Size | M |
| Depends on | PRJ-01 |
| Spec | §10.2, §0.2 D2 |

## Context

Without accounts, the only way back is a saved link or slug + token. The app should make that recovery path obvious.

## Scope

- `/projects` list from local metadata: name, slug, expiry, token-present badge.
- Open, remove-from-device and expired states.
- Restore-access form (slug + token) that validates with `GET /projects/{slug}` before storing.
- Explain clearly that the token cannot be recovered by the service.

## Acceptance criteria

- [ ] Entries without a token show a lock and route to the restore form.
- [ ] Expired entries are marked and cannot be opened.
- [ ] Restore validates the pair and only then stores the token (if requested).
- [ ] Removing an entry never deletes the server project.
- [ ] The list is empty-state friendly for first-time users.

## Implementation notes

- Store only non-sensitive metadata persistently; the token is separate.
- Do not reveal whether a slug exists before token validation beyond what the API returns.

## Testing

- Unit tests for the metadata store; MSW tests for restore success and 403.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
