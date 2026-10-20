# MockAPI — Frontend Tasks (one file per task)

Generated from [`frontend-tasks.md`](../frontend-tasks.md) and `mockapi-technical-spec.md`.
Each task is a standalone Markdown file with YAML frontmatter, scope, acceptance criteria,
implementation notes and a test plan.

**61 tasks** · P0 38 · P1 17 · P2 6 · M0: 12 · M1: 14 · M2: 10 · M3: 8 · M4: 12 · M5: 5

## How to use

1. Pick a task from your milestone.
2. Move its `status` in the frontmatter through `todo → in_progress → review → done`.
3. Tick the acceptance criteria as they pass; do not tick them against a mock only.
4. Keep `depends_on` respected — the critical path is FND → WIZ → PRJ → RUN.
5. If the backend contract changes, update the affected files and the master plan together.

**Priorities:** P0 = demo/Phase 1 must-have · P1 = Phase 2 complete · P2 = polish if time remains.

## M0 — Foundations

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [FND-01](./FND-01-scaffold-nextjs-app.md) | Scaffold the Next.js app | P0 | S | — |
| [FND-02](./FND-02-environment-config.md) | Environment and config module | P0 | S | FND-01 |
| [FND-03](./FND-03-api-client.md) | Typed API client and error normalisation | P0 | M | FND-02 |
| [FND-04](./FND-04-openapi-types.md) | Generate TypeScript types from OpenAPI | P0 | M | FND-03 |
| [FND-05](./FND-05-meta-provider.md) | Meta provider and limits hook | P0 | M | FND-03 |
| [FND-06](./FND-06-error-presentation.md) | Error normalisation, boundaries and messages | P0 | M | FND-03 |
| [FND-07](./FND-07-app-shell.md) | Application shell and navigation | P0 | M | FND-01 |
| [FND-08](./FND-08-token-storage.md) | Edit-token storage service | P0 | S | FND-01 |
| [FND-09](./FND-09-wizard-draft-store.md) | Wizard draft store | P0 | M | FND-01 |
| [FND-10](./FND-10-msw-contract-mocks.md) | MSW contract mocks | P1 | L | FND-03, FND-04 |
| [FND-11](./FND-11-tooling-and-ci.md) | Tooling, tests and CI | P0 | M | FND-01 |
| [FND-12](./FND-12-shared-primitives.md) | Shared UI primitives | P0 | M | FND-01 |

## M1 — Create flow

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [WIZ-01](./WIZ-01-landing-page.md) | Landing page | P0 | M | FND-07 |
| [WIZ-02](./WIZ-02-sample-step.md) | Wizard step 1 — sample and endpoint basics | P0 | L | FND-05, FND-09, FND-12 |
| [WIZ-03](./WIZ-03-infer-integration.md) | Wizard step 1 — infer integration | P0 | M | WIZ-02, FND-06 |
| [WIZ-04](./WIZ-04-wizard-shell.md) | Wizard shell and state machine | P0 | M | FND-09 |
| [WIZ-05](./WIZ-05-schema-tree-viewer.md) | Schema tree viewer | P0 | L | FND-12 |
| [WIZ-06](./WIZ-06-schema-editor-basics.md) | Schema editor — basics | P0 | XL | WIZ-05 |
| [WIZ-07](./WIZ-07-schema-editor-advanced.md) | Schema editor — advanced mode | P1 | XL | WIZ-06 |
| [WIZ-08](./WIZ-08-inference-suggestions.md) | Apply inference suggestions | P1 | M | WIZ-06 |
| [WIZ-09](./WIZ-09-settings-editor.md) | Wizard step 3 — endpoint settings | P0 | L | WIZ-06, FND-05 |
| [WIZ-10](./WIZ-10-preview-step.md) | Wizard step 4 — preview | P0 | L | WIZ-09, FND-12 |
| [WIZ-11](./WIZ-11-multi-endpoint-builder.md) | Multi-endpoint builder (Phase 2) | P1 | L | WIZ-09 |
| [WIZ-12](./WIZ-12-create-project.md) | Create project | P0 | M | WIZ-09, FND-03 |
| [WIZ-13](./WIZ-13-create-success-token.md) | Create-success screen and one-time token | P0 | L | WIZ-12, FND-08, FND-12 |
| [WIZ-14](./WIZ-14-post-create-checklist.md) | Post-create onboarding checklist | P2 | S | PRJ-02 |

## M2 — Project workspace

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [PRJ-01](./PRJ-01-token-gate-layout.md) | Project token gate and workspace layout | P0 | M | FND-08, FND-06 |
| [PRJ-02](./PRJ-02-project-overview.md) | Project overview | P0 | L | PRJ-01, FND-12 |
| [PRJ-03](./PRJ-03-expiry-ux.md) | Expiry and grace-period UX | P0 | M | PRJ-02 |
| [PRJ-04](./PRJ-04-rename-project.md) | Rename project | P1 | S | PRJ-02 |
| [PRJ-05](./PRJ-05-add-endpoint.md) | Add endpoint to an existing project | P0 | L | PRJ-02, WIZ-06, WIZ-09 |
| [PRJ-06](./PRJ-06-endpoint-workspace.md) | Endpoint workspace and tabs | P0 | M | PRJ-02 |
| [PRJ-07](./PRJ-07-save-semantics.md) | Endpoint save semantics | P0 | L | PRJ-06 |
| [PRJ-08](./PRJ-08-delete-endpoint.md) | Delete endpoint | P1 | S | PRJ-06 |
| [PRJ-09](./PRJ-09-project-settings-danger.md) | Project settings and danger zone | P1 | M | PRJ-01 |
| [PRJ-10](./PRJ-10-recent-projects-restore.md) | Recent projects and restore access | P1 | M | PRJ-01 |

## M3 — Try it and logs

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [RUN-01](./RUN-01-try-it-console.md) | Try-it console | P0 | L | PRJ-06, FND-12 |
| [RUN-02](./RUN-02-request-snippets.md) | cURL and fetch snippet generator | P1 | S | RUN-01 |
| [RUN-03](./RUN-03-log-table.md) | Request log table | P0 | L | PRJ-06, FND-12 |
| [RUN-04](./RUN-04-logs-live-polling.md) | Live log polling | P0 | L | RUN-03 |
| [RUN-05](./RUN-05-log-filters.md) | Log filters and URL state | P1 | M | RUN-03 |
| [RUN-06](./RUN-06-log-detail.md) | Log entry detail | P1 | M | RUN-03 |
| [RUN-07](./RUN-07-clear-logs.md) | Clear request logs | P2 | S | RUN-03 |
| [RUN-08](./RUN-08-quota-rate-limit-ux.md) | Quota and rate-limit UX | P1 | S | RUN-01, PRJ-02 |

## M4 — Quality

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [QLT-01](./QLT-01-validation-schemas.md) | Shared validation schemas | P0 | L | FND-03 |
| [QLT-02](./QLT-02-unit-tests-core-logic.md) | Unit tests for core logic | P0 | L | WIZ-06 |
| [QLT-03](./QLT-03-integration-tests-msw.md) | Integration tests with MSW | P1 | L | FND-10 |
| [QLT-04](./QLT-04-e2e-happy-path.md) | End-to-end happy path | P0 | L | FND-11 |
| [QLT-05](./QLT-05-accessibility-pass.md) | Accessibility pass | P1 | M | WIZ-06 |
| [QLT-06](./QLT-06-responsive-pass.md) | Responsive and mobile pass | P1 | M | PRJ-02 |
| [QLT-07](./QLT-07-performance-pass.md) | Performance pass | P1 | M | WIZ-05 |
| [QLT-08](./QLT-08-seo-metadata.md) | SEO and metadata | P2 | S | — |
| [QLT-09](./QLT-09-security-review.md) | Frontend security review | P0 | S | FND-08 |
| [QLT-10](./QLT-10-docs-runbook.md) | Documentation and runbook | P1 | M | — |
| [QLT-11](./QLT-11-observability.md) | Error observability | P2 | S | FND-06 |
| [QLT-12](./QLT-12-demo-readiness.md) | Demo readiness and fixtures | P0 | M | WIZ-13, RUN-04 |

## M5 — Launch

| ID | Task | Priority | Size | Depends on |
|---|---|---|---|---|
| [LAU-01](./LAU-01-production-deploy.md) | Production deployment | P0 | M | FND-02, FND-11 |
| [LAU-02](./LAU-02-cross-browser-smoke.md) | Cross-browser smoke test | P0 | S | LAU-01 |
| [LAU-03](./LAU-03-qa-regression.md) | QA regression checklist | P0 | M | LAU-01 |
| [LAU-04](./LAU-04-analytics-funnel.md) | Analytics funnel (optional) | P2 | S | LAU-01 |
| [LAU-05](./LAU-05-monitoring-feedback.md) | Monitoring and feedback loop | P2 | S | LAU-01 |
