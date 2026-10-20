---
id: "RUN-02"
title: "cURL and fetch snippet generator"
milestone: "M3 — Try it and logs"
priority: "P1"
size: "S"
status: "todo"
owner: ""
depends_on: ["RUN-01"]
spec_refs: ["§9.1"]
---

# RUN-02 · cURL and fetch snippet generator

| Field | Value |
|---|---|
| Milestone | M3 — Try it and logs |
| Priority | P1 |
| Size | S |
| Depends on | RUN-01 |
| Spec | §9.1 |

## Context

Users want to move from the browser to their own app. A correct snippet is the shortest path.

## Scope

- Generate `curl`, `fetch` and `axios` snippets from the current request.
- Include method, headers and body where applicable.
- Copy per snippet and warn about unfilled `{param}` placeholders.

## Acceptance criteria

- [ ] Snippets are valid shell/JS for GET, POST, PUT and DELETE.
- [ ] No token or secret is included.
- [ ] Placeholders are obvious and the copy action warns when they remain.
- [ ] Body is pretty-printed without breaking quoting.

## Implementation notes

- Escape single quotes for cURL correctly; test with a body containing quotes.

## Testing

- Snapshot tests for each method and a body with quotes/newlines.

## Definition of done

- [ ] Acceptance criteria verified against the real API or the OpenAPI-contract mock
- [ ] Lint, typecheck and production build pass
- [ ] Loading, empty, error and success states handled where the task renders UI
- [ ] Works at 360 px and by keyboard where the task renders UI
- [ ] No hard-coded limits or generator lists; values come from `/api/v1/meta`
- [ ] No token, sample content or request body written to console, analytics or error reports

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
