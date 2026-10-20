# Backend Task Breakdown — MockAPI

Implementation plan for the backend half of `mockapi-technical-spec.md` (ASP.NET Core + PostgreSQL).
Each task is a self-contained work item with scope, checklist, acceptance criteria, and tests.

**Source of truth:** `../mockapi-technical-spec.md`. If this breakdown and the spec disagree, the spec wins; fix the task file in the same PR.
**Frontend is out of scope here.** The contract between the two halves is the published OpenAPI document plus the mock runtime rules in spec §9.

---

## Milestones

| Milestone | Goal | Tasks |
|---|---|---|
| M0 Foundations | App boots, DB migrates, errors/logging/config ready | T00, T01, T02, T03 |
| M1 Core engines | Infer a schema, generate data, settings, preview it | T04, T05, T06, T12, T07 |
| M2 Management API | Create and manage projects/endpoints, contract | T08, T09, T10, T16 |
| M3 Mock runtime | Public `/m/{slug}` behaves per spec §9 | T11 |
| M4 Observability & limits | Logs, usage, background jobs, rate limits | T13, T14, T15 |
| M5 Hardening & release | Security pass, tests, deploy | T17, T18, T19 |

## Task index

| # | Task | Depends on |
|---|---|---|
| [T00](T00-project-setup.md) | Solution scaffolding, configuration, DI | — |
| [T01](T01-database-and-migrations.md) | PostgreSQL schema, EF Core mapping, migrations | T00 |
| [T02](T02-error-handling-and-contracts.md) | ProblemDetails, error codes, JSON conventions | T00 |
| [T03](T03-logging-and-observability-baseline.md) | Serilog, correlation IDs, health probes | T00 |
| [T04](T04-schema-model-and-validation.md) | Schema DTOs, validation, limits | T02 |
| [T05](T05-inference-engine.md) | Sample JSON → schema + warnings + suggestions | T04 |
| [T06](T06-generation-engine.md) | Generators, seeding, streaming writer, cap | T04 |
| [T07](T07-meta-infer-preview-endpoints.md) | `GET /meta`, `POST /infer`, `POST /preview` | T05, T06, T12 |
| [T08](T08-edit-token-auth.md) | Token issue/hash/verify, auth filter | T01, T02 |
| [T09](T09-projects-and-endpoints-api.md) | CRUD for projects and endpoints | T07, T08 |
| [T10](T10-project-cache.md) | In-memory project/endpoint cache + invalidation | T09 |
| [T11](T11-mock-runtime.md) | Runtime pipeline, matching, CORS, errors | T06, T10, T12 |
| [T12](T12-settings-and-pagination.md) | Settings validation/cross-checks, pagination | T04, T06 |
| [T13](T13-request-logs-and-usage.md) | Log queue/writer, usage counters, logs API | T11, T12 |
| [T14](T14-background-jobs.md) | Expiry, purge, log retention, usage flush | T13 |
| [T15](T15-rate-limiting.md) | All rate-limit policies + forwarded headers | T09, T11 |
| [T16](T16-openapi-and-docs.md) | `/openapi/v1.json`, examples, published types | T09 |
| [T17](T17-security-hardening.md) | HTTPS/HSTS, headers, strict JSON, secret hygiene | T15 |
| [T18](T18-test-suite.md) | Unit, integration, contract, load smoke | T13–T17 |
| [T19](T19-deployment-and-release.md) | Container, config, migrations at deploy, runbook | T18 |

## Suggested sequencing

```
M0: T00 → T01 → T02 → T03
M1: T04 → T05 ─┐
         T06 → T12 → T07
M2: T08 → T09 → T10 → T16
M3: T11
M4: T13 → T14, T15
M5: T17 → T18 → T19
```

T05 and T06 can run in parallel once T04 lands. T16 can start as soon as the management routes exist (publish incrementally). T18 tests are written alongside each task, not only at the end.

## Conventions for every task

1. **Read the referenced spec sections before coding.** Do not re-invent numbers; they live in configuration per spec §11.1.
2. **No hard-coded limits.** Every value in `/meta` comes from `IOptions<MockApiOptions>` bound from configuration.
3. **Strict binding.** Unknown JSON properties → `400 validation_failed` (spec §3).
4. **UTC everywhere.** `DateTimeOffset` in code, `timestamptz` in DB, `Z` suffix in JSON.
5. **Camel case** in API JSON, `snake_case` in the DB (spec §3).
6. **No secrets in logs.** `Authorization` is always redacted.
7. **Tests ship with the task.** A task is not done with failing or missing tests for its own acceptance criteria.

## Definition of done (applies to every task)

- [ ] Code merged behind the stated task scope, no unrelated refactors.
- [ ] `dotnet build` and `dotnet test` pass locally.
- [ ] Unit tests cover the happy path and each documented error path.
- [ ] Integration test (if the task touches HTTP or DB) exercises the real pipeline.
- [ ] Public surface appears in `/openapi/v1.json` with request/response examples.
- [ ] Structured logs exist for failures and contain `X-Request-Id` / `traceId`.
- [ ] No new warning-as-error violations; analyzers clean.
- [ ] Task file checkboxes updated in the PR.

## Open questions / spec gaps (resolve before the affected task)

The spec references documents that are not in `mockapi-technical-spec.md`. Track them here and in the backlog; do not guess silently.

| Gap | Affects | Proposed resolution |
|---|---|---|
| **Appendix B** (error code catalog) is referenced but missing | T02, T11, T13 | Build the catalog from the codes already named in the spec; add `errors/` docs and keep `code` stable |
| **Section 12** (background jobs) is referenced (§12.6 cleanup) but missing | T14 | Implement from §4, §11.1, §9.1; confirm cadence with product |
| **Section 13** (frontend/UI) missing, including §13.5 token notice | T08, T09 | Backend only ensures `editToken` is returned once and never retrievable; UI copy is frontend's job |
| `pagination.bindings` values are described as JSON Pointers to leaves, but the preview example shows string bindings | T12 | Treat bindings as JSON Pointers per §8.2; validate their target type |
| `settings.list.path` interaction with `wrapInList` when root is already an array | T05, T12 | Root array ignores `wrapInList`; document in tests |
| `successStatus` for `DELETE` default is `204` but users may set `200` | T12 | Allow any of `200/201/202/204`; body generated only for non-`204` |
| Multi-instance deployment (Q13) | T15, T19 | Ship single instance; document Redis migration path |

## Repository layout target

```
src/
  MockApi.Api/            # Program.cs, endpoints, filters, middleware
  MockApi.Core/           # schema model, inference, generation, validation
  MockApi.Data/           # EF Core context, entities, migrations
  MockApi.Workers/        # log writer, usage flush, cleanup
tests/
  MockApi.UnitTests/
  MockApi.IntegrationTests/
  MockApi.ContractTests/
```
