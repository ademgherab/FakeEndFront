---
id: "FND-11"
title: "Tooling, tests and CI"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-01"]
spec_refs: ["§11.3"]
---

# FND-11 · Tooling, tests and CI

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-01 |
| Spec | §11.3 |

## Context

A hackathon codebase still needs a fast feedback loop; CI must catch the mistakes that break the demo.

## Scope

- ESLint, Prettier, `tsc --noEmit`, Vitest with Testing Library, Playwright config.
- GitHub Actions: install, lint, typecheck, unit tests, build.
- Optional pre-commit hook running lint-staged.
- Dependabot or Renovate for npm updates.

## Acceptance criteria

- [ ] CI is green on the initial scaffold and fails on a deliberately broken type or test.
- [ ] `pnpm test` and `pnpm test:e2e` are documented and runnable locally.
- [ ] Playwright can boot the app with MSW enabled in CI.
- [ ] No test depends on the real backend.

## Implementation notes

- Keep CI under five minutes; cache pnpm and Playwright browsers.
- Do not gate merges on flaky visual tests.

## Testing

- Break a type and a unit test on a branch and confirm CI fails.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
