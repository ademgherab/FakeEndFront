---
id: "QLT-04"
title: "End-to-end happy path"
milestone: "M4 — Quality"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-11"]
spec_refs: ["§1.1"]
---

# QLT-04 · End-to-end happy path

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P0 |
| Size | L |
| Depends on | FND-11 |
| Spec | §1.1 |

## Context

One E2E test that follows the demo script is the best guard against a broken release.

## Scope

- Paste sample → infer → edit one field → set delay/errors → preview → create.
- Capture the token → open project → run a try-it call → see a log entry.
- Run against MSW in CI; document a manual run against the real API.

## Acceptance criteria

- [ ] The test completes in under 90 s in CI.
- [ ] It fails if the token screen is skipped or the log row never appears.
- [ ] Selectors are stable and accessible.
- [ ] A `pnpm test:e2e:real` mode runs the same flow against a configured backend.

## Implementation notes

- Keep the sample fixture small so inference is fast and stable.
- Do not assert on generated values; assert on shape and status.

## Testing

- Playwright on Chromium in CI; manual cross-browser in LAU-02.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
