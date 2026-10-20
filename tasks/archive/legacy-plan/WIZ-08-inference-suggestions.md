---
id: "WIZ-08"
title: "Apply inference suggestions"
milestone: "M1 — Create flow"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-06"]
spec_refs: ["§6.2 step 7","§8.2"]
---

# WIZ-08 · Apply inference suggestions

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P1 |
| Size | M |
| Depends on | WIZ-06 |
| Spec | §6.2 step 7, §8.2 |

## Context

Inference detects the list array and pagination envelope. Surfacing that saves users from configuring JSON Pointers by hand.

## Scope

- Banner listing detected `suggestions.list.path` and pagination bindings.
- One-click apply for the list path and for the full binding set.
- Explain what each suggestion does; allow dismissal.
- Recompute only after a new infer call.

## Acceptance criteria

- [ ] Only pointers that resolve to compatible nodes are offered.
- [ ] Applying the list path updates `settings.list.path` and refreshes the preview.
- [ ] Applying bindings sets page/limit/total/totalPages/hasNext/hasPrev only when compatible.
- [ ] Suggestions do not overwrite existing user edits without confirmation.
- [ ] Dismissal persists for the current draft.

## Implementation notes

- Suggestions are returned by infer and never stored server-side.
- Validate pointers against the current schema, not the original sample.

## Testing

- Fixture: `{ data: [...], meta: { page, limit, total } }` yields the expected suggestions.
- Apply, dismiss and conflict cases.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
