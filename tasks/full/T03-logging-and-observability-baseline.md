# T03 — Logging, correlation, health probes

- **Milestone:** M0
- **Depends on:** T00
- **Spec refs:** §2.1, §3, §10.1 (#16), §11.3

## Goal

Operable-by-default service: structured logs with correlation, secret redaction, and liveness/readiness probes.

## Scope

- Serilog (or `Microsoft.Extensions.Logging` JSON console) with request logging.
- `X-Request-Id` propagation into log scopes.
- Redaction policy for `Authorization` and any token field.
- `/health/live` and `/health/ready`.

## Implementation checklist

- [ ] JSON console sink in production; readable console in development.
- [ ] Enrich each log with `RequestId`, `TraceId`, `Method`, `Path`, `StatusCode`, `ElapsedMs`.
- [ ] Destructure/drop `Authorization`; guarantee no `editToken` appears in logs (add a unit test with a canary token).
- [ ] `/health/live`: always `200` when the process is up, no DB dependency.
- [ ] `/health/ready`: `200` when PostgreSQL responds; `503` when it does not. Tag with `ready`; do not expose connection strings.
- [ ] Health endpoints are outside `/api/v1` and are not rate limited.
- [ ] Do not log request bodies on the Management API (samples must never be persisted or logged, §5.4).
- [ ] Avoid logging the runtime request body during normal success; the log writer owns the truncated copy.

## Acceptance criteria

- [ ] Killing PostgreSQL flips readiness to `503` within the configured probe timeout and recovers automatically.
- [ ] A request with a bearer token produces zero log lines containing the token value.
- [ ] Logs from a single request can be grepped by `X-Request-Id`.
- [ ] No PII/sample data from `/infer` appears in logs.

## Tests

- Integration test for readiness with DB up/down.
- Log-redaction unit test using an in-memory sink.

## Out of scope

Metrics dashboards, tracing exporters, alerting (candidate follow-up).
