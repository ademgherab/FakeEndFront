---
id: "QLT-05"
title: "Accessibility pass"
milestone: "M4 — Quality"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-06"]
spec_refs: ["§1.1"]
---

# QLT-05 · Accessibility pass

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P1 |
| Size | M |
| Depends on | WIZ-06 |
| Spec | §1.1 |

## Context

The schema tree and settings forms are unusually complex controls; accessibility cannot be bolted on at the end.

## Scope

- Keyboard-only run of the landing, wizard, editor, try-it and logs.
- Tree semantics (`role=tree`, `aria-expanded`, roving tabindex).
- Labels for every input, icon button and status badge.
- Focus management, contrast, reduced motion, axe scans.

## Acceptance criteria

- [ ] No critical/serious axe violations on shipped routes.
- [ ] Every action is reachable without a mouse.
- [ ] Focus is visible and never lost after dialogs/tab changes.
- [ ] Errors and toasts are announced (`role=alert`, `aria-live`).
- [ ] Colour is never the only signal for status or injected errors.

## Implementation notes

- Fix structure first, then ARIA; do not paper over bad markup.
- Test with VoiceOver on macOS at least once.

## Testing

- axe in Playwright; manual keyboard and screen-reader run.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
