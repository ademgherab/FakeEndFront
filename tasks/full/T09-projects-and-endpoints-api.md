# T09 — Projects and endpoints management API

- **Milestone:** M2
- **Depends on:** T07, T08
- **Spec refs:** §10.1 (#4–#13), §10.3 (#4–#13), §10.4, §10.5, §8

## Goal

The complete CRUD surface for projects and endpoints, including the one-time token response, atomic creation, duplicate detection, and schema/settings replacement.

## Scope

- `POST /projects`, `GET /projects/{slug}`, `PATCH /projects/{slug}`, `DELETE /projects/{slug}`.
- `POST /projects/{slug}/endpoints`, `GET/PUT/DELETE /projects/{slug}/endpoints/{id}`.
- `PUT .../schema` and `PUT .../settings`.
- `GET /projects/{slug}` usage block (counts from T13; return 0 until wired).
- Endpoint object projection with `url`.

## Implementation checklist

- [ ] Slug: 10 chars `[a-z0-9]` from `RandomNumberGenerator`; retry on unique violation, max 5 attempts.
- [ ] `expiresAt = createdAt + projectLifetimeDays` (default 7).
- [ ] `POST /projects` accepts 1..max endpoints; each has exactly one of `sample` xor `schema`; both/none → `400`.
- [ ] Duplicate `(method, normalizedPath)` in the request → `409 duplicate_endpoint`.
- [ ] Creation is atomic: a bad endpoint saves nothing.
- [ ] Response `201` + `Location: /api/v1/projects/{slug}`; body includes `slug`, `editToken`, `name`, `createdAt`, `expiresAt`, `baseUrl`, `endpoints`.
- [ ] `GET /projects/{slug}` returns project + `usage { requestsToday, dailyLimit }` + endpoints; no token, no hash.
- [ ] `PATCH` accepts `{ name }`, `null` clears; validate 1..60 when non-null; 200 with full project.
- [ ] `DELETE` returns `204`; a second call returns `404`.
- [ ] Add endpoint: enforce `maxEndpointsPerProject` → `422 endpoint_limit_reached`; `409` on route conflict; `201` + `Location`.
- [ ] `PUT /endpoints/{id}`: full replace; `schema` and `settings` required; re-validate path/method/schema/settings; conflicts → `409`.
- [ ] `PUT .../schema`: validate new schema, then re-validate **existing settings**; on failure return `422` keyed to settings and save nothing.
- [ ] `PUT .../settings`: replace settings; run T12 cross-checks.
- [ ] `DELETE /endpoints/{id}` → `204`; project may end with zero endpoints.
- [ ] `GET/PUT/DELETE` unknown endpoint → `404 endpoint_not_found`.
- [ ] Path validation per §10.4: leading `/`, ≤200 chars, no query/fragment, no `//`, no `.`/`..`, trailing slash removed except `/`, segments `[A-Za-z0-9._~-]+` or `{name}`, unique param names.
- [ ] `path_normalized`: static segments lower-cased, each template becomes `{}`; `/Users/{id}` conflicts with `/users/{userId}`.
- [ ] Method accepted case-insensitively, stored upper-case, restricted to `GET/POST/PUT/DELETE`.
- [ ] Endpoint object exactly per §10.5, including `url` with placeholders preserved.
- [ ] All token endpoints run T08 auth in the documented order.
- [ ] Unknown properties rejected with `400`.

## Acceptance criteria

- [ ] The §10.3 (#4) request creates the project and returns the documented shape.
- [ ] Every endpoint operation returns an Endpoint object with the same schema/settings shape.
- [ ] `GET` never leaks `edit_token_hash`.
- [ ] Concurrent creation of the same slug/path cannot produce duplicates (DB constraint is the backstop).
- [ ] Template-vs-static conflicts return `409` as specified.
- [ ] Endpoint limit is enforced at exactly the configured value.

## Tests

- Integration tests for every route and status code in §10.3.
- Path normalization table tests (trailing slash, case, templates, invalid segments, duplicates).
- Atomicity test: second endpoint invalid ⇒ no project/endpoint rows.
- Auth matrix reused from T08.
- OpenAPI snapshot updated.

## Out of scope

Request logs API (T13), cache invalidation (T10), rate limiting (T15).
