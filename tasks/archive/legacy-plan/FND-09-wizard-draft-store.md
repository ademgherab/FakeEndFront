---
id: "FND-09"
title: "Wizard draft store"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§5","§8"]
---

# FND-09 · Wizard draft store

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-01 |
| Spec | §5, §8 |

## Context

Losing a pasted sample or edited schema on refresh is unacceptable. The draft must survive reloads but never be mistaken for a saved project.

## Scope

- Zustand store for sample text, inferred schema, warnings, suggestions, endpoint drafts, settings and current step.
- Persist to `sessionStorage` under a versioned key; discard incompatible versions.
- Expose `resetDraft()` and `hasDraft` for guards.
- Strip transient state (loading, request ids, errors) before persisting.

## Acceptance criteria

- [ ] Refresh restores the exact step and edits.
- [ ] `resetDraft()` clears storage and returns to step 1.
- [ ] An incompatible draft version is discarded without crashing.
- [ ] Creating a project successfully clears the draft.

## Implementation notes

- Store schema objects as plain JSON; keep internal editor IDs out of persisted payloads.
- Never persist a token or a request body in the draft.

## Testing

- Unit test for persist/rehydrate, version mismatch and reset.
- Manual refresh at every wizard step.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
