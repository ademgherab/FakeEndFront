---
id: "WIZ-10"
title: "Wizard step 4 — preview"
milestone: "M1 — Create flow"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["WIZ-09","FND-12"]
spec_refs: ["§10.3.3","§8.4"]
---

# WIZ-10 · Wizard step 4 — preview

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | L |
| Depends on | WIZ-09, FND-12 |
| Spec | §10.3.3, §8.4 |

## Context

Preview is the last chance to catch an unusable schema before creating a project. It runs the real generator without delay, errors or storage.

## Scope

- Debounced `POST /preview` (400 ms) with schema, settings, page and limit.
- Pretty JSON with copy, regenerate and raw toggle.
- Page/limit controls only when pagination is enabled.
- Seed-determinism hint and response size.
- Error handling for `400`, `422 response_too_large`, `413` and `429`.

## Acceptance criteria

- [ ] Preview refreshes within ~1 s of the last edit.
- [ ] An in-flight request is aborted when settings change.
- [ ] `422 response_too_large` highlights list size / max limit and suggests a fix.
- [ ] The same seed produces identical output across regenerations.
- [ ] An invalid schema never triggers a preview request.
- [ ] A failed last preview warns before project creation but can be overridden.

## Implementation notes

- Preview is optional to proceed, but a hard failure should not be silent.
- Cache by schema+settings+seed hash to avoid redundant calls.

## Testing

- MSW tests for success, pagination on/off, 422 and abort.
- Manual seed test: same seed twice yields byte-identical JSON.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
