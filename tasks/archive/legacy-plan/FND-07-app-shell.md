---
id: "FND-07"
title: "Application shell and navigation"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§2.1"]
---

# FND-07 · Application shell and navigation

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-01 |
| Spec | §2.1 |

## Context

A consistent frame around every page: navigation, footer, page headers and empty states.

## Scope

- Header: wordmark, New project, Recent projects, Help; active-route indication.
- Footer: privacy note, spec/version, health link in development.
- Responsive container, `PageHeader` and `EmptyState` components.
- Mobile navigation that does not trap focus or hide the primary CTA.

## Acceptance criteria

- [ ] Header and footer render on every public and project page.
- [ ] Navigation works by keyboard and at 360 px without horizontal scroll.
- [ ] Skip-to-content link is the first focusable element and targets `<main>`.
- [ ] No layout shift when the header becomes sticky.

## Implementation notes

- Keep the shell a server component; isolate the mobile menu as a client leaf.
- Do not surface the token or slug in the global header.

## Testing

- Keyboard tab-through of the shell.
- Visual check at 360/768/1440 px.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
