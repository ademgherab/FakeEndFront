---
id: "FND-04"
title: "Generate TypeScript types from OpenAPI"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-03"]
spec_refs: ["§3","§10.1"]
---

# FND-04 · Generate TypeScript types from OpenAPI

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-03 |
| Spec | §3, §10.1 |

## Context

The API contract is the source of truth. Types must be generated from `/openapi/v1.json`, not guessed from prose; an interim file keeps the app compiling until the backend publishes it.

## Scope

- Add a `gen:types` script using `openapi-typescript` against `${NEXT_PUBLIC_API_BASE_URL}/openapi/v1.json`.
- Commit the output to `src/lib/api/generated/schema.d.ts`.
- Add a CI check that regeneration produces no diff.
- If the endpoint is unavailable, commit a clearly marked interim type file at the same path.

## Acceptance criteria

- [ ] `pnpm gen:types` succeeds against a live backend and fails loudly with an actionable message when unreachable.
- [ ] CI fails when the committed generated file is stale.
- [ ] App code imports API types only from the generated module.
- [ ] The interim file is deleted once the backend publishes the document.

## Implementation notes

- Pin the generator version; upgrades can churn the output and hide real contract changes.
- Never hand-edit the generated file. Interim edits are allowed only in the marked interim file.

## Testing

- Run the generator twice and confirm the second run is a no-op.
- CI job on a branch with a deliberately stale file must fail.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
