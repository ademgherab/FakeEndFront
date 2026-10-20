---
id: "QLT-10"
title: "Documentation and runbook"
milestone: "M4 — Quality"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: []
spec_refs: ["§1.1"]
---

# QLT-10 · Documentation and runbook

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P1 |
| Size | M |
| Depends on | — |
| Spec | §1.1 |

## Context

The next developer (or judge) needs to run the app, point it at an API and understand the token model in minutes.

## Scope

- README: prerequisites, env vars, dev, dev:mock, gen:types, test, e2e, build.
- User quickstart: create, copy URL, test, read logs.
- Troubleshooting: CORS, 401/403, 410, 429, oversized sample.
- Architecture note: routes, token storage, polling.

## Acceptance criteria

- [ ] A fresh clone reaches a running app by following the README with no tribal knowledge.
- [ ] Every env var is documented with an example.
- [ ] The token model and its irreversibility are explained.
- [ ] Known limitations are listed honestly.

## Implementation notes

- Keep the README short; link to the help page for user-facing docs.

## Testing

- Have someone else follow the README from scratch.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
