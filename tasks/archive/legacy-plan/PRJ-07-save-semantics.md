---
id: "PRJ-07"
title: "Endpoint save semantics"
milestone: "M2 — Project workspace"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["PRJ-06"]
spec_refs: ["§10.3.10","§10.3.11","§10.3.12","§8.3"]
---

# PRJ-07 · Endpoint save semantics

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | L |
| Depends on | PRJ-06 |
| Spec | §10.3.10, §10.3.11, §10.3.12, §8.3 |

## Context

There are three write paths: full replace, schema-only, settings-only. Choosing the wrong one loses data, so the rule must be explicit and tested.

## Scope

- Track dirty fields and choose the narrowest endpoint.
- Schema-only → `PUT …/schema`; settings-only → `PUT …/settings`; method/path → full `PUT`.
- Send the complete current schema+settings on a full replace.
- Map `422` cross-check failures to the offending pointer/field without losing edits.

## Acceptance criteria

- [ ] Editing only the schema sends only the schema.
- [ ] Editing only settings sends only settings.
- [ ] Changing method or path sends a full endpoint object and preserves schema/settings.
- [ ] A failed save keeps the editor state and highlights the server error path.
- [ ] Successful save clears dirty state and refetches the endpoint.
- [ ] A `422 response_too_large` identifies the settings that caused it.

## Implementation notes

- Never send partial settings to the settings endpoint; it is a replace.
- The server re-validates existing settings against a new schema; surface those failures precisely.

## Testing

- MSW assertion of the exact request path/body for each edit type.
- Manual 422 by setting an impossible list size.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
