---
id: "FND-12"
title: "Shared UI primitives"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§9.3","§10.5"]
---

# FND-12 · Shared UI primitives

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-01 |
| Spec | §9.3, §10.5 |

## Context

Copying URLs and reading JSON is 80% of the product surface. These primitives must be right once, not reimplemented per page.

## Scope

- `CopyButton` with copied state, accessible label and a fallback when the clipboard API is unavailable.
- `JsonViewer` with pretty/raw modes, collapse, line numbers and copy.
- `ConfirmDialog` with optional typed phrase, destructive styling and focus management.
- `MethodBadge`, `StatusBadge`, `TimeAgo`, `RelativeCountdown`, `CodeBlock`.
- A `/dev/components` page to review them without a backend.

## Acceptance criteria

- [ ] Copy works on HTTPS and shows a visible success state for 2 s.
- [ ] `JsonViewer` handles large objects without freezing on 5,000 lines.
- [ ] Dialogs trap focus, close on Escape and return focus to the trigger.
- [ ] Status colours are distinguishable without relying on colour alone (icon/text).

## Implementation notes

- Keep components presentational; no data fetching inside them.
- Use `aria-live` for copy feedback.

## Testing

- Testing Library tests for copy, dialog focus and JSON rendering modes.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
