---
id: "LAU-05"
title: "Monitoring and feedback loop"
milestone: "M5 — Launch"
priority: "P2"
size: "S"
status: "todo"
owner: ""
depends_on: ["LAU-01"]
spec_refs: ["§3"]
---

# LAU-05 · Monitoring and feedback loop

| Field | Value |
|---|---|
| Milestone | M5 — Launch |
| Priority | P2 |
| Size | S |
| Depends on | LAU-01 |
| Spec | §3 |

## Context

After launch, the fastest signal is whether creates and mock calls still succeed.

## Scope

- Uptime check on `/health/ready`.
- Error-rate alert on the frontend.
- Feedback link with a short form.
- Weekly dependency update review.

## Acceptance criteria

- [ ] An alert fires when the API is unhealthy or the frontend error rate spikes.
- [ ] The feedback link is reachable from the footer.
- [ ] Dependency updates are reviewed, not merged blindly.

## Implementation notes

- Keep alerts to one channel; noisy alerts get ignored.

## Testing

- Simulate a health failure and confirm notification.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
