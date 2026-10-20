# T19 — Deployment, operations, and release

- **Milestone:** M5
- **Depends on:** T18
- **Spec refs:** §0.2 (Q13), §2.1, §10.1 (#16), §11.2, §11.3

## Goal

Ship a single-instance container with managed PostgreSQL, safe migrations, health-based rollout, and a runbook.

## Scope

- Dockerfile (multi-stage, non-root, no secrets).
- Environment/configuration reference for all `MockApiOptions` values.
- Migration strategy at deploy time.
- Health probes, logging, rollout/rollback, and ops runbook.
- Explicit single-instance constraints.

## Implementation checklist

- [ ] Multi-stage build (SDK → runtime), `linux-x64` or `linux-arm64` as needed, non-root user, read-only filesystem where possible.
- [ ] Image exposes the HTTP port; no dev secrets; `ASPNETCORE_ENVIRONMENT=Production`.
- [ ] Configuration reference documents every env var: connection string, `MockBaseUrl`, CORS origins, known proxies, every limit, worker toggles/cadence.
- [ ] Startup fails fast on invalid config (T00).
- [ ] Migrations: run as a separate step/job (`dotnet ef database update` or a migration bundle), not concurrently from every replica; document ordering.
- [ ] Health probes wired: liveness `/health/live`, readiness `/health/ready` (DB).
- [ ] Graceful shutdown: stop accepting, drain in-flight mock requests, flush log/usage queues (T13), stop workers (T14).
- [ ] Logs go to stdout as JSON; no file logging inside the container.
- [ ] Reverse proxy: TLS termination, forwarded headers configured (T15), request body limits aligned with the app.
- [ ] Single instance enforced/documented; autoscaling beyond one replica is blocked until Redis is added for rate limits/cache.
- [ ] Rollback plan: previous image + backward-compatible migrations; never drop columns in the same release as code removal.
- [ ] Runbook: how to check health, find logs by `X-Request-Id`, verify quota/rate limits, purge a project, rotate DB credentials, respond to DB outage.
- [ ] Post-deploy smoke script: `/meta`, create a project, call the mock, read logs, delete the project.

## Acceptance criteria

- [ ] `docker build` + `docker run` with a local PostgreSQL serves `/health/ready` `200`.
- [ ] Deploying with a pending migration applies it exactly once.
- [ ] Killing the container during traffic loses no acknowledged usage counter beyond the documented flush window.
- [ ] A rollback to the previous image works without a data migration.
- [ ] The runbook lets a second engineer perform health triage without asking questions.
- [ ] CDN/proxy `X-Forwarded-For` handling is verified end-to-end.

## Tests

- Container smoke test in CI.
- Migration bundle test on an empty DB and on a DB at the previous version.
- Graceful-shutdown integration test.

## Notes

- Hosting is unspecified beyond "single instance + managed PostgreSQL"; fill in the actual provider in the runbook.
- If multi-instance is ever required: add Redis for rate limiting and cache invalidation, then revisit Q13 and the limiter policies in T15.
