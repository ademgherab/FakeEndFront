---
id: "PRJ-09"
title: "Project settings and danger zone"
milestone: "M2 — Project workspace"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["PRJ-01"]
spec_refs: ["§10.3.6","§10.3.7","§10.3.15"]
---

# PRJ-09 · Project settings and danger zone

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P1 |
| Size | M |
| Depends on | PRJ-01 |
| Spec | §10.3.6, §10.3.7, §10.3.15 |

## Context

One place for project-level actions: rename, clear logs, delete the project, manage the local token.

## Scope

- Rename field (reuses PRJ-04).
- Clear logs with confirmation (`DELETE /logs`).
- Delete project with typed slug confirmation (`DELETE /projects/{slug}`).
- Token section: masked value, remove from this device, restore-access link.

## Acceptance criteria

- [ ] Delete requires typing the exact slug and warns that endpoints, logs and usage go too.
- [ ] Successful delete removes local token/metadata and routes home with a toast.
- [ ] Clearing logs asks for confirmation and updates the logs view.
- [ ] Token removal asks for confirmation and clears the query cache.
- [ ] Danger actions are visually separated from normal settings.

## Implementation notes

- Deletion cascades on the server; the frontend only needs to clean local state.

## Testing

- MSW tests for delete, clear logs and token removal.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
