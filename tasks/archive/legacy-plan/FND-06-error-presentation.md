---
id: "FND-06"
title: "Error normalisation, boundaries and messages"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-03"]
spec_refs: ["§3.1","§9.3","§10.2","Appendix B (missing)"]
---

# FND-06 · Error normalisation, boundaries and messages

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-03 |
| Spec | §3.1, §9.3, §10.2, Appendix B (missing) |

## Context

Users must always know what happened and what to do next. Centralising code-to-message mapping keeps 60+ error paths consistent.

## Scope

- Create the `AppError` type and a `code → { title, message, action }` map covering the codes in the spec.
- Build `<ErrorAlert>` for inline errors, a toast helper and a `RetryAfterCountdown` component.
- Add `error.tsx`, `global-error.tsx` and `not-found.tsx` with recovery links.
- Show `traceId` / `X-Request-Id` as a copyable reference in 500 states.

## Acceptance criteria

- [ ] Every documented error code renders a specific, actionable message.
- [ ] Unknown codes fall back to the server `title`/`detail` without exposing stack traces.
- [ ] A 429 disables the triggering action until `Retry-After` elapses.
- [ ] Render errors are caught by a boundary that offers reload and home.

## Implementation notes

- Keep the message map in one file and test it against the enumerated codes.
- Do not show `detail` from the server when it contains raw internals; log it instead.

## Testing

- Unit test that every code in the spec has a mapped message.
- Manual check of 401/403/404/410/413/422/429/500 rendering.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
