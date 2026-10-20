# Runbook

Operating manual for the FakeEnd frontend: how to run it, how the pieces fit
together, and what to do when something breaks.

> The repository root `README.md` is the short version. This runbook covers the
> single-page builder in detail: the sample → infer → settings → create → test
> flow, the API contract it uses, and the failure modes behind each error
> message.

## 1. Requirements

- Node.js 20 or newer
- npm (the repo commits a single `package-lock.json`)
- A running FakeEnd management API for anything but the static checks

## 2. First run

```bash
cp .env.example .env.local     # then set the backend origin
npm install
npm run dev                    # http://localhost:3000
```

Without the real backend, `npm run dev:backend` starts a local stand-in for the
management API on `http://localhost:5031` — the default origin the page uses.

The page is a single route (`/`). It renders before the API answers, so a
missing backend shows an inline error instead of a blank screen.

## 3. Environment variables

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | No | `https://api.example.com` | Management API **origin** only. The client appends `/api/v1`. No trailing slash, no path. Defaults to `http://localhost:5031`. |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
they must never contain a secret and a change needs a rebuild, not a restart.

## 4. Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on port 3000. |
| `npm run dev:backend` | A local stand-in for the management API on port 5031, so the page can be run without the real backend. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint over the repository. |
| `npm run typecheck` | `tsc --noEmit`. |

## 5. User flow

1. **Paste.** The sample is parsed in the browser. Invalid JSON disables
   **Infer schema** and shows the parser message next to the editor.
2. **Infer.** `POST /api/v1/infer` returns the schema, the warnings and the
   suggestions. The schema is displayed read-only as JSON.
3. **Settings.** Method, path, success status, delay bounds, error rate,
   error status codes and list size. Every bound comes from `/api/v1/meta`
   when it is available and from `src/lib/defaults.ts` when it is not, so the
   form never blocks on the API. Three presets (fast, realistic, flaky) fill
   the fields in one click.
4. **Create.** `POST /api/v1/projects` sends either the `sample` or the
   inferred `schema` for the endpoint, never both.
5. **Result.** The base URL and the endpoint URL are shown with a copy
   button.
6. **Test.** The test panel calls the runtime URL directly from the browser —
   no edit token is sent — and shows the status, the runtime headers
   (`X-Request-Id`, `X-Mock-Delay-Ms`, `X-Mock-Injected-Error`), the latency
   and the body.

## 6. Architecture

| Area | Where | Notes |
| --- | --- | --- |
| Route | `src/app/page.tsx` | The only page. It renders the builder. |
| Builder | `src/components/builder/builder.tsx` | The state machine: sample, inference, settings, create, result, test. |
| API client | `src/lib/api.ts` | The only management API entry point. `request<T>`, `getMeta`, `infer`, `preview`, `createProject`. |
| Types | `src/lib/types.ts` | The contract types from `frontend-spec.md` §4. |
| Defaults | `src/lib/defaults.ts` | Fallback limits, status lists, settings presets and `limitsFromMeta`. |
| Validation | `src/lib/validation.ts` | Path, sample and settings validators. They run in the browser before every request. |
| Security headers | `next.config.ts` | CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. |

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Cannot reach API at …" | The management API is not running, or the origin is wrong | Check `NEXT_PUBLIC_API_BASE_URL` and that the API answers `GET /api/v1/meta`. |
| The browser console shows a CORS error | The API does not allow this origin | Add the frontend origin to the API allowlist; the preflight `OPTIONS` must answer with the same origin. |
| The form shows fallback limits | `GET /api/v1/meta` failed | The builder falls back to `defaults.ts` on purpose. Fix the API and reload. |
| **Infer schema** stays disabled | The sample is not valid JSON, or it is empty | The message under the editor names the JSON error. |
| **Create mock** stays disabled | The schema is stale, or the settings are invalid | Change the sample to re-infer; the invalid field is highlighted under the input. |
| The test panel reports a network error | The runtime host is unreachable from the browser, or CORS is missing | The runtime is a separate host from the management API; both must allow this origin. |
| A failing request shows "Request failed (500)" | The API answered with a non-JSON body | The raw body is included in the detail line. |
| `npm run build` fails on stale route types | The generated types in `.next` are older than the routes | Remove `.next` and build again. |

## 8. Known limitations

- The sample is parsed in the browser and sent to the API for inference. It is
  never stored by this app.
- The edit token is returned by the API but is not persisted, copied or logged
  by this page.
- The runtime URL is public: anyone with it can call the endpoint.
- Only one endpoint is created per project by this builder.
- There is no persistence: a reload loses the sample, the schema and the
  project.
