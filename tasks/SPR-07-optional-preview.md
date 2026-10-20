---
id: "SPR-07"
title: "Optional preview panel"
milestone: "Sprint — optional"
priority: "P2"
size: "10 min"
status: "done"
owner: ""
depends_on: ["SPR-03"]
spec_refs: ["§3.2","§8","§9"]
---

# SPR-07 · Optional preview panel

| Field | Value |
|---|---|
| Milestone | Sprint — optional |
| Priority | P2 |
| Size | 10 min |
| Depends on | SPR-03 |
| Spec | §3.2, §8, §9 |

## Context

`POST /api/v1/preview` is explicitly optional. It lets the user see generated data before
creating a project. **Cut this task first** if the core flow is not finished.

## Scope

- Add a **Preview data** button, enabled when a schema exists and settings are valid.
- Call `preview({ schema, settings })` from `lib/api.ts`.
- Render the returned `data` as formatted JSON in a collapsible panel.
- Render `pagination` when present, or hide it when `null`.
- Loading state with `aria-busy`; error banner with `code` + `detail`.
- Previewing must not create a project or change the inferred schema.
- Do not block create/test if preview fails.

## Acceptance criteria

- [x] Preview returns and displays formatted JSON.
- [x] Previewing never creates a project.
- [x] Loading and error states are handled.
- [x] The panel is collapsible and keyboard accessible.
- [x] Core create/copy/test still work when preview is unavailable.

## Implementation notes

- Use the schema from inference and the current settings; do not re-infer.
- Keep the response in component state only.
- If the endpoint is not implemented, hide the button and leave the rest of the sprint
  untouched.
- Do not add pagination UI beyond rendering the returned `pagination` object.

## Testing

- Preview with a valid schema and default settings.
- Preview with a list-size change; confirm the response reflects it.
- Stop the backend; confirm the error is contained to the preview panel.

## Definition of Done

- [x] Acceptance criteria verified against the real backend.
- [x] Core flow is unaffected when preview fails.
- [x] Build and typecheck pass.
- [x] No new persistence or state library.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
