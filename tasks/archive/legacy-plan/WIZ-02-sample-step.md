---
id: "WIZ-02"
title: "Wizard step 1 — sample and endpoint basics"
milestone: "M1 — Create flow"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["FND-05","FND-09","FND-12"]
spec_refs: ["§6.1","§10.3.2","§10.4"]
---

# WIZ-02 · Wizard step 1 — sample and endpoint basics

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | L |
| Depends on | FND-05, FND-09, FND-12 |
| Spec | §6.1, §10.3.2, §10.4 |

## Context

Collects the JSON sample, method and path. Everything later depends on valid input, so validation must happen before the infer call.

## Scope

- CodeMirror JSON editor with format button and live parse status.
- Byte counter against `limits.maxSampleBytes`; block over the limit.
- Example templates: user list, products, paginated envelope.
- `wrapInList` switch that explains the resulting output shape.
- Method select from `meta.methods` and a path input with inline validation.
- Privacy warning and a disabled Continue button while invalid.

## Acceptance criteria

- [ ] Invalid JSON blocks Continue and shows line/column.
- [ ] Samples over the meta limit block Continue and show current vs allowed size.
- [ ] A scalar or `null` root is detected before calling the API with a clear explanation.
- [ ] Method choices come from meta; path validation matches the server rules (leading `/`, length, segments, templates).
- [ ] `wrapInList` visibly changes the described output.
- [ ] Refreshing restores editor content, method, path and switch state.

## Implementation notes

- Keep the raw text as the source of truth; parse on change with a short debounce.
- Lazy-load CodeMirror so the landing page does not pay for it.
- Do not auto-format while the user types.

## Testing

- Unit tests for byte counting, path validation and scalar detection.
- Manual paste of invalid, scalar, oversized and deeply nested samples.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
