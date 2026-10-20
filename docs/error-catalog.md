# Error catalog (Appendix B)

This is the catalog referenced by spec §3.1 and §9.3. It mirrors `MockApi.Core.Errors.ErrorCodes`
(`ErrorCodes.All`); add a code there first, then update this table. The machine-readable `code` is a
stable contract and must never change.

Management errors use `application/problem+json; charset=utf-8` and the RFC 9457 body:

```json
{
  "type": "https://example.com/errors/validation_failed",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "code": "validation_failed",
  "detail": "See 'errors' for details.",
  "traceId": "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11",
  "errors": {
    "endpoints[0].settings.delay.maxMs": ["The value is invalid."]
  }
}
```

`type` is `{MockApi:Errors:BaseUrl}/errors/{code}` (default base `https://example.com`). `errors` is
present only for `validation_failed` and `sample_invalid`; keys are dotted/indexed paths into the
request body. Every `429` carries `Retry-After`; `401` carries `WWW-Authenticate: Bearer`; `405`
carries `Allow`.

| Code | HTTP status | Title | When |
|---|---|---|---|
| `validation_failed` | 400 | One or more validation errors occurred. | Malformed JSON, an unknown property, a wrong value type, or a validation rule failed. |
| `sample_invalid` | 422 | The sample is invalid. | The sample root is a scalar or null, or cannot be used to infer a schema. |
| `sample_too_complex` | 422 | The sample is too complex. | The sample exceeds the configured size, node, or depth limits. |
| `response_too_large` | 422 | The generated response would be too large. | Generating the endpoint or preview would exceed the configured value limit. |
| `endpoint_limit_reached` | 422 | The endpoint limit was reached. | The project already contains the maximum number of endpoints. |
| `duplicate_endpoint` | 409 | The endpoint already exists. | Another endpoint in the project has the same method and normalized path. |
| `endpoint_not_found` | 404 | Endpoint not found. | The requested endpoint does not exist in this project. |
| `project_not_found` | 404 | Project not found. | The project slug does not exist or the project has been purged. |
| `project_expired` | 410 | Project expired. | The project is past its expiry time and no longer accepts requests. |
| `missing_token` | 401 | Authentication required. | The Authorization header is missing or is not a Bearer token. |
| `invalid_token` | 403 | Invalid token. | The Bearer token does not belong to this project. |
| `rate_limited` | 429 | Too many requests. | A management or runtime rate limit was exceeded. |
| `daily_quota_exceeded` | 429 | Daily quota exceeded. | The project reached its requests-per-UTC-day quota. |
| `invalid_pagination` | 400 | Invalid pagination. | The page or limit query parameter is out of range. |
| `method_not_allowed` | 405 | Method not allowed. | The route exists but does not support the requested HTTP method. |
| `payload_too_large` | 413 | Payload too large. | The request body exceeds the configured size limit. |
| `unsupported_media_type` | 415 | Unsupported media type. | A request with a body must use application/json. |
| `generation_failed` | 500 | Generation failed. | Unexpected failure while generating the mock response. |
| `injected_error` | 503 (default) | Injected error. | A simulated error injected by the project's error settings. The actual status is the injected status (`400..599`). |
| `internal_error` | 500 | Internal server error. | An unexpected error occurred on the server. |
| `not_found` | 404 | Not found. | No route matched the request. Only used for framework-level route misses, never instead of a domain code such as `project_not_found`. |

Runtime errors use the `{ "error": { ... } }` envelope from §9.3 (`status`, `code`, `title`,
`message`, `injected`, `requestId`). Injected errors use `injected_error`; system errors use the codes
above with `injected: false`. `Retry-After: 3` is added for injected `429`/`503`; every `429` has a
`Retry-After` value.

## Codes added beyond the 20 required codes

- `not_found` — required only so a framework 404 (no route) still has a machine-readable code. Domain
  endpoints must use `project_not_found` or `endpoint_not_found` instead.
