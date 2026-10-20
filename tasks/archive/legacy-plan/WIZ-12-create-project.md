---
id: "WIZ-12"
title: "Create project"
milestone: "M1 — Create flow"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-09","FND-03"]
spec_refs: ["§10.3.4","§10.2"]
---

# WIZ-12 · Create project

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | M |
| Depends on | WIZ-09, FND-03 |
| Spec | §10.3.4, §10.2 |

## Context

The single write that turns a draft into a live mock. It returns the one-time token, so failure and success handling must be exact.

## Scope

- Build the request with name, endpoints (sample xor schema), options and settings.
- Submit with a pending state; block double submit.
- Handle 201, `400/409/413/415/422/429` with the right recovery per code.
- Clear the draft only after success; route to the success screen.

## Acceptance criteria

- [ ] Double-clicking Create produces exactly one project.
- [ ] `409 duplicate_endpoint` highlights the offending endpoints.
- [ ] `422 sample_invalid/sample_too_complex/response_too_large` routes back to the relevant step with context.
- [ ] `429` disables submit until `Retry-After` elapses.
- [ ] The draft survives a failed create and is cleared after success.
- [ ] A network failure never shows a success screen.

## Implementation notes

- Do not retry writes automatically; offer an explicit retry.
- Ignore the `Location` header in favour of the response body.
- Save the token according to the user's remember preference from WIZ-13, not before.

## Testing

- MSW tests for 201, 409, 422 and 429.
- Manual double-click and network-drop check.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
