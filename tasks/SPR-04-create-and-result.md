---
id: "SPR-04"
title: "Create mock, result panel and copy"
milestone: "Sprint — 45–65 min"
priority: "P0"
size: "20 min"
status: "todo"
owner: ""
depends_on: ["SPR-02","SPR-03"]
spec_refs: ["§3.3","§4","§6","§9"]
---

# SPR-04 · Create mock, result panel and copy

| Field | Value |
|---|---|
| Milestone | Sprint — 45–65 min |
| Priority | P0 |
| Size | 20 min |
| Depends on | SPR-02, SPR-03 |
| Spec | §3.3, §4, §6, §9 |

## Context

This is the conversion step: one inferred schema plus one valid settings object become one
project with exactly one endpoint. The result panel is the product: a visible base URL and
endpoint URL with copy buttons.

## Scope

### Create

- **Create mock** is enabled only when:
  - state is `inferred`,
  - the sample still matches the sample used for inference,
  - settings `isValid` is true.
- While creating: `aria-busy="true"`, disabled, label "Creating…".
- Prevent double submission; exactly one request per click.
- Call `createProject` with one endpoint:

```json
{
  "name": "Users demo",
  "endpoints": [
    {
      "method": "GET",
      "path": "/users",
      "sample": { "id": 1, "name": "Ahmed Benali" },
      "options": { "wrapInList": true },
      "settings": { "...": "..." }
    }
  ]
}
```

- **Payload rule:** send `sample` **or** `schema`, never both. The default is `sample`.
  Only switch to `schema` if the backend requires it and the sample is unchanged since
  inference. Confirm this in SPR-01; do not guess.
- The UI does not ask for a project name in the sprint. Send `"Users demo"` unless the
  backend makes `name` optional and the team prefers to omit it.

### Result

- On `201`, show the result panel and scroll it into view. Do not open a new tab.
- Show:
  - `baseUrl`
  - the first endpoint's `url`
  - created/expiry timestamps if useful for the demo
  - a small "token returned" note when `editToken` is present
- Copy buttons for both URLs:
  - Use `navigator.clipboard.writeText` with a fallback.
  - Announce **"Copied"** for 2 seconds (`aria-live="polite"`).
  - Never copy or log the edit token.
- Do not store the token, URL or sample in `localStorage`/`sessionStorage`.

### Errors

- `400 validation_failed`: show `code` + `detail`; map `errors` keys to fields when they
  match.
- `409 duplicate_endpoint`: highlight method + path; explain that the normalised route
  already exists.
- `422 response_too_large`: point at list size / nested arrays; suggest a smaller size.
- `429 rate_limited`: show the message; if `Retry-After` is present, disable create until
  it expires.
- Network/CORS failure: `Cannot reach API at {BASE}. Is the backend running?`

## Acceptance criteria

- [ ] Create is disabled until inference succeeds and settings are valid.
- [ ] A valid create returns `201` and shows `baseUrl` and the endpoint URL.
- [ ] Copy works for both URLs and announces "Copied" for 2 seconds.
- [ ] `editToken` is not stored, copied or logged; only a small token-returned note appears.
- [ ] Double-clicking create sends exactly one request.
- [ ] The result panel scrolls into view; no new tab opens.
- [ ] `400`, `409`, `422`, `429` and network errors render actionable messages.
- [ ] Field-level `errors` from the API are shown under the matching field when possible.
- [ ] Re-running the mock test later does not create another project.

## Implementation notes

- Use the `createProject` helper from `lib/api.ts`; do not duplicate fetch logic.
- Keep the created project in component state; it is not persisted.
- The result panel needs the selected method for SPR-05; pass it down or keep it in the
  page state.
- If `createProject` returns no `editToken`, hide the note entirely.
- Keep the form values after creation so the user can test and adjust without re-inferring.
- Do not use `window.open` or auto-navigation.

## Testing

- Happy path: valid sample + valid settings → create → URLs shown.
- Double-click create; confirm one project.
- Force each backend error (duplicate path, large list, rate limit) and check the copy.
- Disable the backend; confirm the network message includes `BASE`.
- Copy buttons on HTTP `localhost` (clipboard permission path) and a fallback path.

## Definition of Done

- [ ] Acceptance criteria verified against the real backend.
- [ ] Loading, error and success states handled.
- [ ] Works at 360 px and by keyboard.
- [ ] Build and typecheck pass.
- [ ] No token or sample content in the console.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
