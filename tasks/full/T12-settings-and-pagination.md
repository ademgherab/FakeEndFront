# T12 — Endpoint settings validation and pagination

- **Milestone:** M1
- **Depends on:** T04, T06 (used by T07 and T11)
- **Spec refs:** §8 (all), §5.3, §10.3 (#3, #11, #12), §11.1

## Goal

The settings object with defaults, validation, save-time cross-checks, and the full pagination behavior used by both preview and runtime.

## Scope

- `EndpointSettings` DTOs + defaults per method.
- Validation rules (§8.2) and cross-checks (§8.3).
- Pagination parser, clamps, headers, `Link`, and body bindings (§8.4).
- Reusable component for preview and runtime.

## Implementation checklist

- [x] Shape exactly per §8.1; all inputs optional, full object returned with defaults applied.
- [x] Defaults: `successStatus` GET 200 / POST 201 / PUT 200 / DELETE 204; delay `0/0`; errors `{0, [500]}`; list `{null, 10..10}`; pagination `{false, 100, 10, 100, all bindings null}`; `seed null`.
- [x] `successStatus`: one of `200, 201, 202, 204`; `204` ⇒ no body.
- [x] Delay: `0..10000`, `minMs <= maxMs`; equal = fixed.
- [x] Errors: `ratePercent 0..100` with at most one decimal; `statusCodes` 1–10 unique in `400..599`; required non-empty when rate > 0.
- [x] `list.path`: RFC 6901 pointer to an array node, or `null` meaning root (root must then be an array).
- [x] `list.size`: `0..1000`, `min <= max`; ignored when pagination enabled.
- [x] Pagination: `totalItems 0..10000`, `maxLimit 1..100`, `defaultLimit 1..maxLimit`.
- [x] Bindings: pointers must resolve to leaves of the right type (integer for page/limit/total/totalPages, boolean for hasNext/hasPrev).
- [x] Cross-check: worst-case value count (`max list size` or `maxLimit` × nested `length.max` × leaves) `<= 100000` → else `422 response_too_large`.
- [x] `pagination.enabled` without a usable list → `validation_failed` keyed `settings.pagination.enabled`.
- [x] Unresolvable `list.path` or binding pointers → `validation_failed` with the offending pointer.
- [x] Pagination query: fixed names `page` and `limit`; non-integer or `< 1` → `400 invalid_pagination`.
- [x] `limit > maxLimit` is clamped, not an error.
- [x] `start = (page-1)*limit`, `count = min(limit, max(0, totalItems-start))`; beyond-end pages return `200` with an empty list.
- [x] `totalPages = ceil(totalItems/limit)`, `0` when `totalItems = 0`.
- [x] Headers always: `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`, `Link` with absolute `first/prev/next/last`.
- [x] Body bindings: replace the target field's generated value with the real value.
- [x] Other query params ignored.
- [x] `autoId` uses the pagination offset (T06).

## Acceptance criteria

- [x] Defaults returned for an empty `settings` object match §8.1 exactly.
- [x] `{ ratePercent: 10, statusCodes: [] }` is rejected.
- [x] `{ delay: { minMs: 500, maxMs: 100 } }` is rejected with the correct key.
- [x] A schema/settings combination over 100k values is rejected at save and in preview.
- [x] `page=2&limit=10` with `totalItems=25` returns 10 items, `X-Page: 2`, `X-Total-Pages: 3`, correct `Link` URLs.
- [x] `page=99` returns an empty list with `200`.
- [x] Bound fields in the body equal the header values.
- [x] `limit=1000` with `maxLimit=100` yields 100 items and `X-Limit: 100`.

## Tests

- Table-driven settings validation tests (each rule and boundary).
- Cross-check tests with nested arrays.
- Pagination math tests including `totalItems = 0`, `maxLimit` clamp, non-numeric params.
- `Link` header absolute-URL tests using the configured base URL.
- Schema replacement test: new schema invalidates existing settings cross-checks.

## Notes

- Bindings are JSON Pointers to leaves, despite the loose wording in the §10.3 preview example (see README gaps).
- Keep this logic in a shared service so preview and runtime cannot drift.
