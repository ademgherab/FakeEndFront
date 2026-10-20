---
id: "QLT-02"
title: "Unit tests for core logic"
milestone: "M4 — Quality"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["WIZ-06"]
spec_refs: ["§5.1","§8.2"]
---

# QLT-02 · Unit tests for core logic

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P0 |
| Size | L |
| Depends on | WIZ-06 |
| Spec | §5.1, §8.2 |

## Context

Schema traversal, pointers and settings estimation are where subtle bugs hide and where E2E tests are slowest to diagnose.

## Scope

- Tests for JSON Pointer escape/resolve/append/parent.
- Tests for tree walks, node count, depth, field uniqueness, generator-node compatibility.
- Tests for settings defaults, payload mapping and worst-case size estimate.
- Tests for error-code mapping and token storage.

## Acceptance criteria

- [ ] ≥ 80% line coverage on `lib/schema`, `lib/settings`, `lib/errors`, `lib/storage`.
- [ ] Pointer tests cover keys containing `/` and `~`, array indices and missing paths.
- [ ] Defaults tests are table-driven per HTTP method.
- [ ] Tests run in under 10 s and do not touch the network.

## Implementation notes

- Prefer pure functions so tests do not need React.
- Use fixtures that mirror real inference output.

## Testing

- `pnpm test --coverage` in CI.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
