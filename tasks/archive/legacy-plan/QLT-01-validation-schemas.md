---
id: "QLT-01"
title: "Shared validation schemas"
milestone: "M4 — Quality"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-03"]
spec_refs: ["§6.1","§8.2","§10.4"]
---

# QLT-01 · Shared validation schemas

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P0 |
| Size | L |
| Depends on | FND-03 |
| Spec | §6.1, §8.2, §10.4 |

## Context

The server is authoritative, but client validation prevents avoidable round-trips and puts errors next to the field.

## Scope

- Zod schemas for sample size, project name, path, method, endpoint settings and pagination.
- Reuse one path validator for the wizard and the endpoint editor.
- Messages that state the bound and the current value.
- Unit tests for every boundary in the spec.

## Acceptance criteria

- [ ] Boundaries pass/fail as specified: 0/1, `min <= max`, 10 codes, 100 KB, 200 chars, Int32 seed, depth 10, 2,000 nodes.
- [ ] Path rules reject query strings, fragments, `//`, `.`/`..`, invalid segments and duplicate template names.
- [ ] Normalized path collisions are detectable before submit.
- [ ] No inline schema is duplicated in a component.
- [ ] Server `validation_failed` errors still render when they bypass client checks.

## Implementation notes

- Do not mirror the entire server; enforce what the user can fix in the UI.
- Keep the byte-size helper in one place (`TextEncoder`).

## Testing

- Table-driven Vitest suite for every validator and boundary.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
