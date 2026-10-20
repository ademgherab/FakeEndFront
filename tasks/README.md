# MockAPI — Frontend Sprint Tasks

**7 tasks** · P0: 6 · P2: 1 · 90-minute single-page sprint.

Source of truth: [`../frontend-spec.md`](../frontend-spec.md) ·
Plan: [`../frontend-tasks.md`](../frontend-tasks.md).

The previous 61-task multi-page plan is archived at
[`archive/legacy-plan/`](./archive/legacy-plan/). Do not execute it.

## How to use

1. Read `frontend-spec.md` and `frontend-tasks.md` first.
2. Pick the next task in the critical path:
   `SPR-01 → SPR-02/SPR-03 → SPR-04 → SPR-05 → SPR-06`.
3. Move the task's `status` through `todo → in_progress → review → done`.
4. Tick acceptance criteria only after testing against the **real backend** at
   `http://localhost:5031`.
5. If a backend assumption in `frontend-spec.md` §11 is false, stop and align before coding.

## Tasks

| ID | Task | Priority | Size | Depends on | Slot |
|---|---|---|---|---|---|
| [SPR-01](./SPR-01-contract-cleanup-scaffold.md) | Contract check, cleanup, scaffold, env, types, API client | P0 | 10 min | — | 0–10 |
| [SPR-02](./SPR-02-sample-input-and-infer.md) | JSON sample input and infer | P0 | 15 min | SPR-01 | 10–25 |
| [SPR-03](./SPR-03-settings-form.md) | Endpoint settings form | P0 | 20 min | SPR-01 | 25–45 |
| [SPR-04](./SPR-04-create-and-result.md) | Create mock, result panel and copy | P0 | 20 min | SPR-02, SPR-03 | 45–65 |
| [SPR-05](./SPR-05-test-panel.md) | Test panel, headers and injected-error badge | P0 | 15 min | SPR-04 | 65–80 |
| [SPR-06](./SPR-06-polish-build-smoke.md) | States, accessibility, responsive, build and smoke | P0 | 10 min | SPR-02…05 | 80–90 |
| [SPR-07](./SPR-07-optional-preview.md) | Optional preview panel | P2 | 10 min | SPR-03 | cut first |

## Parallel work

- **SPR-01 runs alone.** It owns the package manager, lockfile, `app/layout.tsx`,
  `app/page.tsx`, `lib/*` and removal of legacy routes.
- After SPR-01, **SPR-02 and SPR-03** can run in parallel.
- SPR-04 merges them; SPR-05 follows; SPR-06 is the final gate.
- SPR-07 is optional and only if someone is idle.

## Current repository note

The repo may still contain legacy code from the old plan (landing page, `/new`, `/help`,
meta provider, token store, wizard store, logs, schema editor). SPR-01 removes or stops
using anything outside the sprint scope. Keep reusable Tailwind/shadcn primitives only.

## Definition of Done

Every task must satisfy the global DoD in
[`../frontend-tasks.md`](../frontend-tasks.md#8-definition-of-done-every-task).
