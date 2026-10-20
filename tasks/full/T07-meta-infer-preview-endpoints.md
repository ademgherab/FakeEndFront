# T07 — `GET /meta`, `POST /infer`, `POST /preview`

- **Milestone:** M1
- **Depends on:** T05, T06, T12 (T02, T04)
- **Spec refs:** §10.1 (#1–#3), §10.3 (#1–#3), §11.1

## Goal

The three stateless management endpoints the frontend uses to boot, infer a schema, and preview output.

## Scope

- `GET /api/v1/meta` built entirely from configuration + generator catalog metadata.
- `POST /api/v1/infer`.
- `POST /api/v1/preview`.

## Implementation checklist

### `/meta`
- [ ] Returns `mockBaseUrl`, `projectLifetimeDays`, `methods`, `successStatuses`, `errorStatusRange`, `limits` (all §11.1 values), and `generators`.
- [ ] Generator entries include `name`, `nodeTypes`, and `params` with `name`, `type`, `required`, defaults/ranges.
- [ ] Every value comes from `MockApiOptions`; no constants in the handler.
- [ ] Cached-friendly (safe `Cache-Control`), no auth.

### `/infer`
- [ ] Request `{ sample, options: { wrapInList } }`; `sample` may be any JSON object/array.
- [ ] Returns `{ schema, warnings, suggestions }` per §10.3.
- [ ] Nothing is stored or logged; enum values are the only sample-derived data returned.
- [ ] Errors: `400 validation_failed`, `422 sample_invalid`, `422 sample_too_complex`, `413`, `429` (rate limit wired in T15).
- [ ] Body limit 256 KB enforced before parsing.

### `/preview`
- [ ] Request `{ schema, settings?, page?, limit? }`; settings default per §8.
- [ ] Generates exactly like the runtime but with **no delay, no errors, no logging, no storage**.
- [ ] `page`/`limit` used only when `settings.pagination.enabled`.
- [ ] Response `{ data, pagination }`, `pagination` null when disabled.
- [ ] Errors: `400`, `422 response_too_large`, `413`, `429`.
- [ ] Reuses T04 validation, T06 generation, and T12 settings cross-checks; do not duplicate defaults or pagination math here.

## Acceptance criteria

- [ ] `/meta` output matches the §10.3 example shape and all limits equal configuration.
- [ ] Inferring then previewing the inferred schema succeeds with default settings.
- [ ] Preview of a list schema with `size { min: 3, max: 3 }` and a seed is stable and has exactly 3 items.
- [ ] Preview never touches the database or writes request logs.
- [ ] Unknown properties in the request body are rejected.

## Tests

- Contract tests comparing `/meta` to the documented fields.
- Integration tests for infer → preview round trip.
- Error-path tests for each listed status.
- A test asserting no DB connection is opened during `/infer` and `/preview`.

## Out of scope

Project creation, persistence, rate limiter implementation (T15).
