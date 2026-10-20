---
id: "FND-02"
title: "Environment and config module"
milestone: "M0 — Foundations"
priority: "P0"
size: "S"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§3","§10.3"]
---

# FND-02 · Environment and config module

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | S |
| Depends on | FND-01 |
| Spec | §3, §10.3 |

## Context

All network configuration must come from one module so local, staging and production targets can be swapped without code changes.

## Scope

- Add `.env.example` with `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL` and optional `NEXT_PUBLIC_MOCK_BASE_URL`.
- Create `src/lib/config.ts` that reads, validates and exports a typed `config` object.
- Normalise trailing slashes so URL joins cannot produce `//`.
- Document every variable and a local example in the README.

## Acceptance criteria

- [ ] A missing or malformed API URL fails fast in development with a message naming the variable.
- [ ] Values are read only through `config`; no component reads `process.env` directly.
- [ ] `config.appUrl` is used for canonical links and OG metadata.
- [ ] The mock base URL falls back to `meta.mockBaseUrl` at runtime.

## Implementation notes

- `NEXT_PUBLIC_*` values are inlined at build time and are not secrets.
- Validate with a tiny hand-written guard; do not add a config library for three variables.

## Testing

- Unit test: missing variable throws, valid values parse, trailing slashes are stripped.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
