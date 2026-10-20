---
id: "WIZ-14"
title: "Post-create onboarding checklist"
milestone: "M1 — Create flow"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: ["PRJ-02"]
spec_refs: ["§1.1"]
---

# WIZ-14 · Post-create onboarding checklist

| Field | Value |
|---|---|
| Milestone | M1 — Create flow |
| Priority | P2 |
| Size | S |
| Depends on | PRJ-02 |
| Spec | §1.1 |

## Context

New users often do not know what to do with the URL. A short checklist drives the first successful call and the first log entry.

## Scope

- Three items: test the URL, trigger an error response, open the logs.
- Deep links to the Try-it tab with prefilled settings.
- Dismiss or complete state persisted per slug.

## Acceptance criteria

- [ ] Checklist appears only on projects created in this browser and can be dismissed.
- [ ] Each item links to the correct tab.
- [ ] Completion is reflected without a page reload.
- [ ] Dismissal persists across visits.

## Implementation notes

- Keep it to three items; do not turn this into a product tour.

## Testing

- Manual first-run flow and persistence after reload.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
