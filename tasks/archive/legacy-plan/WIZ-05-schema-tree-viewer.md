---
id: "WIZ-05"
title: "Schema tree viewer"
milestone: "M1 — Create flow"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-12"]
spec_refs: ["§5.1","§5.3"]
---

# WIZ-05 · Schema tree viewer

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | L |
| Depends on | FND-12 |
| Spec | §5.1, §5.3 |

## Context

The inferred schema can contain thousands of nodes. Users need to scan it before editing, and the tree must stay fast and readable.

## Scope

- Recursive rows for object fields, array items and leaves.
- Type badge, generator name and key params, null/omit probabilities, nested array length.
- Expand/collapse all, expand to depth, search by field name.
- JSON Pointer copy per node; highlight warning paths.

## Acceptance criteria

- [ ] A 2,000-node schema renders without blocking the main thread for more than 200 ms.
- [ ] Search filters to matching nodes while keeping ancestors visible.
- [ ] Copied pointers resolve correctly, including keys containing `/` and `~`.
- [ ] Warnings appear on the correct node when their pointer resolves.
- [ ] Keyboard users can expand/collapse and move through rows.

## Implementation notes

- Assign stable internal IDs when constructing the tree; never use field names as keys.
- Virtualise or lazily render children beyond a depth/size threshold.

## Testing

- Unit tests for pointer escaping and tree construction.
- Performance check with a generated 2,000-node fixture.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
