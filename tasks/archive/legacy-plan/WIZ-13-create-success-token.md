---
id: "WIZ-13"
title: "Create-success screen and one-time token"
milestone: "M1 — Create flow"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["WIZ-12","FND-08","FND-12"]
spec_refs: ["§10.3.4","§5.4","§11.3"]
---

# WIZ-13 · Create-success screen and one-time token

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | L |
| Depends on | WIZ-12, FND-08, FND-12 |
| Spec | §10.3.4, §5.4, §11.3 |

## Context

The `editToken` is returned only here and only its hash is stored. If the user loses it, the project can never be managed again. This screen is the highest-risk UX in the product.

## Scope

- Show slug, base URL, every endpoint URL and the token once, with reveal/mask and copy.
- Download credentials as `.txt` and `.json`.
- Explicit warning plus an 'I saved it' checkbox gating Continue.
- Ready-to-paste `curl` and `fetch` snippets.
- Actions: open project, create another; save the token per the remember preference.
- Warn on navigation/reload before confirmation.

## Acceptance criteria

- [ ] The token is never displayed in full after leaving this screen; only a masked form remains.
- [ ] Copy works with a fallback when the clipboard API is unavailable.
- [ ] Download includes slug, token, base URL, endpoint URLs and expiry.
- [ ] Continue is disabled until the user confirms they saved the token.
- [ ] The token never appears in the URL, analytics or console.
- [ ] Reloading before confirmation warns that the token cannot be recovered.

## Implementation notes

- Do not auto-copy the token; make the action explicit so the user notices it.
- Persist the token only if the user chose 'remember on this device'; otherwise keep it in memory for the session.
- Use a Blob download and revoke the object URL afterwards.

## Testing

- Component tests for gating, copy fallback and download contents.
- Manual: leave and return to the project; confirm the token is masked/absent.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
