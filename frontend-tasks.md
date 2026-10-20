# MockAPI — Frontend Sprint Plan (90 minutes)

> **Source of truth:** [`frontend-spec.md`](./frontend-spec.md).
> This plan replaces the previous multi-page task breakdown. The old plan is preserved in
> [`tasks/archive/legacy-plan/`](./tasks/archive/legacy-plan/) and **must not be executed**.
>
> Stack: **Next.js (App Router) + TypeScript + Tailwind**. The browser calls the backend
> directly. No Next.js API route and no BFF.

---

## 0. Goal

**One page.** Paste JSON, infer a schema, configure delay/errors/list size, create a mock,
copy the URL, call it, and inspect the response.

The sprint is deliberately smaller than the old plan. Optimise for a reliable live demo,
not for completeness.

---

## 1. Scope

### In scope

| Area | What the UI must do |
|---|---|
| Sample | Textarea, local JSON parsing, optional "Return as list" switch |
| Inference | `POST /api/v1/infer`, show schema and warnings, enable creation |
| Settings | Method, path, success status, delay, error rate/codes, list size |
| Create | `POST /api/v1/projects` with exactly one endpoint |
| Result | Show `baseUrl` and full endpoint URL, copy buttons, token-returned note |
| Test | Call the mock URL, show status, latency, headers and body |
| States | Empty, loading, invalid, error, success |
| Preview | Optional `POST /api/v1/preview`; cut first if time is short |

### Out of scope

- Accounts, edit tokens as auth, saved projects, recent projects.
- Logs viewer, usage dashboard, pagination UI.
- Schema field editor (show JSON; do not edit it).
- Multiple endpoints in the UI.
- Seed, rate limits, OpenAPI generation, MSW, unit/E2E suites beyond a manual smoke pass.
- Dark-mode toggle, i18n, SSR data fetching.
- TanStack Query, Zustand, React Hook Form, Zod, CodeMirror, or any second design system.

If a task needs something from this list, stop and raise it before adding it.

---

## 2. Non-negotiable contract

### 2.1 Base URL and CORS

```ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5031";
```

- Call the backend **directly from the browser**.
- The backend must allow the frontend origin (default `http://localhost:3000`) via CORS.
- `/m/*` must allow any origin and expose `X-Request-Id`, `X-Mock-Delay-Ms`,
  `X-Mock-Injected-Error`.
- No `Authorization` header is required in the sprint.

### 2.2 Management endpoints

| Endpoint | Purpose | Errors |
|---|---|---|
| `POST /api/v1/infer` | Infer schema from sample | `400 validation_failed`, `422 sample_invalid`, `422 sample_too_complex`, `413` |
| `POST /api/v1/preview` | Optional preview data | Same style as infer |
| `POST /api/v1/projects` | Create one-endpoint project | `400 validation_failed`, `409 duplicate_endpoint`, `422 response_too_large`, `429 rate_limited` |
| `GET /api/v1/meta` | Optional limits/statuses | Do not block the page on it |

Request/response shapes are defined in `frontend-spec.md` §3 and must be mirrored in
`lib/types.ts`. Treat `schema` as opaque for rendering.

### 2.3 Create payload rule

Send **either** `sample` **or** `schema` per endpoint, never both.

The sprint UI has the parsed sample, so the default is to send `sample` + `options`.
Only send `schema` instead if the backend requires it and the sample has not changed since
inference. If the backend rejects one form, align before building; do not guess.

### 2.4 Runtime headers and error envelope

Every mock response includes:

- `X-Request-Id`
- `X-Mock-Delay-Ms`
- `X-Mock-Injected-Error` (`"true"` when simulated)
- `Access-Control-Allow-Origin`

Runtime errors use:

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

The test panel must render this envelope and a **simulated** badge when `injected` is true.

---

## 3. Architecture

### 3.1 One route, one state owner

```
/  → single-page builder
```

- No `/new`, `/projects`, `/p/[slug]`, `/help`, `/expired`, logs, auth or schema editor.
- Keep all builder state in `page.tsx` or one `useMockBuilder` hook.
- No state manager library. No `localStorage`/`sessionStorage` persistence of samples,
  schemas or tokens.
- No SSR data fetching. The page shell may be static; interactive areas are client components.

### 3.2 File layout

The spec uses a root-level layout. If the repository already uses `src/`, map the same paths
under `src/` (e.g. `src/app/page.tsx`, `src/components/...`, `src/lib/...`).

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
examples/
  users.json
```

No `lib/api/generated`, no `lib/schema`, no stores, no hooks beyond `useMockBuilder` if used.

### 3.3 Existing repository note

The repository may still contain code from the old multi-page plan (landing page, `/new`,
`/help`, meta provider, token store, wizard store, error map, logs components). **SPR-01
removes or stops using everything outside the new scope.** Reusable Tailwind/shadcn
primitives may stay, but do not let them pull in extra scope.

### 3.4 Package manager

The sprint acceptance command is `npm run build`. Standardise on **npm** and commit a single
`package-lock.json`. Remove pnpm-specific pinning and `pnpm-lock.yaml` if they are present.
If the team deliberately keeps pnpm, document the equivalence and still verify a clean
`npm install && npm run build`; do not commit two lockfiles.

---

## 4. UI and state

### 4.1 Layout

One route, three stacked areas on mobile / two columns on desktop:

```
+-------------------------------------------------------------+
| Header: MockAPI                         API: localhost:5031 |
+----------------------------+--------------------------------+
| 1. JSON sample             | 3. Result                      |
|    privacy note            |    baseUrl + copy              |
|    textarea                |    endpoint URL + copy         |
|    [ ] Return as list      |    [Test endpoint]             |
|    [Infer schema]          |    status / headers / body     |
|                            |                                |
| 2. Endpoint settings       | 4. Schema preview (JSON)       |
|    method, path            |                                |
|    success status          |                                |
|    delay min/max           |                                |
|    error rate + codes      |                                |
|    list size min/max       |                                |
|    [Create mock]           |                                |
+----------------------------+--------------------------------+
```

The **Create mock** button stays disabled until the sample parses, inference succeeds, and
settings are valid.

### 4.2 State machine

```
idle -> inferring -> inferred -> creating -> created
             |            |          |
             +-> error <--+----------+
```

Rules:

- Sample change after `inferred` invalidates the schema and returns to `idle`.
- Keep the previous schema/preview visible but mark it **stale**.
- Infer button disabled while the textarea is empty or inference is running.
- Create disabled unless `inferred` and settings are valid.
- On create success, show the result panel and scroll to it; do not open a new tab.
- Re-running the mock test must not create another project.
- `POST`/`PUT` tests send `{}`; `DELETE` sends no body.
- Show `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`, `X-Request-Id` as chips.
- Non-JSON responses show raw text plus status.
- Privacy note above the textarea: **"Do not paste real or sensitive data."**
- No `localStorage` persistence of samples, schemas or tokens.

### 4.3 Error display

- Inline field errors for local validation.
- Banner for API errors with `code` and `detail`; never "Something went wrong".
- `errors` map entries go under the matching field; otherwise list them in the banner.
- Network failure: `Cannot reach API at {BASE}. Is the backend running?`

### 4.4 Accessibility

- Every input has a label.
- Error text is associated with `aria-describedby`.
- Buttons expose `aria-busy` while loading.
- Copy buttons announce **"Copied"** for 2 seconds.
- Mobile: no horizontal scroll at 360 px; keyboard-only flow works.

---

## 5. Settings defaults and validation

| Field | Control | Default | Validation |
|---|---|---|---|
| `method` | select | `GET` | `GET`, `POST`, `PUT`, `DELETE` |
| `path` | text | `/users` | starts with `/`, no `?`/`#`/spaces, max 200 |
| `successStatus` | select | GET 200, POST 201, PUT 200, DELETE 204 | `200`, `201`, `202`, `204` |
| `delay.minMs` | number | 0 | `0..10000` |
| `delay.maxMs` | number | 0 | `0..10000`, `>= minMs` |
| `errors.ratePercent` | number | 0 | `0..100`, one decimal |
| `errors.statusCodes` | chips/multi-select | `[500]` | 1–10 unique, `400..599`; required when rate > 0 |
| `list.size.min` | number | 10 | `0..1000` |
| `list.size.max` | number | 10 | `0..1000`, `>= min` |
| `wrapInList` | switch | false | only when the sample root is not an array |

Presets:

- **Fast + reliable:** delay `0–0`, errors `0`.
- **Realistic:** delay `300–1500`, errors `10%` with `[500, 503]`.
- **Flaky demo:** errors `100%` with `[503]`.

Limits come from `GET /api/v1/meta` when available. If it is unavailable, use the fallback
constants in `lib/defaults.ts`; do not scatter literals through components.

---

## 6. Sprint tasks and schedule

| ID | Task | Priority | Size | Depends on | Slot |
|---|---|---|---|---|---|
| [SPR-01](./tasks/SPR-01-contract-cleanup-scaffold.md) | Contract check, cleanup, scaffold, env, types, API client | P0 | 10 min | — | 0–10 |
| [SPR-02](./tasks/SPR-02-sample-input-and-infer.md) | JSON sample input and infer | P0 | 15 min | SPR-01 | 10–25 |
| [SPR-03](./tasks/SPR-03-settings-form.md) | Endpoint settings form | P0 | 20 min | SPR-01 | 25–45 |
| [SPR-04](./tasks/SPR-04-create-and-result.md) | Create mock, result panel and copy | P0 | 20 min | SPR-02, SPR-03 | 45–65 |
| [SPR-05](./tasks/SPR-05-test-panel.md) | Test panel, headers and injected-error badge | P0 | 15 min | SPR-04 | 65–80 |
| [SPR-06](./tasks/SPR-06-polish-build-smoke.md) | States, accessibility, responsive, build and smoke | P0 | 10 min | SPR-02…05 | 80–90 |
| [SPR-07](./tasks/SPR-07-optional-preview.md) | Optional preview panel | P2 | 10 min | SPR-03 | cut first |

### Critical path

`SPR-01 → SPR-02/SPR-03 → SPR-04 → SPR-05 → SPR-06`

### Parallelisation

- **SPR-01 must run alone.** It owns `package.json`, the lockfile, `app/layout.tsx`,
  `app/page.tsx`, `lib/*` and the legacy-code cleanup.
- After SPR-01, **SPR-02 and SPR-03 can run in parallel** (sample/infer vs settings).
- SPR-04 merges both. SPR-05 follows SPR-04. SPR-06 is the final gate.
- SPR-07 is optional and can run in parallel with SPR-04/SPR-05 only if someone is free.
- Do not parallelise anything else: this is a one-page app with shared state in `page.tsx`.

---

## 7. Acceptance criteria

- [ ] Paste the demo sample, infer, create, and see a mock URL.
- [ ] Copy the URL; `GET` it in a browser or curl and receive generated JSON.
- [ ] Calling the URL twice returns different data.
- [ ] `X-Mock-Delay-Ms` matches the configured range.
- [ ] With error rate 100%, the test panel shows the injected status and `injected: true`.
- [ ] Invalid JSON disables inference and shows a readable message.
- [ ] Invalid settings disable creation and flag the field.
- [ ] Backend `4xx` errors render `code` and `detail`, not "Something went wrong".
- [ ] Mobile layout is usable; no horizontal scroll at 360 px.
- [ ] `npm run build` passes; no console errors in the demo flow.

---

## 8. Definition of Done (every task)

1. Acceptance criteria pass against the **real backend** at `http://localhost:5031`.
2. `npm run build` passes; no TypeScript errors; no new console warnings.
3. Empty, loading, error and success states are handled where the task renders UI.
4. Works at 360 px and by keyboard where the task renders UI.
5. Limits/status lists come from `GET /api/v1/meta` when available, otherwise from
   `lib/defaults.ts`. No scattered hard-coded numbers.
6. No sample content, token or request body is written to `console`, analytics or error
   reports.
7. No `localStorage`/`sessionStorage` persistence of samples, schemas or tokens.
8. No new dependency without checking it is in the sprint spec.

---

## 9. Demo script

1. Paste the sample from `examples/users.json`.
2. Click **Infer schema**; show the inferred fields and schema JSON.
3. Set delay `300–1500` and errors `10%` / `[500, 503]`.
4. Click **Create mock**; copy the URL.
5. Click **Test endpoint** twice; show different data and the delay chip.
6. Set errors to `100%`; test again; show the injected 503 badge.
7. Point out the privacy note and the one-page flow.

If behind schedule, cut the optional preview panel and the collapsible schema first. Never cut
create, copy or test.

---

## 10. Backend assumptions — stop if false

- CORS for the frontend origin (`http://localhost:3000`) is enabled on `/api/v1/*`.
- CORS on `/m/*` allows any origin and exposes `X-Request-Id`, `X-Mock-Delay-Ms`,
  `X-Mock-Injected-Error`.
- `POST /api/v1/projects` accepts `sample` **or** `schema`; the sprint UI sends one of them,
  plus `options` and `settings`.
- Error bodies follow `ApiProblem`; runtime errors follow `RuntimeErrorBody`.
- No auth header is required in the sprint.

If any assumption is false, **stop and align the contract before building the UI. Do not guess.**

---

## 11. Legacy plan

The previous multi-page plan (61 tasks across FND/WIZ/PRJ/RUN/QLT/LAU) is archived at
[`tasks/archive/legacy-plan/`](./tasks/archive/legacy-plan/) with its original
[`frontend-tasks.md`](./tasks/archive/frontend-tasks.md). It is kept for reference only.
