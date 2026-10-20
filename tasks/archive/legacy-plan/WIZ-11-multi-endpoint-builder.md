---
id: "WIZ-11"
title: "Multi-endpoint builder (Phase 2)"
milestone: "M1 — Create flow"
priority: "P1"
size: "L"
status: "todo"
owner: ""
depends_on: ["WIZ-09"]
spec_refs: ["§10.3.4","§10.4","§11.1"]
---

# WIZ-11 · Multi-endpoint builder (Phase 2)

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P1 |
| Size | L |
| Depends on | WIZ-09 |
| Spec | §10.3.4, §10.4, §11.1 |

## Context

Phase 2 allows several endpoints per project. The wizard must support that without turning into a spreadsheet.

## Scope

- Endpoint list with add/remove and per-endpoint method/path.
- Per-endpoint sample-or-schema and settings.
- Client-side duplicate detection using normalized paths.
- Enforce `maxEndpointsPerProject` from meta.
- Independent infer and preview per endpoint.

## Acceptance criteria

- [ ] Adding beyond the limit is disabled with the limit explained.
- [ ] Duplicate `(method, normalized path)` is detected before submit, including `/Users/{id}` vs `/users/{userId}`.
- [ ] Each endpoint carries exactly one of sample or schema in the create payload.
- [ ] Removing an endpoint does not mutate the others.
- [ ] Endpoint order is stable and visible.

## Implementation notes

- Normalize paths exactly like the server: lower-case static segments, template segments become `{}`.
- Do not auto-submit; creation stays a single explicit action.

## Testing

- Unit tests for normalized path collision.
- MSW create payload assertion for two endpoints.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
