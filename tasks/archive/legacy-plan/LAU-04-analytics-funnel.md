---
id: "LAU-04"
title: "Analytics funnel (optional)"
milestone: "M5 — Launch"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: ["LAU-01"]
spec_refs: ["§11.3"]
---

# LAU-04 · Analytics funnel (optional)

| Field | Value |
|---|---|
| Milestone | M5 — Launch |
| Priority | P2 |
| Size | S |
| Depends on | LAU-01 |
| Spec | §11.3 |

## Context

Understanding where users drop off is useful, but only if it cannot leak project content.

## Scope

- Events: landing_view, infer_success, infer_error, project_created, url_copied, tryit_sent, logs_opened.
- No tokens, samples, URLs or request bodies.
- Consent decision documented.

## Acceptance criteria

- [ ] Events fire once per action and carry only route/status metadata.
- [ ] Payload inspection shows no token, slug or sample content.
- [ ] Analytics failure never blocks the UI.

## Implementation notes

- If in doubt, skip analytics for the hackathon; correctness first.

## Testing

- Network panel inspection during a full flow.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
