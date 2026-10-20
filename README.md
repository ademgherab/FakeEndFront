# MockAPI frontend

Next.js (App Router) + TypeScript + Tailwind frontend for the MockAPI service.

This repository is now scoped to the **90-minute single-page sprint** described in
[`frontend-spec.md`](./frontend-spec.md). The previous multi-page plan is archived in
[`tasks/archive/legacy-plan/`](./tasks/archive/legacy-plan/) and must not be executed.

## Sprint goal

One page: paste JSON → infer a schema → configure delay/errors/list size → create a mock →
copy the URL → test the endpoint → inspect the response.

## Requirements

- Node.js 20 or newer
- npm (the sprint acceptance command is `npm run build`)
- The MockAPI backend running at `http://localhost:5031`

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app runs at <http://localhost:3000> and calls the backend directly from the browser.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | No | Backend origin. Defaults to `http://localhost:5031`. No trailing slash. |

There is no Next.js API route and no BFF. There is no auth header in the sprint.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |

Manual smoke per `frontend-spec.md` §9 is the required test pass. Unit/E2E suites from the
old plan are out of scope.

## Architecture

- One route: `/`.
- State lives in `page.tsx` (or a single `useMockBuilder` hook); no state manager.
- `lib/api.ts` owns management calls; the mock test call uses raw `fetch`.
- `lib/types.ts` mirrors the spec contract; `lib/defaults.ts` holds settings defaults and
  fallback limits.
- `examples/users.json` is the demo fixture.
- No `localStorage`/`sessionStorage` persistence of samples, schemas or tokens.

## Tasks

| Document | Purpose |
| --- | --- |
| [`frontend-spec.md`](./frontend-spec.md) | Sprint contract (source of truth). |
| [`frontend-tasks.md`](./frontend-tasks.md) | Sprint plan, scope, state machine, acceptance. |
| [`tasks/README.md`](./tasks/README.md) | Task index and 90-minute schedule. |
| [`tasks/SPR-01…07`](./tasks/) | Individual sprint tasks. |

## Out of scope

Accounts, edit tokens as auth, saved projects, logs, pagination UI, schema field editor,
multiple endpoints, seed/rate limits/OpenAPI, MSW, unit/E2E suites, dark-mode toggle,
i18n and SSR data fetching. See `frontend-spec.md` §1.

## Legacy plan

The 61-task multi-page plan is archived at [`tasks/archive/legacy-plan/`](./tasks/archive/legacy-plan/)
for reference only.
