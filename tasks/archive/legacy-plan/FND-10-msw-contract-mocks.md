---
id: "FND-10"
title: "MSW contract mocks"
milestone: "M0 — Foundations"
priority: "P1"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-03","FND-04"]
spec_refs: ["§10.1"]
---

# FND-10 · MSW contract mocks

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P1 |
| Size | L |
| Depends on | FND-03, FND-04 |
| Spec | §10.1 |

## Context

Frontend work must not be blocked by backend availability. Mocks generated from the OpenAPI contract also make integration tests realistic.

## Scope

- Handlers for `/meta`, `/infer`, `/preview`, project CRUD, endpoint CRUD, `/logs` and the mock runtime.
- Fixtures for success and every documented error code, including an injected 503.
- Stateful in-memory project/endpoint/log store so create → read → update works in a session.
- `pnpm dev:mock` mode that enables the worker automatically in development.

## Acceptance criteria

- [ ] The full create → open project → save → try it → logs path works with no backend.
- [ ] Each handler validates the bearer token and returns 401/403 like the real API.
- [ ] Logs support `before`, `after`, `limit`, endpoint/status/injected filters.
- [ ] Fixtures match the generated types.

## Implementation notes

- Reset mock state between tests to keep them deterministic.
- Keep mock latency short but non-zero so loading states are exercised.

## Testing

- Integration tests rely on these handlers; smoke `/dev` route or a debug page.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
