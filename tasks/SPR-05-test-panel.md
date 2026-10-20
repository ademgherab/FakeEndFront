---
id: "SPR-05"
title: "Test panel, headers and injected-error badge"
milestone: "Sprint — 65–80 min"
priority: "P0"
size: "15 min"
status: "todo"
owner: ""
depends_on: ["SPR-04"]
spec_refs: ["§3.5","§6","§9"]
---

# SPR-05 · Test panel, headers and injected-error badge

| Field | Value |
|---|---|
| Milestone | Sprint — 65–80 min |
| Priority | P0 |
| Size | 15 min |
| Depends on | SPR-04 |
| Spec | §3.5, §6, §9 |

## Context

The mock URL is only useful if the user can call it immediately. This panel sends a real
request from the browser to the mock runtime and renders the response, including the
runtime headers that prove delay and error injection are working.

## Scope

- Show the panel only after a project has been created.
- Add **Test endpoint**:
  - Calls the created endpoint URL directly with `fetch`.
  - Method comes from the settings form.
  - `GET`: no body.
  - `POST`/`PUT`: `Content-Type: application/json`, body `{}`.
  - `DELETE`: no body.
  - `cache: "no-store"`.
  - Do not throw on 4xx/5xx; the response is the payload to render.
- While the request runs:
  - Disable the button, set `aria-busy="true"`, label "Testing…".
  - Measure latency with `performance.now()`.
- Render:
  - Status code and status text.
  - Latency in ms.
  - Header chips for `X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`.
  - A **simulated** badge when the runtime envelope has `error.injected === true` or the
    `X-Mock-Injected-Error` header is `"true"`.
  - Body as formatted JSON when the response is JSON.
  - Raw text when the response is not JSON.
  - For `RuntimeErrorBody`, show the envelope's `status`, `code`, `title`, `message` and
    `requestId`.
- On network/CORS failure, show:
  `Cannot reach the mock URL. Is the backend running and is CORS enabled?`
  Include the attempted URL.
- Re-running the test must **not** create a new project.

## Acceptance criteria

- [ ] A `GET` test shows status, body, latency and the three runtime header chips.
- [ ] Calling twice returns different data (no client-side caching).
- [ ] With error rate 100%, the panel shows the injected status and a **simulated** badge.
- [ ] The runtime error envelope is readable; `injected: true` is visible.
- [ ] A non-JSON response shows raw text plus status.
- [ ] `POST`/`PUT` send `{}`; `DELETE` and `GET` send no body.
- [ ] A network/CORS failure shows an actionable message with the URL.
- [ ] Testing again does not create another project.
- [ ] The button exposes `aria-busy` while testing.

## Implementation notes

- Do not use the management `request<T>` helper here; it throws on 4xx/5xx. Use raw
  `fetch`.
- Read headers with `response.headers.get(...)`. If they are `null`, show "—" rather than
  hiding the chip; this makes CORS exposure problems visible.
- Parse JSON only when `content-type` includes `application/json`; otherwise use
  `await response.text()`.
- Keep the last successful response visible while a new request is in flight if possible.
- Do not add a "copy as cURL" feature; it is out of scope.
- Do not poll or auto-run the test.

## Testing

- Happy path with delay `0`; then delay `300–1500` and confirm `X-Mock-Delay-Ms`.
- Errors `0%` vs `100%`; confirm the injected badge.
- Non-JSON endpoint (if available) or temporarily return text.
- Stop the backend and confirm the CORS/network message.
- Test twice; confirm data changes and no new project is created.

## Definition of Done

- [ ] Acceptance criteria verified against the real backend.
- [ ] Loading, error and success states handled.
- [ ] Works at 360 px and by keyboard.
- [ ] Build and typecheck pass.
- [ ] No response body is logged to the console.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
