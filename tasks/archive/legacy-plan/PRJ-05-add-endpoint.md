---
id: "PRJ-05"
title: "Add endpoint to an existing project"
milestone: "M2 — Project workspace"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["PRJ-02","WIZ-06","WIZ-09"]
spec_refs: ["§10.3.8","§11.1"]
---

# PRJ-05 · Add endpoint to an existing project

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | L |
| Depends on | PRJ-02, WIZ-06, WIZ-09 |
| Spec | §10.3.8, §11.1 |

## Context

Phase 2 projects can grow beyond their first endpoint. This reuses the builder pieces without duplicating them.

## Scope

- Dialog or sub-route with sample/schema, method, path and settings.
- Reuse the schema editor, settings editor and preview components.
- `POST /projects/{slug}/endpoints`.
- Handle `409 duplicate_endpoint` and `422 endpoint_limit_reached`.

## Acceptance criteria

- [ ] The new endpoint appears in the overview after creation without a full reload.
- [ ] The limit from meta is enforced before submit and confirmed by the server.
- [ ] A duplicate route highlights method and path.
- [ ] Closing the dialog with unsaved input asks for confirmation.
- [ ] Inference and preview work exactly as in the wizard.

## Implementation notes

- Extract shared schema/settings editors during this task rather than copying wizard code.
- Refresh the project query after 201.

## Testing

- MSW tests for 201, 409 and 422 endpoint_limit_reached.
- Manual add of a second endpoint and a template collision.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
