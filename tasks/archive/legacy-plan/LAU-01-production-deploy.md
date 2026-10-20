---
id: "LAU-01"
title: "Production deployment"
milestone: "M5 — Launch"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-02","FND-11"]
spec_refs: ["§2.1","§10.6"]
---

# LAU-01 · Production deployment

| Field | Value |
|---|---|
| Milestone | M5 — Launch |
| Priority | P0 |
| Size | M |
| Depends on | FND-02, FND-11 |
| Spec | §2.1, §10.6 |

## Context

The app must be reachable over HTTPS with a correctly configured API origin and CORS.

## Scope

- Vercel project with preview and production environments.
- Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_APP_URL` per environment.
- Verify management CORS allows the production origin (preflight included).
- HTTPS only; optional custom domain.

## Acceptance criteria

- [ ] Production build succeeds and the landing page loads over HTTPS.
- [ ] Create project and logs work from the deployed origin.
- [ ] A CORS failure is diagnosable from the browser console and Help page.
- [ ] Preview deployments are excluded from the API allowlist unless intentionally added.

## Implementation notes

- Env values are baked at build time; redeploy after changing them.
- Do not put any token or secret in `NEXT_PUBLIC_*`.

## Testing

- Smoke: create, copy, try it, open logs on production.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
