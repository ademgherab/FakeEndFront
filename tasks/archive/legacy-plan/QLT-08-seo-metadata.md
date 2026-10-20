---
id: "QLT-08"
title: "SEO and metadata"
milestone: "M4 — Quality"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: []
spec_refs: ["§3"]
---

# QLT-08 · SEO and metadata

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P2 |
| Size | S |
| Depends on | — |
| Spec | §3 |

## Context

Public pages should be shareable; token-gated pages must never be indexed.

## Scope

- Per-route title/description, canonical URLs, OG image.
- `robots.txt` and `sitemap.xml` for public routes only.
- `noindex` on project and builder-with-draft routes.
- Favicon set and theme colour.

## Acceptance criteria

- [ ] Landing and help pages have correct OG tags when shared.
- [ ] Project pages send `noindex, nofollow`.
- [ ] Sitemap excludes authenticated routes.
- [ ] No token or slug appears in metadata.

## Implementation notes

- Use the App Router metadata API; do not hand-write tags in `_document`.

## Testing

- Fetch rendered HTML in a test and assert meta tags.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
