---
id: "WIZ-04"
title: "Wizard shell and state machine"
milestone: "M1 — Create flow"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["FND-09"]
spec_refs: ["§5","§8"]
---

# WIZ-04 · Wizard shell and state machine

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P0 |
| Size | M |
| Depends on | FND-09 |
| Spec | §5, §8 |

## Context

Four steps with different validity rules need one predictable frame: progress, back/next, restore and guards.

## Scope

- Step definitions with labels and completion rules.
- Progress indicator, back/next, and a per-step validation gate.
- Refresh restores the current step from the draft.
- Start over with confirmation; guard navigation when work would be lost.

## Acceptance criteria

- [ ] A user cannot advance past an invalid step by clicking or by editing the URL.
- [ ] Back preserves all data in later steps.
- [ ] Refresh restores the step and its content.
- [ ] Start over clears the draft and returns to step 1.
- [ ] `beforeunload` fires only when there are unsaved edits.

## Implementation notes

- Model steps as a discriminated union so impossible states do not compile.
- Use the router for step changes so the back button behaves naturally.

## Testing

- Component tests for gating and restore.
- Manual back/forward and refresh at each step.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
