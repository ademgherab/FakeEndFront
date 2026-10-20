---
id: "FND-03"
title: "Typed API client and error normalisation"
milestone: "M0 — Foundations"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-02"]
spec_refs: ["§3","§3.1","§9.3","§10.2"]
---

# FND-03 · Typed API client and error normalisation

| Field | Value |
|---|---|
| Milestone | M0 — Foundations |
| Priority | P0 |
| Size | M |
| Depends on | FND-02 |
| Spec | §3, §3.1, §9.3, §10.2 |

## Context

Every management call shares auth, error parsing, cancellation and timeouts. One client prevents each screen from inventing its own response handling.

## Scope

- Implement `apiRequest<T>(path, { method, body, token, signal, timeoutMs })` returning status, headers, parsed data and `X-Request-Id`.
- Inject `Authorization: Bearer <editToken>` only when a token is supplied; set JSON headers; never send credentials.
- Parse `application/problem+json` and the runtime `{ error: { status, code, title, message, injected, requestId } }` shape into one `AppError`.
- Handle `204` (no body), `Retry-After`, abort and timeout as distinct outcomes.
- Retry idempotent GETs only, at most twice, on network errors and 5xx.

## Acceptance criteria

- [ ] Unit tests cover 200 JSON, 204, problem+json with `errors` and `traceId`, 429 with `Retry-After`, network failure, timeout and abort.
- [ ] Callers never inspect `response.ok` or parse error bodies themselves.
- [ ] The token never appears in thrown error messages, console output or analytics.
- [ ] A 413 body-limit rejection is distinguishable from a validation error.

## Implementation notes

- Keep the runtime JSON parser separate from the ProblemDetails parser but return the same `AppError` type.
- Expose the raw response only for the Try-it console, which calls the FakeEnd runtime directly.

## Testing

- Vitest unit suite with a stubbed `fetch` for every branch above.
- Typecheck that generic responses infer `T` at the call site.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
