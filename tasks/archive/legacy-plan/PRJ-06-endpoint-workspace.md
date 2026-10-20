---
id: "PRJ-06"
title: "Endpoint workspace and tabs"
milestone: "M2 — Project workspace"
priority: "P0"
size: "M"
status: "todo"
owner: ""
depends_on: ["PRJ-02"]
spec_refs: ["§10.5","§10.3.9"]
---

# PRJ-06 · Endpoint workspace and tabs

| Field | Value |
|---|---|
| Milestone | M2 — Project workspace |
| Priority | P0 |
| Size | M |
| Depends on | PRJ-02 |
| Spec | §10.5, §10.3.9 |

## Context

Each endpoint needs one place for its schema, settings, live testing and logs. Tabs keep that surface navigable.

## Scope

- Header with method, path, URL copy and status.
- Tabs: Schema, Settings, Try it, Logs.
- Dirty indicator with Save and Revert.
- Tab state in `?tab=` for deep links; guard unsaved changes.

## Acceptance criteria

- [ ] Every tab is reachable by URL and by keyboard.
- [ ] The header stays visible while switching tabs.
- [ ] Save is disabled when nothing is dirty; Revert restores the last saved state.
- [ ] Navigating away with unsaved changes prompts.
- [ ] The Logs tab is filtered to this endpoint by default.

## Implementation notes

- Keep schema and settings drafts local to the endpoint page, not the global wizard store.
- Do not unmount editors on tab change; keep state or persist it in the URL/local store.

## Testing

- Component test for tab routing and dirty state.
- Manual: edit, switch tabs, come back, confirm nothing is lost.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
