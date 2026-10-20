# T02 — Error handling and API contracts

- **Milestone:** M0
- **Depends on:** T00
- **Spec refs:** §3, §3.1, §10.2, §9.3, **Appendix B (missing — see README)**

## Goal

One consistent error contract across both surfaces: RFC 9457 ProblemDetails for the Management API, the fixed `{ error: { ... } }` envelope for the mock runtime, and a stable machine-readable `code` the frontend switches on.

## Scope

- Exception-handling middleware plus a validation-to-ProblemDetails mapper.
- Central `ErrorCodes` constants (the catalog).
- Custom `X-Request-Id` middleware and `traceId` correlation.
- Strict JSON / content-type / body-limit responses.

## Implementation checklist

- [ ] Management error body exactly matches §3.1: `type`, `title`, `status`, `code`, `detail`, `traceId`, optional `errors`.
- [ ] `errors` keys use dotted/indexed paths into the request body (`endpoints[0].settings.delay.maxMs`).
- [ ] Runtime error body exactly matches §9.3: `error.status`, `error.code`, `error.title`, `error.message`, `error.injected`, `error.requestId`.
- [ ] `Retry-After` (seconds) on every `429`; also on injected `429`/`503` at runtime (§9.3).
- [ ] `405` carries `Allow`.
- [ ] `401` carries `WWW-Authenticate: Bearer`.
- [ ] `413` for body limits, `415` for non-JSON management requests.
- [ ] Unhandled exception → `500 internal_error` with `traceId`, no stack trace or connection string leaked.
- [ ] Every response gets `X-Request-Id` (GUID); use it as the runtime `requestId`.
- [ ] Codes implemented at minimum: `validation_failed`, `sample_invalid`, `sample_too_complex`, `response_too_large`, `endpoint_limit_reached`, `duplicate_endpoint`, `endpoint_not_found`, `project_not_found`, `project_expired`, `missing_token`, `invalid_token`, `rate_limited`, `daily_quota_exceeded`, `invalid_pagination`, `method_not_allowed`, `payload_too_large`, `unsupported_media_type`, `generation_failed`, `injected_error`, `internal_error`.
- [ ] Keep `type` URLs under a configurable base (`https://example.com/errors/{code}`).
- [ ] Unknown-property binding errors map to `validation_failed` with the property path, not a generic model-state dump.

## Acceptance criteria

- [ ] A malformed JSON body returns `400 validation_failed` with JSON content type, not an HTML developer page.
- [ ] A validation failure never leaks internal types or property C# names.
- [ ] Every 4xx/5xx has a `code`; no endpoint returns a bare status with no body (except `204`).
- [ ] `X-Request-Id` is present on success, validation error, injected error, and unhandled exception responses.

## Tests

- Unit tests per exception mapping.
- Integration tests asserting exact JSON keys for one representative of each error family.
- Snapshot test for the ProblemDetails shape.

## Notes

- Appendix B is missing from the spec. Generate `docs/error-catalog.md` from the `ErrorCodes` constants and treat it as the missing appendix; do not invent codes beyond the spec text without updating it.
