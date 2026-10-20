# MockAPI — Frontend Specification (90-Minute Sprint)

Frontend: **Next.js (App Router) + TypeScript + Tailwind**.
Backend: ASP.NET Core at `http://localhost:5031` (see `src/MockApi.Api/Properties/launchSettings.json`).
Source of truth for the product: `mockapi-technical-spec.md`. This document is the **short sprint contract**; where it is silent, the main spec applies.

> Goal: one page. Paste JSON, infer a schema, configure delay/errors, create a mock, copy the URL, call it, and inspect the response.

---

## 1. Scope

### In scope

- Single-page builder (`/`) with sample input, settings, preview, result.
- `POST /api/v1/infer` and display the inferred schema.
- Optional `POST /api/v1/preview` to show sample data before creating.
- `POST /api/v1/projects` with **one endpoint**.
- Display `baseUrl` and full endpoint URL, copy buttons.
- Test panel: call the mock URL, show status, body, latency, and headers.
- Inline validation and backend error rendering.
- Loading, empty, error, and success states.

### Out of scope

- Accounts, edit tokens, auth, saved projects.
- Logs viewer, usage dashboard, pagination UI.
- Schema field editor (show JSON, do not edit it).
- Multiple endpoints in the UI (backend supports it; UI stays at one).
- Seed, rate limits, OpenAPI generation, tests beyond a manual smoke pass.
- Dark mode, i18n, SSR data fetching.

---

## 2. Information architecture

One route, three stacked areas on mobile / two columns on desktop:

```
+-------------------------------------------------------------+
| Header: MockAPI                         API: localhost:5031 |
+----------------------------+--------------------------------+
| 1. JSON sample             | 3. Result                      |
|    textarea                |    baseUrl + copy              |
|    [ ] Return as list      |    endpoint URL + copy         |
|    [Infer schema]          |    [Test endpoint]             |
|                            |    status / headers / body     |
| 2. Endpoint settings       |                                |
|    method, path            | 4. Schema preview (JSON)       |
|    delay min/max           |                                |
|    error rate + codes      |                                |
|    list size min/max       |                                |
|    [Create mock]           |                                |
+----------------------------+--------------------------------+
```

The **Create mock** button stays disabled until the sample parses, inference has succeeded, and settings are valid.

---

## 3. API contract

Base URL comes from `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5031`).
Call the backend **directly from the browser**. Do not add a Next.js API route or BFF.
The backend must allow the frontend origin (default `http://localhost:3000`) via CORS.

### 3.1 `POST /api/v1/infer`

Request:

```json
{
  "sample": { "id": 1, "name": "Ahmed Benali", "email": "ahmed@example.com" },
  "options": { "wrapInList": true }
}
```

Response `200`:

```json
{
  "schema": { "version": 1, "root": { "type": "object", "fields": [] } },
  "warnings": [],
  "suggestions": {
    "list": { "path": null },
    "pagination": { "bindings": {} }
  }
}
```

Errors: `400 validation_failed`, `422 sample_invalid`, `422 sample_too_complex`, `413`.

UI rules:
- Debounce inference 500 ms after typing, or run only on button click for the sprint. Button click is safer.
- Never send empty input.
- On success, store `schema` and enable creation.
- On error, show `detail` and, when present, the per-field `errors` map.

### 3.2 `POST /api/v1/preview` (optional, if time permits)

Request:

```json
{
  "schema": { "version": 1, "root": { "type": "object", "fields": [] } },
  "settings": { "list": { "size": { "min": 3, "max": 3 } } }
}
```

Response `200`:

```json
{
  "data": [ { "id": 1, "name": "Jane Doe" } ],
  "pagination": null
}
```

Preview must not create anything. Render `data` as formatted JSON in a collapsible panel.

### 3.3 `POST /api/v1/projects`

Request:

```json
{
  "name": "Users demo",
  "endpoints": [
    {
      "method": "GET",
      "path": "/users",
      "sample": { "id": 1, "name": "Ahmed Benali" },
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

Send **either** `sample` **or** `schema` per endpoint, never both. The sprint UI sends:
- `sample` (what the user pasted), and
- `schema` returned by `/infer` only if the user has not changed the sample since inference.

Response `201`:

```json
{
  "slug": "k3j9x2m8qa",
  "editToken": "et_...",
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
      "schema": { "version": 1, "root": {} },
      "settings": {},
      "createdAt": "2026-10-20T12:00:00Z",
      "updatedAt": "2026-10-20T12:00:00Z"
    }
  ]
}
```

The sprint backend does not enforce the token. Do not display `editToken` as a secret; show only the URL and, if present, a small "token returned" note. Never store it in `localStorage`.

Errors: `400 validation_failed`, `409 duplicate_endpoint`, `422 response_too_large`, `429 rate_limited`.

### 3.4 `GET /api/v1/meta` (optional bootstrap)

Use it for limits/status lists. If unavailable, fall back to the constants in section 5. Do not block the page on it.

### 3.5 Mock runtime

The created `baseUrl` is a normal HTTP URL:

```
GET {baseUrl}{path}?page=1&limit=10
```

Every response includes:

| Header | Meaning |
|---|---|
| `X-Request-Id` | Request identifier |
| `X-Mock-Delay-Ms` | Applied delay |
| `X-Mock-Injected-Error` | `"true"` when the error was simulated |
| `Access-Control-Allow-Origin` | `*` |

Injected/system errors use:

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

The test panel must render this envelope and a "simulated" badge when `injected` is true.

---

## 4. TypeScript types

Create `lib/types.ts` and keep it aligned with the backend. Treat `schema` as opaque for rendering; do not reimplement generator validation.

```ts
export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type Schema = { version: 1; root: SchemaNode };
export type SchemaNode = ObjectNode | ArrayNode | LeafNode;

export type ObjectNode = {
  type: "object";
  fields: Array<{ name: string; node: SchemaNode; nullProbability?: number; omitProbability?: number }>;
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
  successStatus?: number;
  delay?: { minMs: number; maxMs: number };
  errors?: { ratePercent: number; statusCodes: number[] };
  list?: { size: { min: number; max: number } };
};

export type InferResponse = {
  schema: Schema;
  warnings: Array<{ code: string; path: string; message: string }>;
  suggestions: {
    list?: { path: string | null };
    pagination?: { bindings: Record<string, string | null> };
  };
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
  endpoints: Endpoint[];
};

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
};

export type RuntimeErrorBody = {
  error: {
    status: number;
    code: string;
    title: string;
    message: string;
    injected: boolean;
    requestId: string;
  };
};
```

API client (`lib/api.ts`):

```ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5031";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error("API error"), { problem: body, status: res.status });
  return body as T;
}
```

Use `request` for management calls. For the mock test call, use `fetch` directly and read headers; do not throw on 4xx/5xx, render the body.

---

## 5. Settings form

Defaults (match the backend):

| Field | Control | Default | Validation |
|---|---|---|---|
| method | select | `GET` | `GET, POST, PUT, DELETE` |
| path | text | `/users` | starts with `/`, no `?` or `#`, max 200 |
| successStatus | select | GET 200, POST 201, PUT 200, DELETE 204 | `200, 201, 202, 204` |
| delay.minMs | number | 0 | `0..10000` |
| delay.maxMs | number | 0 | `0..10000`, `>= minMs` |
| errors.ratePercent | number | 0 | `0..100`, one decimal |
| errors.statusCodes | multi-select / chips | `[500]` | 1–10 unique, `400..599`; required when rate > 0 |
| list.size.min | number | 10 | `0..1000` |
| list.size.max | number | 10 | `0..1000`, `>= min` |
| wrapInList | switch | false | only applies when the sample root is not an array |

Presets that save demo time:
- **Fast + reliable:** delay 0–0, errors 0.
- **Realistic:** delay 300–1500, errors 10% with `[500, 503]`.
- **Flaky demo:** errors 100% with `[503]`.

Path is sent with a leading `/`. Trim whitespace. Do not allow spaces.

---

## 6. UI behavior and state

State machine:

```
idle -> inferring -> inferred -> creating -> created
             |            |          |
             +-> error <--+----------+
```

Rules:
- Sample change after `inferred` invalidates the schema and moves back to `idle`; keep the previous preview visible but mark it stale.
- Infer button is disabled while the textarea is empty or inference is running.
- Create button is disabled unless `inferred` and the settings form is valid.
- On create success, show the result panel and scroll to it; do not auto-open a new tab.
- Test endpoint button calls the URL with the selected method. For `POST/PUT`, send an empty JSON object `{}`; for `DELETE`, send no body.
- Show `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`, and `X-Request-Id` as key/value chips.
- If the response is not JSON, show the raw text and status.
- Re-running the mock must not create a new project.
- Show a privacy note above the textarea: *"Do not paste real or sensitive data."*
- No `localStorage` persistence of samples, schemas, or tokens.

Error display:
- Inline field errors for local validation.
- Banner for API errors with `code` and `detail`.
- `errors` map rendered under the relevant field when the key matches; otherwise list it in the banner.
- Network failure: "Cannot reach API at {BASE}. Is the backend running?"

Accessibility:
- Every input has a label.
- Error text is associated with `aria-describedby`.
- Buttons expose `aria-busy` while loading.
- Copy buttons announce "Copied" for 2 seconds.

---

## 7. File layout

```
app/
  layout.tsx
  page.tsx                 # the only page
  globals.css
components/
  JsonSampleInput.tsx
  SettingsForm.tsx
  SchemaPreview.tsx
  ResultPanel.tsx
  TestPanel.tsx
  CopyButton.tsx
  ErrorBanner.tsx
lib/
  api.ts
  types.ts
  defaults.ts
```

Keep state in `page.tsx` (or a single `useMockBuilder` hook). No state manager library in the sprint.

---

## 8. 90-minute plan

| Min | Work |
|---|---|
| 0–10 | Scaffold Next.js, env var, types, API client |
| 10–25 | Sample textarea, parse validation, infer call |
| 25–45 | Settings form with defaults and validation |
| 45–65 | Create project, result panel, copy URL |
| 65–80 | Test panel, headers, injected-error badge |
| 80–90 | Empty/loading/error polish, manual smoke, build |

If behind schedule, cut the optional preview panel and schema collapsible first. Never cut create, copy, or test.

---

## 9. Acceptance criteria

- [ ] Paste the demo sample, infer, create, and see a mock URL.
- [ ] Copy the URL; `GET` it in a browser or curl and receive generated JSON.
- [ ] Calling the URL twice returns different data (unless a seed is set).
- [ ] `X-Mock-Delay-Ms` matches the configured range.
- [ ] With error rate 100%, the test panel shows the injected status and `injected: true`.
- [ ] Invalid JSON disables inference and shows a readable message.
- [ ] Invalid settings disable creation and flag the field.
- [ ] Backend `4xx` errors render `code` and `detail`, not "Something went wrong".
- [ ] Mobile layout is usable; no horizontal scroll.
- [ ] `npm run build` passes; no console errors in the demo flow.

---

## 10. Demo script

1. Paste the sample from `examples/users.json` (create it during the sprint).
2. Click **Infer schema**; show the inferred fields.
3. Set delay 300–1500 and errors 10% / `[500, 503]`.
4. Click **Create mock**; copy the URL.
5. Click **Test endpoint** twice; show different data and the delay chip.
6. Set errors to 100%; test again; show the injected 503 badge.
7. Point out the privacy note and the one-page flow.

---

## 11. Backend assumptions to confirm

- CORS for the frontend origin (`http://localhost:3000`) is enabled on `/api/v1/*`.
- CORS on `/m/*` allows any origin and exposes `X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`.
- `POST /api/v1/projects` accepts `sample` **or** `schema`; the sprint UI sends `sample` plus `options` and `settings`.
- Error bodies follow `ApiProblem`; runtime errors follow `RuntimeErrorBody`.
- No auth header is required in the sprint. If the backend enforces tokens, add `Authorization: Bearer <editToken>` to project-scoped calls only, and store the token in memory (never `localStorage`).

If any assumption is false, stop and align the contract before building the UI. Do not guess.
