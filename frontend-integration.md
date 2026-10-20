# MockAPI - Frontend Integration Handoff

Last updated: 2026-10-20

## 0. Read this first: backend status

The backend contract below is frozen, but most HTTP routes are **not implemented yet**.

| Area | Status |
|---|---|
| `GET /health/live` | Implemented |
| `GET /health/ready` | Implemented (requires PostgreSQL) |
| `POST /api/v1/infer` | Planned (T07) |
| `GET /api/v1/meta` | Planned (T07) |
| `POST /api/v1/preview` | Planned (T07) |
| Projects and endpoints CRUD | Planned (T09) |
| Mock runtime `/m/{slug}/...` | Planned (T11) |
| Request logs and usage | Planned (T13) |
| CORS for `http://localhost:3000` | **Not configured yet** |
| Edit-token generation/verification | Implemented internally (T08), not exposed until T09 |

Recommended approach for the frontend dev:

1. Build the UI and API client against this contract now.
2. Use MSW/mock fixtures or the examples in this file until the routes land.
3. Do not enable real browser calls until CORS is configured and the endpoint status is `live`.
4. Treat request/response shapes as stable. If a shape must change, update this file first.

Base URL:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:5031
```

All management routes are under `/api/v1`. The public mock runtime is under `/m/{slug}`.

JSON rules:

- `Content-Type: application/json` for requests with a body.
- camelCase property names.
- Unknown request properties are rejected with `400 validation_failed`.
- Numeric enums are rejected; enums are strings when the contract uses them.
- Timestamps are ISO 8601 UTC, for example `2026-10-20T12:00:00Z`.

---

## 1. Authentication

Project-scoped management routes require the edit token returned once by `POST /api/v1/projects`.

```http
Authorization: Bearer et_<43 base64url characters>
```

Rules:

- Raw token looks like `et_` followed by 43 URL-safe characters, 46 characters total.
- Only a SHA-256 hash is stored by the backend. The raw token cannot be recovered.
- Keep the token in memory only. Do not put it in `localStorage`.
- A page reload loses edit access unless the user kept the token elsewhere.
- Public routes do not use the token: `/health/*`, `/api/v1/infer`, `/api/v1/meta`, `/api/v1/preview`, and all `/m/{slug}` runtime calls.

Auth error order on project routes:

| Situation | Status | Code |
|---|---|---|
| Slug does not exist | `404` | `project_not_found` |
| Token missing or malformed header | `401` | `missing_token` |
| Token does not match | `403` | `invalid_token` |
| Project expired but token is valid | `410` | `project_expired` |

A `401` includes `WWW-Authenticate: Bearer`.

---

## 2. Frontend flow

```text
paste sample
  -> POST /api/v1/infer
  -> show schema suggestions/warnings
  -> edit settings
  -> optional POST /api/v1/preview
  -> POST /api/v1/projects
  -> show slug/baseUrl and keep editToken in memory
  -> open/test baseUrl + endpoint path
  -> GET /api/v1/projects/{slug} for fresh data
  -> GET /api/v1/projects/{slug}/logs for request history
```

When creating an endpoint, send **exactly one** of `sample` or `schema`:

- Send `sample` when the sample is unchanged or the user wants the server to infer again.
- Send `schema` when the user has used the inferred schema and it has not become stale.
- Sending both, or neither, is `400 validation_failed`.

---

## 3. Endpoint contracts

### 3.1 Health

```http
GET /health/live
```

`200`:

```json
{
  "status": "Healthy",
  "checks": [{ "name": "self", "status": "Healthy" }]
}
```

```http
GET /health/ready
```

`200` when PostgreSQL is reachable, `503` otherwise. Same response shape.

These routes are public and have no auth.

### 3.2 Infer a schema

```http
POST /api/v1/infer
```

Public. No auth.

Request:

```json
{
  "sample": { "id": 1, "name": "Ahmed Benali", "email": "ahmed@example.com" },
  "options": { "wrapInList": true }
}
```

- `sample` is required and must be a JSON object or array.
- `options` is optional.
- `wrapInList` wraps a non-array root in an array.

Response `200`:

```json
{
  "schema": {
    "version": 1,
    "root": {
      "type": "object",
      "fields": [
        {
          "name": "id",
          "node": {
            "type": "integer",
            "generator": { "name": "autoId", "params": { "start": 1 } }
          }
        }
      ]
    }
  },
  "warnings": [
    {
      "code": "mixed_types",
      "path": "/items",
      "message": "Mixed item types fall back to a generic type."
    }
  ],
  "suggestions": {
    "list": { "path": null },
    "pagination": {
      "bindings": {
        "page": null,
        "limit": null,
        "total": null,
        "totalPages": null,
        "hasNext": null,
        "hasPrev": null
      }
    }
  }
}
```

Common errors:

| Status | Code | Meaning |
|---|---|---|
| `400` | `validation_failed` | Missing `sample`, wrong type, malformed JSON, or unknown property |
| `413` | `payload_too_large` | Body over 256 KB |
| `415` | `unsupported_media_type` | Body is not `application/json` |
| `422` | `sample_invalid` | Sample root is a scalar or `null` |
| `422` | `sample_too_complex` | Sample exceeds 100 KB, depth, field, or node limits |
| `429` | `rate_limited` | Optional rate limit (not active yet) |

### 3.3 Meta / limits bootstrap

```http
GET /api/v1/meta
```

Public. Optional bootstrap call. If it fails, fall back to the constants in `frontend-spec.md`.

Target response `200`:

```json
{
  "mockBaseUrl": "http://localhost:5031/m",
  "projectLifetimeDays": 7,
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "successStatuses": [200, 201, 202, 204],
  "errorStatusRange": { "min": 400, "max": 599 },
  "limits": {
    "maxEndpointsPerProject": 10,
    "maxSampleBytes": 102400,
    "maxRequestBodyBytes": 262144,
    "maxPathLength": 200,
    "maxDelayMs": 10000,
    "maxListSize": 1000,
    "maxPaginationTotalItems": 10000,
    "maxPaginationLimit": 100,
    "maxErrorStatusCodes": 10,
    "dailyRequestsPerProject": 5000,
    "maxLogEntriesPerProject": 1000
  },
  "generators": [
    {
      "name": "randomInt",
      "nodeTypes": ["integer"],
      "params": [
        { "name": "min", "type": "integer", "required": true },
        { "name": "max", "type": "integer", "required": true }
      ]
    }
  ]
}
```

Cache friendly: `Cache-Control: public, max-age=300`.

### 3.4 Preview generated data

```http
POST /api/v1/preview
```

Public. Does not create a project, write logs, or consume quota. Delay and injected errors are not applied in preview.

Request:

```json
{
  "schema": { "version": 1, "root": { "type": "object", "fields": [] } },
  "settings": {
    "list": { "size": { "min": 3, "max": 3 } }
  },
  "page": 1,
  "limit": 10
}
```

- `schema` is required.
- `settings` is optional; server defaults are applied.
- `page` and `limit` are optional and only used when pagination is enabled.
- Without pagination, `page`/`limit` are ignored.

Response `200`, non-paginated:

```json
{
  "data": [{ "id": 1, "name": "Jane Doe" }],
  "pagination": null
}
```

Response `200`, paginated:

```json
{
  "data": [{ "id": 11, "name": "Jane Doe" }],
  "pagination": {
    "page": 2,
    "limit": 10,
    "totalItems": 24,
    "totalPages": 3
  }
}
```

Paginated previews also send:

```http
X-Total-Count: 24
X-Page: 2
X-Limit: 10
X-Total-Pages: 3
Link: <http://localhost:5031/api/v1/preview?page=1&limit=10>; rel="first", <...>; rel="next", <...>; rel="last"
```

Errors: `400 validation_failed`, `422 response_too_large`, `413`, `415`.

> Seeded byte-for-byte determinism is not implemented yet. Do not build tests that depend on identical generated values across requests.

### 3.5 Create a project

```http
POST /api/v1/projects
```

Public (creates a new project and returns its token).

Request:

```json
{
  "name": "Users demo",
  "endpoints": [
    {
      "method": "GET",
      "path": "/users",
      "sample": {
        "id": 1,
        "name": "Ahmed Benali",
        "email": "ahmed@example.com"
      },
      "options": { "wrapInList": true },
      "settings": {
        "successStatus": 200,
        "delay": { "minMs": 300, "maxMs": 1500 },
        "errors": { "ratePercent": 15, "statusCodes": [500, 503, 429] },
        "list": { "size": { "min": 10, "max": 10 } }
      }
    }
  ]
}
```

Rules:

- `name` optional, 1-60 characters.
- `endpoints` required, 1 to 10 items.
- Each endpoint sends exactly one of `sample` or `schema`.
- `options` is only meaningful with `sample`.
- Duplicate `(method, normalizedPath)` in the request is `409 duplicate_endpoint`.
- Path is sent with a leading `/`; no spaces, `?`, or `#`; max 200 characters.

Response `201`:

```json
{
  "slug": "k3j9x2m8qa",
  "editToken": "et_Qm3v...43chars...",
  "name": "Users demo",
  "createdAt": "2026-10-20T12:00:00Z",
  "expiresAt": "2026-10-27T12:00:00Z",
  "baseUrl": "http://localhost:5031/m/k3j9x2m8qa",
  "endpoints": [
    {
      "id": "7d1b5c3e-2a74-4a9d-8d5f-0c1a9b6e5f10",
      "method": "GET",
      "path": "/users",
      "url": "http://localhost:5031/m/k3j9x2m8qa/users",
      "schema": { "version": 1, "root": { "type": "array", "item": {} } },
      "settings": {},
      "createdAt": "2026-10-20T12:00:00Z",
      "updatedAt": "2026-10-20T12:00:00Z"
    }
  ]
}
```

`editToken` is returned only here. Store it in memory with the current project.

Headers: `Location: /api/v1/projects/{slug}`.

Errors: `400`, `409 duplicate_endpoint`, `413`, `415`, `422 sample_invalid`, `422 sample_too_complex`, `422 response_too_large`, `422 endpoint_limit_reached`, `429 rate_limited`.

### 3.6 Get a project

```http
GET /api/v1/projects/{slug}
Authorization: Bearer <editToken>
```

Response `200`:

```json
{
  "slug": "k3j9x2m8qa",
  "name": "Users demo",
  "createdAt": "2026-10-20T12:00:00Z",
  "expiresAt": "2026-10-27T12:00:00Z",
  "baseUrl": "http://localhost:5031/m/k3j9x2m8qa",
  "usage": { "requestsToday": 120, "dailyLimit": 5000 },
  "endpoints": [
    {
      "id": "7d1b5c3e-2a74-4a9d-8d5f-0c1a9b6e5f10",
      "method": "GET",
      "path": "/users",
      "url": "http://localhost:5031/m/k3j9x2m8qa/users",
      "schema": { "version": 1, "root": {} },
      "settings": {},
      "createdAt": "2026-10-20T12:00:00Z",
      "updatedAt": "2026-10-20T12:00:00Z"
    }
  ]
}
```

Errors: `401 missing_token`, `403 invalid_token`, `404 project_not_found`, `410 project_expired`.

### 3.7 Rename a project

```http
PATCH /api/v1/projects/{slug}
Authorization: Bearer <editToken>
Content-Type: application/json

{ "name": "New name" }
```

- `name: null` clears the name.
- Response `200`: the same project object as `GET /projects/{slug}`.

### 3.8 Delete a project

```http
DELETE /api/v1/projects/{slug}
Authorization: Bearer <editToken>
```

- Response `204`, no body.
- A second call returns `404 project_not_found`.

### 3.9 Create an endpoint

```http
POST /api/v1/projects/{slug}/endpoints
Authorization: Bearer <editToken>
```

Request: one endpoint item, same shape as in project creation.

Response `201` with one Endpoint object. Header:

```http
Location: /api/v1/projects/{slug}/endpoints/{id}
```

Errors: `400`, `409 duplicate_endpoint`, `422 endpoint_limit_reached`, `422` inference/size errors.

### 3.10 Get an endpoint

```http
GET /api/v1/projects/{slug}/endpoints/{id}
Authorization: Bearer <editToken>
```

Response `200`: Endpoint object.

Errors: `404 endpoint_not_found` plus auth errors.

### 3.11 Replace an endpoint

```http
PUT /api/v1/projects/{slug}/endpoints/{id}
Authorization: Bearer <editToken>
```

Request:

```json
{
  "method": "GET",
  "path": "/users",
  "schema": { "version": 1, "root": {} },
  "settings": {}
}
```

`schema` and `settings` are required on full replace. Response `200`: Endpoint object.

Errors: `400`, `404 endpoint_not_found`, `409 duplicate_endpoint`, `422 response_too_large`.

### 3.12 Replace only the schema

```http
PUT /api/v1/projects/{slug}/endpoints/{id}/schema
Authorization: Bearer <editToken>
```

Request body is the bare `Schema` object.

The server re-validates the existing settings against the new schema. If a list path, binding pointer, or size estimate no longer works, it returns `422 validation_failed` with the offending settings path and saves nothing.

Response `200`: Endpoint object.

### 3.13 Replace only the settings

```http
PUT /api/v1/projects/{slug}/endpoints/{id}/settings
Authorization: Bearer <editToken>
```

Request body is the bare `EndpointSettings` object.

Response `200`: Endpoint object. Errors: `400`, `422`.

### 3.14 Delete an endpoint

```http
DELETE /api/v1/projects/{slug}/endpoints/{id}
Authorization: Bearer <editToken>
```

Response `204`. A project may have zero endpoints.

### 3.15 Logs

```http
GET /api/v1/projects/{slug}/logs?limit=50&before=1300
Authorization: Bearer <editToken>
```

Query parameters:

| Param | Type | Default | Meaning |
|---|---|---|---|
| `limit` | int `1..100` | `50` | Page size |
| `before` | long | none | Entries with `id < before` |
| `after` | long | none | Entries with `id > after`; cannot combine with `before` |
| `endpointId` | guid | none | Filter by endpoint |
| `status` | int | none | Filter by exact status |
| `injected` | bool | none | Filter injected errors |

Response `200`, newest first:

```json
{
  "items": [
    {
      "id": 1300,
      "requestId": "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11",
      "endpointId": "7d1b5c3e-2a74-4a9d-8d5f-0c1a9b6e5f10",
      "method": "GET",
      "path": "/users",
      "query": "page=2&limit=10",
      "status": 503,
      "injectedError": true,
      "delayMs": 842,
      "latencyMs": 846,
      "requestContentType": null,
      "requestBody": null,
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-10-20T12:03:11Z"
    }
  ],
  "nextCursor": 1251,
  "latestId": 1300
}
```

- `nextCursor`: pass as `before` to load older entries; `null` when exhausted.
- `latestId`: pass as `after` when polling; poll every 2 seconds only while the tab is visible.

```http
DELETE /api/v1/projects/{slug}/logs
Authorization: Bearer <editToken>
```

Response `204`.

---

## 4. Mock runtime

Public URL shown to the user:

```text
{baseUrl}{endpoint.path}
```

Example:

```text
http://localhost:5031/m/k3j9x2m8qa/users?page=1&limit=10
```

No auth. Methods: `GET, POST, PUT, DELETE, OPTIONS`. Other methods return `405`.

The runtime matches paths case-insensitively, ignores a trailing slash, and treats `{name}` segments as single-segment templates. Static segments win over templates.

### 4.1 Success responses

- Body is generated JSON shaped by the endpoint schema.
- Status is the configured `successStatus` (`200`, `201`, `202`, or `204`).
- `204` has no body and no `Content-Type`.

Every mock response includes:

| Header | Meaning |
|---|---|
| `Content-Type` | `application/json; charset=utf-8`, except `204` |
| `Cache-Control` | `no-store` |
| `X-Request-Id` | Request GUID, also stored in logs |
| `X-Mock-Delay-Ms` | Actual applied delay, `0` if not reached |
| `X-Mock-Injected-Error` | `"true"` only for simulated errors |
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Expose-Headers` | `X-Request-Id, X-Mock-Delay-Ms, X-Mock-Injected-Error, X-Total-Count, X-Page, X-Limit, X-Total-Pages, Link, Retry-After, Allow` |

### 4.2 Runtime errors

Injected and system errors use:

```json
{
  "error": {
    "status": 503,
    "code": "injected_error",
    "title": "Service Unavailable",
    "message": "Simulated error injected by MockAPI.",
    "injected": true,
    "requestId": "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11"
  }
}
```

Use `injected` and `X-Mock-Injected-Error` in the test panel to distinguish simulated failures from real failures.

Injected `429` and `503` also include `Retry-After: 3`.

### 4.3 Pagination

When pagination is enabled:

- `page` defaults to `1`; `limit` defaults to the endpoint's `defaultLimit`.
- `limit` above `maxLimit` is clamped, not rejected.
- `page`/`limit` that are non-integers or below `1` return `400 invalid_pagination`.
- Response headers: `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`, `Link`.
- `Link` relations: `first`, `prev` when applicable, `next` when applicable, `last`.
- Body values configured in `settings.pagination.bindings` are replaced with real page values.

### 4.4 CORS preflight

```http
OPTIONS /m/{slug}/{path}
```

Returns `204` with no delay, no error injection, no logging, and no quota usage.

```http
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Max-Age: 86400
Access-Control-Allow-Origin: *
```

Credentials are never allowed, because `*` is used.

---

## 5. Settings contract

All properties are optional. The server returns the full object with defaults applied.

```ts
type EndpointSettings = {
  successStatus?: 200 | 201 | 202 | 204;
  delay?: { minMs: number; maxMs: number };
  errors?: { ratePercent: number; statusCodes: number[] };
  list?: {
    path?: string | null;
    size?: { min: number; max: number };
  };
  pagination?: {
    enabled?: boolean;
    totalItems?: number;
    defaultLimit?: number;
    maxLimit?: number;
    bindings?: {
      page?: string | null;
      limit?: string | null;
      total?: string | null;
      totalPages?: string | null;
      hasNext?: string | null;
      hasPrev?: string | null;
    };
  };
  seed?: number | null;
};
```

Defaults by method:

| Field | GET | POST | PUT | DELETE |
|---|---|---|---|---|
| `successStatus` | 200 | 201 | 200 | 204 |
| `delay` | `0..0` | `0..0` | `0..0` | `0..0` |
| `errors` | `0%`, `[500]` | same | same | same |
| `list.size` | `10..10` | same | same | same |
| `pagination.enabled` | `false` | same | same | same |
| `pagination.totalItems` | `100` | same | same | same |
| `pagination.defaultLimit` | `10` | same | same | same |
| `pagination.maxLimit` | `100` | same | same | same |
| `seed` | `null` | same | same | same |

Validation limits:

| Setting | Rule |
|---|---|
| `successStatus` | one of `200, 201, 202, 204` |
| `delay.minMs`, `delay.maxMs` | `0..10000`, `maxMs >= minMs` |
| `errors.ratePercent` | `0..100`, at most one decimal |
| `errors.statusCodes` | 1-10 unique codes, each `400..599`; required when rate > 0 |
| `list.size.min`, `list.size.max` | `0..1000`, `max >= min` |
| `pagination.totalItems` | `0..10000` |
| `pagination.maxLimit` | `1..100`, also bounded by server config |
| `pagination.defaultLimit` | `1..maxLimit` |
| `pagination.enabled` | requires a list (root array or `list.path`) |
| `list.path` | RFC 6901 pointer to an array, or `null` for root array |
| binding pointers | must resolve to the correct leaf type |

`seed` is reserved. It is accepted but deterministic seeded generation is not implemented yet; do not rely on it.

---

## 6. Error contract

### 6.1 Management API error

All `/api/v1` errors use `application/problem+json`:

```json
{
  "type": "https://example.com/errors/validation-failed",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "code": "validation_failed",
  "detail": "See 'errors' for details.",
  "traceId": "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11",
  "errors": {
    "sample": ["The sample field is required."],
    "settings.delay.maxMs": ["Must be greater than or equal to minMs."]
  }
}
```

- Switch on `code`, not on `title` or `detail`.
- `errors` is present for validation failures and is a map of field paths to messages.
- `traceId` is safe to show in a support message.

Common codes:

| Status | Code |
|---|---|
| `400` | `validation_failed` |
| `400` | `invalid_pagination` |
| `401` | `missing_token` |
| `403` | `invalid_token` |
| `404` | `project_not_found` |
| `404` | `endpoint_not_found` |
| `405` | `method_not_allowed` |
| `409` | `duplicate_endpoint` |
| `410` | `project_expired` |
| `413` | `payload_too_large` |
| `415` | `unsupported_media_type` |
| `422` | `sample_invalid` |
| `422` | `sample_too_complex` |
| `422` | `response_too_large` |
| `422` | `endpoint_limit_reached` |
| `429` | `rate_limited` |
| `429` | `daily_quota_exceeded` |
| `500` | `internal_error` |

### 6.2 Runtime error

```json
{
  "error": {
    "status": 500,
    "code": "generation_failed",
    "title": "Generation failed.",
    "message": "Unexpected failure while generating the mock response.",
    "injected": false,
    "requestId": "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11"
  }
}
```

---

## 7. TypeScript contract

```ts
export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type Schema = { version: 1; root: SchemaNode };
export type SchemaNode = ObjectNode | ArrayNode | LeafNode;

export type ObjectNode = {
  type: "object";
  fields: Array<{
    name: string;
    node: SchemaNode;
    nullProbability?: number;
    omitProbability?: number;
  }>;
};

export type ArrayNode = {
  type: "array";
  item: SchemaNode;
  length?: { min: number; max: number };
};

export type LeafNode = {
  type: "string" | "integer" | "number" | "boolean" | "null";
  generator: { name: string; params?: Record<string, unknown> };
};

export type EndpointSettings = {
  successStatus?: 200 | 201 | 202 | 204;
  delay?: { minMs: number; maxMs: number };
  errors?: { ratePercent: number; statusCodes: number[] };
  list?: { path?: string | null; size?: { min: number; max: number } };
  pagination?: {
    enabled?: boolean;
    totalItems?: number;
    defaultLimit?: number;
    maxLimit?: number;
    bindings?: {
      page?: string | null;
      limit?: string | null;
      total?: string | null;
      totalPages?: string | null;
      hasNext?: string | null;
      hasPrev?: string | null;
    };
  };
  seed?: number | null;
};

export type EndpointInput = {
  method: Method;
  path: string;
  sample?: unknown;
  schema?: Schema;
  options?: { wrapInList?: boolean };
  settings?: EndpointSettings;
};

export type ProjectInput = {
  name?: string;
  endpoints: EndpointInput[];
};

export type Endpoint = {
  id: string;
  method: Method;
  path: string;
  url: string;
  schema: Schema;
  settings: EndpointSettings;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  slug: string;
  editToken?: string;
  name: string | null;
  createdAt: string;
  expiresAt: string;
  baseUrl: string;
  usage?: { requestsToday: number; dailyLimit: number };
  endpoints: Endpoint[];
};

export type InferResponse = {
  schema: Schema;
  warnings: Array<{ code: string; path: string; message: string }>;
  suggestions: {
    list?: { path: string | null };
    pagination?: { bindings: Record<string, string | null> };
  };
};

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
  errors?: Record<string, string[]>;
};
```

---

## 8. API client skeleton

```ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5031";

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: import("./types").ApiProblem,
  ) {
    super(problem.detail || problem.title);
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  editToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (editToken) {
    headers.set("Authorization", `Bearer ${editToken}`);
  }

  const response = await fetch(`${BASE}${path}`, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
```

Rules for the test panel:

- Call the runtime URL with plain `fetch`; do not throw on `4xx`/`5xx`.
- Read `X-Request-Id`, `X-Mock-Delay-Ms`, and `X-Mock-Injected-Error`.
- If the response is not JSON, render the raw text and status.
- For `POST`/`PUT` tests, send `{}`; for `DELETE`, send no body.

---

## 9. Integration checklist

- [ ] API client points at `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Infer request handles `validation_failed`, `sample_invalid`, and `sample_too_complex`.
- [ ] Sample edits invalidate the inferred schema.
- [ ] Create request sends exactly one of `sample` or `schema` per endpoint.
- [ ] Edit token is kept in memory only and attached as Bearer to project routes.
- [ ] Settings defaults match this document.
- [ ] Test panel displays runtime headers and the `injected` flag.
- [ ] Pagination uses `page`/`limit` and reads `X-Total-*` and `Link`.
- [ ] Logs viewer supports `before`/`after` cursors and polling only while visible.
- [ ] Feature-flag preview until `/api/v1/preview` is live.
- [ ] Wait for backend CORS before enabling direct browser calls.

---

## 10. Known gaps

- Management routes, preview, and runtime are not implemented yet.
- CORS is not enabled.
- Rate limiting and daily quotas are not active.
- Request logs and usage endpoints are not implemented.
- Seeded output is not deterministic yet.
- `GET /api/v1/meta` is optional; the UI must not block on it.
