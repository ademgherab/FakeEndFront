# T01 — Database schema, EF Core mapping, migrations

- **Milestone:** M0
- **Depends on:** T00
- **Spec refs:** §4 (DDL, notes), §3 (naming), §11.1 (retention)

## Goal

PostgreSQL 16+ schema exactly as specified, mapped with EF Core and reversible migrations, including the unique/cascade behavior the API relies on.

## Scope

- Entities: `Project`, `Endpoint`, `RequestLog`, `ProjectUsageDaily`.
- `MockApiDbContext` with `UseSnakeCaseNamingConvention()`.
- Initial migration matching §4.1 (tables, constraints, indexes, defaults).
- Repository/query helpers used by later tasks (`FindBySlug`, `ListLogs`, usage upsert).

## Implementation checklist

- [x] `projects`: `id` uuid PK default `gen_random_uuid()`, `slug varchar(16) UNIQUE`, `name varchar(60) NULL`, `edit_token_hash bytea NOT NULL`, timestamps `timestamptz`; index on `expires_at`.
- [x] `endpoints`: FK cascade, `method varchar(6)` with CHECK, `path`/`path_normalized varchar(200)`, `schema_version smallint`, `schema_json jsonb`, `settings_json jsonb`, `uq_endpoints_route (project_id, method, path_normalized)`.
- [x] `request_logs`: identity `bigint`, FK cascade to project, nullable `endpoint_id` with `ON DELETE SET NULL`, `request_body text`, index `(project_id, id DESC)`.
- [x] `project_usage_daily`: composite PK `(project_id, day)`, cascade.
- [x] Map `schema_json`/`settings_json` as `jsonb` (owned JSON or string converter). Round-trip must preserve the schema array order.
- [x] `edit_token_hash` stored as `bytea` length 32.
- [x] No `IP` column anywhere.
- [x] Migration applies cleanly to an empty database and rolls back.

## Acceptance criteria

- [x] `dotnet ef database update` creates all four tables, constraints, and indexes.
- [x] Deleting a project cascades to endpoints, logs, usage; deleting an endpoint nulls `request_logs.endpoint_id`.
- [x] Duplicate `(project_id, method, path_normalized)` is rejected by the DB, not only by app code.
- [x] JSON column round-trip test proves field order and numeric types are preserved.

## Tests

- Integration test (Testcontainers or a disposable local PG) applying migrations and asserting constraints.
- Cascade-delete integration test.
- JSON round-trip unit test.

## Notes

- `jsonb` does not preserve key order; the schema uses arrays for fields for this reason (§4.2). Never "simplify" fields to an object.
- `gen_random_uuid()` requires PG 13+; PG 16 is assumed.

## Out of scope

Query optimization, partitioning, read replicas.
