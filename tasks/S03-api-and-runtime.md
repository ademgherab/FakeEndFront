# S03 — Management API and mock runtime (25 min)

- **Depends on:** S01, S02
- **File:** `src/MockApi/Program.cs`

## Management

- [ ] `POST /api/v1/projects`: 1+ endpoints, each with `sample` xor `schema`; infer if sample; normalize path; reject duplicates `409`; return `201` + `Location` + `{slug, editToken, name, createdAt, expiresAt, baseUrl, endpoints}` (token is a placeholder; auth not enforced).
- [ ] `GET /api/v1/projects/{slug}`: project + endpoints.
- [ ] `POST /api/v1/infer`: `{sample, options}` → `{schema, warnings:[], suggestions:{...}}`.
- [ ] `POST /api/v1/preview`: `{schema, settings}` → `{data, pagination:null}`.
- [ ] `GET /api/v1/meta`: limits and methods, from constants.
- [ ] Unknown properties may be ignored in this sprint.
- [ ] JSON camelCase; validation errors as `{type,title,status,code,detail,traceId}`.

## Runtime

- [ ] `/m/{slug}` and `/m/{slug}/{**path}`; methods GET/POST/PUT/DELETE/OPTIONS.
- [ ] CORS `*`, expose `X-Request-Id, X-Mock-Delay-Ms, X-Mock-Injected-Error`.
- [ ] Steps: project (404) → delay → error roll → generate.
- [ ] Match method + path, case-insensitive, ignore trailing slash; `{template}` matches one segment; static beats template.
- [ ] Path exists with another method → `405` + `Allow`.
- [ ] Headers: `Cache-Control: no-store`, `X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`, `X-Content-Type-Options: nosniff`.
- [ ] Error envelope `{error:{status,code,title,message,injected,requestId}}`; `Retry-After: 3` for injected 429/503.
- [ ] `204` success has no body.
- [ ] `OPTIONS` preflight → 204, no delay/errors.

## Done

Curl create + mock call works with delay, errors, headers, and CORS.
