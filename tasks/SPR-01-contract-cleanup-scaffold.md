---
id: "SPR-01"
title: "Contract check, cleanup, scaffold, env, types and API client"
milestone: "Sprint — 0–10 min"
priority: "P0"
size: "10 min"
status: "todo"
owner: ""
depends_on: []
spec_refs: ["§1","§3","§4","§5","§11"]
---

# SPR-01 · Contract check, cleanup, scaffold, env, types and API client

| Field | Value |
|---|---|
| Milestone | Sprint — 0–10 min |
| Priority | P0 |
| Size | 10 min |
| Depends on | — |
| Spec | §1, §3, §4, §5, §11 |

## Context

The new `frontend-spec.md` is a **single-page, 90-minute sprint**. It replaces the old
multi-page plan. The repository may still contain legacy routes and state from that plan
(landing page, `/new`, `/help`, meta provider, token store, wizard store, logs, schema
editor).

Before writing UI, confirm the backend contract and remove everything outside the sprint
scope. If an assumption in `frontend-spec.md` §11 is false, **stop and align**; do not guess.

## Scope

### 1. Confirm the contract

- CORS for `http://localhost:3000` on `/api/v1/*`.
- CORS for `/m/*` with exposed `X-Request-Id`, `X-Mock-Delay-Ms`,
  `X-Mock-Injected-Error`.
- `POST /api/v1/projects` accepts one endpoint with `sample` **or** `schema`
  (never both), plus `options` and `settings`.
- Error bodies follow `ApiProblem`; runtime errors follow `RuntimeErrorBody`.

### 2. Remove legacy scope

- Keep only the `/` route.
- Remove or stop using `/new`, `/projects`, `/p/[slug]`, `/help`, `/expired`, logs, auth,
  token storage, recent projects, schema editor, multi-endpoint builder, meta provider and
  wizard store.
- Keep reusable Tailwind/shadcn primitives and small shared components if they do not pull
  in extra scope.
- Remove unused dependencies and the old task-era modules they supported.

### 3. Environment and scaffold

- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:5031`.
- No `app/api/*` route and no BFF. The browser calls the backend directly.
- Keep the App Router, TypeScript and Tailwind scaffold. `/` renders the builder shell.
- Standardise on **npm** (the sprint acceptance command is `npm run build`). Commit one
  `package-lock.json`; remove pnpm-specific pinning and `pnpm-lock.yaml` if present.

### 4. Types and defaults

- `lib/types.ts` mirrors `frontend-spec.md` §4 exactly:
  `Method`, `Schema`, `SchemaNode`, `ObjectNode`, `ArrayNode`, `LeafNode`,
  `EndpointSettings`, `InferResponse`, `Endpoint`, `Project`, `ApiProblem`,
  `RuntimeErrorBody`.
- `lib/defaults.ts` contains the settings defaults from §5 and the fallback limits/status
  lists. No scattered literals in components.
- If the repo uses `src/`, place these under `src/lib/`.

### 5. API client

- `lib/api.ts` exports `BASE` and a `request<T>` helper.
- Helpers for `infer`, `createProject`, and optional `preview`.
- JSON `Content-Type`; parse `text()` so `204`/empty bodies work.
- On `!res.ok`, throw an object carrying `{ problem, status }`.
- No auth header. No console logging of samples, tokens or request bodies.
- For the mock test call, use raw `fetch` instead; do not throw on 4xx/5xx (SPR-05).

### 6. Example fixture

- Add `examples/users.json` for the demo script.

## Acceptance criteria

- [ ] Backend CORS and the §11 assumptions are confirmed. If not, work stops with a written
      note of the mismatch.
- [ ] `npm install && npm run dev` starts and `/` renders the builder shell.
- [ ] Only `/` remains; legacy out-of-scope routes are removed.
- [ ] Only one lockfile is committed and `npm run build` passes.
- [ ] `lib/types.ts`, `lib/defaults.ts` and `lib/api.ts` exist and compile.
- [ ] `BASE` uses `NEXT_PUBLIC_API_BASE_URL` with the `http://localhost:5031` fallback.
- [ ] No Next.js API route, BFF, state manager, Zod, React Hook Form, TanStack Query,
      CodeMirror or MSW was added.
- [ ] No sample/schema/token is written to `localStorage` or `sessionStorage`.

## Implementation notes

- Read `frontend-spec.md` §3 before writing the API client. The sprint contract is short;
  do not rely on the archived multi-page plan.
- Keep the API error object simple: `{ status, problem }`. Components read
  `problem.code`, `problem.detail` and `problem.errors`.
- The optional `GET /api/v1/meta` must not block rendering. Use `defaults.ts` as fallback.
- Do not add a design system. Reuse the existing Tailwind/shadcn primitives where useful.
- Delete dead legacy files rather than leaving them commented out.

## Testing

- Start the backend, run `npm run dev`, load `/`, click through a placeholder.
- From the browser console or a temporary button, call `/api/v1/infer` once to verify CORS.
- Run `npm run build`.
- Confirm no legacy route still resolves.

## Definition of Done

- [ ] Acceptance criteria verified against the real backend.
- [ ] Build and typecheck pass.
- [ ] No console errors or warnings from removed imports.
- [ ] The repository has no reference to the old multi-page flow.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
