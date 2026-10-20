---
id: "WIZ-03"
title: "Wizard step 1 — infer integration"
milestone: "M1 — Create flow"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-02","FND-06"]
spec_refs: ["§6.5","§10.3.2"]
---

# WIZ-03 · Wizard step 1 — infer integration

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | M |
| Depends on | WIZ-02, FND-06 |
| Spec | §6.5, §10.3.2 |

## Context

The infer endpoint returns the schema, warnings and suggestions. It stores nothing, so retries are safe.

## Scope

- Call `POST /infer` with the sample and `options.wrapInList`.
- Show a skeleton/progress state while waiting; abort stale requests.
- Store schema, warnings and suggestions in the draft, then advance to step 2.
- Map `400 validation_failed`, `422 sample_invalid`, `422 sample_too_complex`, `413` and `429` to field-level or banner errors.

## Acceptance criteria

- [ ] A successful infer advances to schema review with the returned schema.
- [ ] Each documented error is rendered with an actionable message and the user stays on step 1.
- [ ] A second click while a request is in flight does not fire a duplicate request.
- [ ] Warnings survive navigation to step 2 and back.
- [ ] Network failures offer retry without losing the sample.

## Implementation notes

- Infer is explicit (button), not debounced automatically.
- Never log or persist the sample itself.

## Testing

- MSW tests for success and each error code.
- Abort test: change the sample mid-flight and confirm the response is ignored.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
