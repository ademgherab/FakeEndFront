---
id: "QLT-09"
title: "Frontend security review"
milestone: "M4 — Quality"
priority: "P0"
size: "S"
status: "todo"
owner: ""
depends_on: ["FND-08"]
spec_refs: ["§11.3"]
---

# QLT-09 · Frontend security review

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P0 |
| Size | S |
| Depends on | FND-08 |
| Spec | §11.3 |

## Context

The token is the only credential; a leak in analytics or logs is equivalent to handing over the project.

## Scope

- Audit for token leakage in URLs, logs, analytics, error reports and snippets.
- No `dangerouslySetInnerHTML` for user or generated content.
- CSP and security headers where the host allows.
- External links use `rel=noopener noreferrer`.
- Document the localStorage limitation in Help.

## Acceptance criteria

- [ ] A global search shows the token only in the API client and storage module.
- [ ] No third-party script receives request bodies or tokens.
- [ ] Generated JSON is rendered as text, never as HTML.
- [ ] Clipboard/download actions exclude the token unless explicitly labelled.

## Implementation notes

- Frontend cannot set all headers on Vercel; document what is enforced where.
- Prefer a strict `connect-src` limited to the API origin if a CSP is added.

## Testing

- Manual audit checklist plus a Playwright console/network assertion.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
