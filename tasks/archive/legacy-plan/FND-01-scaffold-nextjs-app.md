---
id: "FND-01"
title: "Scaffold the Next.js app"
milestone: "M0 — Foundations"
priority: "P0"
size: "S"
status: "todo"
owner: ""
depends_on: []
spec_refs: ["§0.1 D5","§3"]
---

# FND-01 · Scaffold the Next.js app

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | S |
| Depends on | — |
| Spec | §0.1 D5, §3 |

## Context

The repository is empty. This task creates the Next.js skeleton every other task builds on; no backend calls yet.

## Scope

- Create the app with App Router, TypeScript, Tailwind and the `src/` directory; alias `@/*` to `src/*`.
- Initialise shadcn/ui with the neutral theme and the primitives used later: button, input, textarea, select, dialog, tabs, tooltip, toast, badge, skeleton.
- Enable TypeScript strictness (`strict`, `noUncheckedIndexedAccess`).
- Root layout: font, metadata, viewport, theme colour and a skip-to-content target.
- Remove all demo content and leave a placeholder home page.

## Acceptance criteria

- [ ] `pnpm install && pnpm dev` renders the placeholder page on a clean clone.
- [ ] `pnpm build`, `pnpm lint` and `pnpm tsc --noEmit` pass.
- [ ] A shadcn `Button` renders with Tailwind styles and the `@/` alias resolves.
- [ ] No component is marked `use client` unless it actually needs interactivity.

## Implementation notes

- Pin Node 20+ and pnpm through `packageManager` in `package.json`.
- Keep server components as the default; push `use client` to leaves.
- Do not add a second styling system or a global state library beyond the planned one.

## Testing

- CI runs install, lint, typecheck and build.
- Manual smoke of `/` at 360 px and 1440 px.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
