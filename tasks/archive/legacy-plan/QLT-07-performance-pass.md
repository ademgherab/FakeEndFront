---
id: "QLT-07"
title: "Performance pass"
milestone: "M4 — Quality"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["WIZ-05"]
spec_refs: ["§5.1","§7.5"]
---

# QLT-07 · Performance pass

| Field | Value |
|---|---|
| Milestone | M4 — Quality |
| Priority | P1 |
| Size | M |
| Depends on | WIZ-05 |
| Spec | §5.1, §7.5 |

## Context

The editor and large JSON payloads can dominate the bundle and the main thread if loaded eagerly.

## Scope

- Lazy-load CodeMirror and heavy viewers.
- Route-level splitting; avoid importing the editor on the landing page.
- Measure the 2,000-node tree and a 5,000-line preview.
- Check the landing LCP on a throttled profile.

## Acceptance criteria

- [ ] Landing page JS does not include the code editor chunk.
- [ ] No interaction blocks the main thread for more than 200 ms in the audited flows.
- [ ] Preview renders 5,000 lines without freezing the tab.
- [ ] Lighthouse performance ≥ 80 on the landing page preview.

## Implementation notes

- Measure before optimizing; record numbers in the PR description.

## Testing

- `next build` bundle report; Lighthouse; React Profiler on the tree.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
