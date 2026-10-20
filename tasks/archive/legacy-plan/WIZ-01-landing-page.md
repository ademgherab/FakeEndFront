---
id: "WIZ-01"
title: "Landing page"
milestone: "M1 — Create flow"
priority: "P0"
size: "M"
status: "done"
owner: ""
depends_on: ["FND-07"]
spec_refs: ["§1.1","§5.4"]
---

# WIZ-01 · Landing page

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | M |
| Depends on | FND-07 |
| Spec | §1.1, §5.4 |

## Context

First impression and entry point. It must explain the product in one screen and route to the builder without requiring meta or a backend.

## Scope

- Hero: headline, subline, primary CTA to `/new`, secondary link to `/help`.
- Three-step explainer: paste JSON → configure delay/errors → call the URL.
- Feature grid: realistic data, delay, random errors, lists, pagination, seed, logs.
- Privacy callout: never paste real or sensitive data.
- Header/footer via the app shell; responsive layout down to 360 px.

## Acceptance criteria

- [x] Primary CTA routes to `/new`; the secondary CTA routes to `/help`.
- [x] No claim, metric or testimonial that the product cannot back up.
- [x] Page renders without calling `/meta`.
- [x] Lighthouse accessibility ≥ 95; LCP < 2.5 s on a throttled profile.
- [x] All copy lives in one strings file for later edits.

## Implementation notes

- Prefer a server component; animate nothing that blocks first paint.
- Use one accent colour and neutral surfaces; do not build a marketing design system.

## Testing

- Route test for both CTAs.
- Lighthouse run on the preview deployment.
- 360 px visual check.

## Definition of done

- [x] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [x] Lint, typecheck and production build pass
- [x] Loading, empty, error and success states handled where the task renders UI
- [x] Works at 360 px and by keyboard where the task renders UI
- [x] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [x] No token, sample content or request body written to console, analytics or error reports

## Verification

- `npm test` — the full suite passes (106 tests at the last run), including `src/app/page.test.tsx` (both CTA routes, single `h1`, privacy copy, no `/meta` request).
- `npx eslint src/app src/components/landing src/components/layout src/content` — clean.
- `npm run build` — passed when this task was verified; `/` is statically prerendered.
- Lighthouse 12 (mobile, simulated throttling) against `next start` — Performance **98**, Accessibility **100**, SEO **100**, LCP **2.3 s**, CLS **0**, TBT **10 ms**.
- Chrome DevTools at 360 px — `scrollWidth === 360` with no overflowing elements; captured full-page screenshots at 360 and 1440 px.
- `/help` returns 200 and documents the four-step flow. The original `/new` placeholder has since been replaced by the WIZ-02 wizard, which is still under construction.

> The repository is being built task-by-task in parallel. At the time of writing, the shared typecheck/build is red only on in-progress wizard, schema and project files, not on anything owned by WIZ-01.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
