---
id: "LAU-02"
title: "Cross-browser smoke test"
milestone: "M5 — Launch"
priority: "P0"
size: "S"
status: "todo"
owner: ""
depends_on: ["LAU-01"]
spec_refs: ["§1.1"]
---

# LAU-02 · Cross-browser smoke test

| Field | Value |
|---|---|
| Milestone | M5 — Launch |
| Priority | P0 |
| Size | S |
| Depends on | LAU-01 |
| Spec | §1.1 |

## Context

Clipboard, code editors and fetch headers behave differently across browsers.

## Scope

- Chrome, Safari, Firefox, iOS Safari.
- Create, copy, try-it, logs live, schema edit.
- Record known issues and workarounds.

## Acceptance criteria

- [ ] The full happy path works on all four targets.
- [ ] Clipboard has a visible fallback if permission is denied.
- [ ] Log polling pauses/resumes correctly after tab switching on mobile Safari.
- [ ] Any unsupported feature degrades with a message, not a blank screen.

## Implementation notes

- Test Safari early; it is the most likely to break clipboard and focus behaviour.

## Testing

- Manual checklist per browser, attached to the release.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
