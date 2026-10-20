---
id: "WIZ-09"
title: "Wizard step 3 — endpoint settings"
milestone: "M1 — Create flow"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["WIZ-06","FND-05"]
spec_refs: ["§8.1","§8.2","§8.3"]
---

# WIZ-09 · Wizard step 3 — endpoint settings

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | L |
| Depends on | WIZ-06, FND-05 |
| Spec | §8.1, §8.2, §8.3 |

## Context

Settings control status, delay, random errors, list size, pagination and determinism. Defaults come from the spec; bounds come from meta.

## Scope

- Sections: Response, Delay, Errors, List, Pagination, Seed.
- Meta-driven success statuses, delay max, list size max, pagination limits and error-status range.
- Conditional UI: `204` means no body, error codes required only when rate > 0, list size ignored when pagination is on.
- JSON Pointer pickers for list path and pagination bindings (compatible leaves only).
- Reset to defaults and inline validation.

## Acceptance criteria

- [ ] Defaults match the spec per method (GET 200, POST 201, PUT 200, DELETE 204; delay 0/0; errors 0%/[500]; list 10/10).
- [ ] Selecting 204 hides body-related hints and explains that no body is returned.
- [ ] A rate > 0 with no codes blocks submit; duplicate/out-of-range codes are rejected.
- [ ] Pagination cannot be enabled without a usable list (root array or `list.path`).
- [ ] Binding pickers offer only integer/boolean leaves of the root object.
- [ ] Reset restores defaults without touching the schema.

## Implementation notes

- Build the request payload explicitly; never spread form state (the server rejects unknown properties).
- Show a worst-case value estimate (leaves × max list × nested max) near the 100,000 limit.
- Display milliseconds and percentages with units, but serialize raw numbers/fractions.

## Testing

- Unit tests for defaults, cross-field rules and payload mapping.
- MSW test that `422 response_too_large` highlights the estimate.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
