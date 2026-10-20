---
id: "RUN-04"
title: "Live log polling"
milestone: "M3 — Try it and logs"
priority: "P0"
size: "L"
status: "todo"
owner: ""
depends_on: ["RUN-03"]
spec_refs: ["§0.2 Q10","§10.3.14"]
---

# RUN-04 · Live log polling

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P0 |
| Size | L |
| Depends on | RUN-03 |
| Spec | §0.2 Q10, §10.3.14 |

## Context

Logs must appear within a couple of seconds without a refresh, using cursor polling rather than SSE.

## Scope

- Poll every 2 s with `after=<latestId>`.
- Pause when the tab is hidden, resume immediately on visibility.
- Dedupe by id and highlight new rows.
- Pause/resume control and error backoff (2→4→8 s, cap 30 s).
- Clean up timers and in-flight requests on unmount/tab change.

## Acceptance criteria

- [ ] A new log entry appears within ~2–4 s while the tab is visible.
- [ ] No polling request is made while the tab is hidden.
- [ ] Returning to the tab fetches immediately, not after the next interval.
- [ ] Overlapping requests never happen; a superseded response is discarded.
- [ ] Errors show 'live paused/reconnecting' and recover without reloading the page.
- [ ] Leaving the Logs tab stops polling.

## Implementation notes

- Use a recursive `setTimeout` (not `setInterval`) so slow responses cannot stack.
- Keep the last good `latestId` across errors.
- Prepend without moving the user's scroll position, or show a 'new entries' pill.

## Testing

- Fake-timer unit test for the polling lifecycle and visibility pause.
- MSW test for dedupe and backoff.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
