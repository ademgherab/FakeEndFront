---
id: "RUN-01"
title: "Try-it console"
milestone: "M3 — Try it and logs"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["PRJ-06","FND-12"]
spec_refs: ["§9.2","§9.3","§8.4"]
---

# RUN-01 · Try-it console

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P0 |
| Size | L |
| Depends on | PRJ-06, FND-12 |
| Spec | §9.2, §9.3, §8.4 |

## Context

The fastest way to prove the mock works is to call it from the UI and show the real response, including injected errors and delay headers.

## Scope

- Compose the runtime URL from `endpoint.url` or `baseUrl + path`.
- Render inputs for `{param}` segments and arbitrary query parameters.
- Body editor for POST/PUT with JSON validation and `Content-Type`.
- Send a direct `fetch` without the bearer token; measure client latency.
- Show status, key headers, pretty/raw/original body and an injected-error badge.

## Acceptance criteria

- [ ] Path params and query values are URL-encoded; a missing param blocks sending.
- [ ] GET/POST/PUT/DELETE are supported; DELETE handles 204 with no body.
- [ ] `X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error` and pagination headers are displayed when present.
- [ ] A simulated 503 is visually distinct from a network/CORS failure.
- [ ] Switching method or path resets incompatible body state.
- [ ] Requests can be cancelled; results never apply to a superseded request.

## Implementation notes

- Runtime CORS exposes the headers listed in the spec; do not try to read others.
- HEAD and PATCH are unsupported; do not offer them.
- Do not send the edit token to the runtime URL.

## Testing

- MSW runtime handler tests for 200, 204, injected 503, 404 and 405.
- Manual CORS check against the deployed backend.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
