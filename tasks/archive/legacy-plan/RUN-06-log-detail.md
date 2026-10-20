---
id: "RUN-06"
title: "Log entry detail"
milestone: "M3 — Try it and logs"
priority: "P1"
size: "M"
status: "todo"
owner: ""
depends_on: ["RUN-03"]
spec_refs: ["§10.3.14","§9.3"]
---

# RUN-06 · Log entry detail

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P1 |
| Size | M |
| Depends on | RUN-03 |
| Spec | §10.3.14, §9.3 |

## Context

The table gives the shape; the detail view gives the evidence: request id, body, user agent and headers-related values.

## Scope

- Drawer/dialog with all fields, formatted request body and truncation indicator.
- Copy request id and a replayable cURL.
- Replay in Try-it with method, path and query prefilled.
- Link to the endpoint.

## Acceptance criteria

- [ ] All response fields are shown, including `null` ones with an explicit 'not set'.
- [ ] Truncated bodies are labelled; the byte limit is not misrepresented as the full body.
- [ ] Replay opens Try-it with the same method/path/query but does not auto-send.
- [ ] Escape and overlay close the drawer; focus returns to the row.
- [ ] Sensitive-content warning is visible near the body.

## Implementation notes

- Do not fetch anything new for the detail; the list response already contains the fields.
- Pretty-print JSON bodies only when they parse.

## Testing

- Component tests for JSON and non-JSON bodies, null fields and replay prefill.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
