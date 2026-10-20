---
id: "WIZ-06"
title: "Schema editor — basics"
milestone: "M1 — Create flow"
priority: "P0"
size: "XL"
status: "todo"
owner: ""
depends_on: ["WIZ-05"]
spec_refs: ["§5.1","§7.1","§10.4"]
---

# WIZ-06 · Schema editor — basics

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | XL |
| Depends on | WIZ-05 |
| Spec | §5.1, §7.1, §10.4 |

## Context

Inference is a starting point, not the answer. Users must be able to correct types, generators and field structure before creating the project.

## Scope

- Rename a field with uniqueness validation.
- Change a node type and choose a compatible generator from meta.
- Edit generator params with typed controls (number, boolean, string, enum list).
- Add/remove fields, reorder them, and edit nested object/array items.
- Set `nullProbability` and `omitProbability` (serialized as 0–1, displayed as %).
- Mark the schema dirty and feed the preview.

## Acceptance criteria

- [ ] Renaming a field keeps focus in the input and cannot create a duplicate name.
- [ ] Changing type resets the generator to a compatible default and never sends an invalid pair.
- [ ] Param inputs enforce integer/number/string types and required fields.
- [ ] Field order in the output matches the tree order exactly.
- [ ] Probabilities stay within 0–1 and round-trip through save.
- [ ] Every edit produces a new immutable schema tree (no shared mutation).

## Implementation notes

- Strip internal editor IDs before sending to the API.
- Do not render a free-text generator name; always pick from meta.
- Undo/redo lives in WIZ-07, but keep the update function pure so it can be added.

## Testing

- Unit tests for rename, type change, reorder and probability serialization.
- Manual edit of a nested array-of-objects sample, then preview.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
