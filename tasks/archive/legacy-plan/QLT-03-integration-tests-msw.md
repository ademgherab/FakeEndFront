---
id: "QLT-03"
title: "Integration tests with MSW"
milestone: "M4 — Quality"
priority: "P1"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-10"]
spec_refs: ["§10.3"]
---

# QLT-03 · Integration tests with MSW

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P1 |
| Size | L |
| Depends on | FND-10 |
| Spec | §10.3 |

## Context

These tests catch wiring mistakes between components, the API client and the contract without a running backend.

## Scope

- Wizard happy path and a `422 sample_invalid` path.
- Duplicate endpoint on create.
- Token gate 401/403/410.
- Logs first page, older page and one polling tick.
- Schema edit + save request assertion.

## Acceptance criteria

- [ ] Each flow asserts both UI outcome and the outgoing request (path, body).
- [ ] Mock state resets between tests; no ordering dependency.
- [ ] Tests pass with `--run` repeatedly.
- [ ] Failures point to the broken step, not a generic timeout.

## Implementation notes

- Use Testing Library queries by role/label, not test IDs, where practical.

## Testing

- Run in CI on every push.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
