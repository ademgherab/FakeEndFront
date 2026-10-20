# T16 — OpenAPI document and published contract

- **Milestone:** M2 (incremental)
- **Depends on:** T09 (routes), T07
- **Spec refs:** §3 (OpenAPI), §10.3, §10.5

## Goal

Publish a machine-readable contract the frontend can generate TypeScript types from, covering every management endpoint with accurate schemas and examples.

## Scope

- `Microsoft.AspNetCore.OpenApi`, served at `/openapi/v1.json`.
- Request/response schemas for meta, infer, preview, projects, endpoints, logs.
- Error schema matching §3.1.
- Runtime routes documented as out of the OpenAPI management contract (separate description).

## Implementation checklist

- [ ] `/openapi/v1.json` is anonymously accessible and versioned in the path.
- [ ] Every `/api/v1` route appears with correct method, path, params, defaults, and status codes.
- [ ] `Schema`, `EndpointSettings`, `Endpoint`, `Project`, `LogEntry`, `ProblemDetails` are reusable components.
- [ ] Polymorphic `SchemaNode` is represented with the `type` discriminator so generated types are usable.
- [ ] Enums are strings (`GET`, error codes, generator names where applicable).
- [ ] Examples for `/infer` (schema from §5.2) and `/preview` (paginated output).
- [ ] `Authorization` security scheme (`Bearer`) applied to project-scoped operations; `/meta`, `/infer`, `/preview`, `/projects` creation are anonymous.
- [ ] Document `Location`, `Retry-After`, `X-Request-Id` headers.
- [ ] Frontend type generation is possible without hand-written patches (verify by running a generator once).
- [ ] Keep the document in sync via a CI check or test that fails when a route is undocumented.

## Acceptance criteria

- [ ] The document validates against the OpenAPI 3.x schema used by the chosen generator.
- [ ] Every documented status code matches the implementation (spot-checked by contract tests).
- [ ] Generated TypeScript types include `SchemaNode`, `Endpoint`, `EndpointSettings`, and the error envelope.
- [ ] Adding a new route without documenting it fails CI.

## Tests

- Snapshot/read test of `/openapi/v1.json`.
- Contract test comparing documented routes to the endpoint data source.
- Generator smoke test (typescript) in CI.

## Notes

- The mock runtime (`/m/{slug}`) is intentionally not part of the management contract; describe it in docs instead.
- Treat the OpenAPI document as a deliverable artifact, not a debugging convenience.
