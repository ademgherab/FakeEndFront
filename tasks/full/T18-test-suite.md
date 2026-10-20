# T18 — Test suite and quality gates

- **Milestone:** M5
- **Depends on:** T13–T17
- **Spec refs:** all; especially §7.3, §9, §10

## Goal

A test suite that proves the spec's contracts, not just the code's current behavior, and that runs in CI on every PR.

## Scope

- Unit tests (Core: inference, generation, validation, pagination math).
- Integration tests (HTTP + PostgreSQL, all error paths).
- Contract tests (OpenAPI vs implementation).
- Determinism, security-regression, and load smoke tests.
- CI pipeline: build, test, coverage, lint/analyzers.

## Implementation checklist

- [ ] Unit test project with no DB/network; fast (<30 s full run).
- [ ] Integration tests use Testcontainers PostgreSQL (or a disposable local instance) and real `WebApplicationFactory` pipelines.
- [ ] Contract tests enumerate implemented routes/status codes and compare with `/openapi/v1.json`.
- [ ] Golden tests: §5.2 inference output, seeded generation page 1/2, pagination headers.
- [ ] Error-path coverage for every code in T02, both surfaces.
- [ ] Auth matrix tests (404/401/403/410 order).
- [ ] Runtime pipeline tests: steps 1–5 not logged, 6–10 logged; preflight exempt.
- [ ] Determinism test across app restarts.
- [ ] Privacy tests: sample never persisted/logged; token never logged; IP never stored.
- [ ] Security tests: CORS, strict JSON, body limits, `nosniff`, no SSRF.
- [ ] Load smoke: e.g. 50 concurrent runtime calls for 30 s with a p95 target documented; no DB reads on the hot path.
- [ ] Coverage gate on `MockApi.Core` (propose ≥ 85%) with exclusions justified.
- [ ] CI: `dotnet build -warnaserror`, `dotnet test`, OpenAPI generation check, Docker build.
- [ ] Test data builders/factories to keep tests readable; no shared mutable fixtures.
- [ ] Flaky-test policy: quarantine and fix, never retry-to-green.

## Acceptance criteria

- [ ] A clean clone runs the full suite with one documented command.
- [ ] Unit suite has no external dependencies.
- [ ] Integration tests fail when a documented behavior is broken (verify with a mutation spot-check).
- [ ] CI blocks merge on test, build, contract, or coverage failure.
- [ ] No test depends on execution order or the system clock without `TimeProvider`.
- [ ] Load smoke produces a report with p50/p95/p99 and error rate.

## Tests (meta)

- Reviewed by another developer: each spec section maps to at least one test.
- Seed fixtures are deterministic; no live internet.

## Notes

- Keep the integration suite focused on contracts; push edge-case volume into unit tests.
- Use `TimeProvider` everywhere time matters (expiry, quota rollover, seed reference).
