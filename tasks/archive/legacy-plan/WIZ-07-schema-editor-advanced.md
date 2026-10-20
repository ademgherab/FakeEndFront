---
id: "WIZ-07"
title: "Schema editor — advanced mode"
milestone: "M1 — Create flow"
priority: "P1"
size: "XL"
status: "todo"
owner: ""
depends_on: ["WIZ-06"]
spec_refs: ["§5.1","§6.5","§7.1","§10.4"]
---

# WIZ-07 · Schema editor — advanced mode

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P1 |
| Size | XL |
| Depends on | WIZ-06 |
| Spec | §5.1, §6.5, §7.1, §10.4 |

## Context

Power users need raw JSON, enums, array lengths and constant values. These edits must stay consistent with the visual tree.

## Scope

- Raw JSON mode with parse errors, shape validation and Apply.
- Enum values editor with dedupe and a 2–50 value hint.
- Nested array `length` min/max editor.
- `constant` value editor for leaves.
- Node count and depth meters against meta limits.
- Undo/redo (at least 20 steps) and keyboard shortcuts.

## Acceptance criteria

- [ ] Invalid raw JSON cannot be applied and shows the offending line.
- [ ] Applying valid raw JSON updates the visual tree and vice versa.
- [ ] Enum values reject duplicates and values outside the allowed range.
- [ ] The editor blocks saving when depth > 10 or nodes > 2,000, matching the server.
- [ ] Undo/redo restores both structure and values.

## Implementation notes

- Treat raw mode as a separate representation of the same immutable tree.
- Do not attempt to preserve formatting in raw mode; it is a JSON document.

## Testing

- Round-trip test: tree → raw → tree preserves data.
- Depth/node limit boundary tests.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
