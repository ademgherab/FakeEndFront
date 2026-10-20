---
id: "SPR-03"
title: "Endpoint settings form"
milestone: "Sprint — 25–45 min"
priority: "P0"
size: "20 min"
status: "review"
owner: ""
depends_on: ["SPR-01"]
spec_refs: ["§3.3","§5","§6","§9"]
---

# SPR-03 · Endpoint settings form

| Field | Value |
|---|---|
| Milestone | Sprint — 25–45 min |
| Priority | P0 |
| Size | 20 min |
| Depends on | SPR-01 |
| Spec | §3.3, §5, §6, §9 |

## Context

The settings form turns the inferred schema into a fake endpoint. The backend and the UI
must agree on the same defaults and validation rules. The form owns validity; the page uses
that validity to enable **Create mock**.

## Scope

Build `SettingsForm` with controlled inputs:

| Field | Control | Default | Validation |
|---|---|---|---|
| `method` | select | `GET` | `GET`, `POST`, `PUT`, `DELETE` |
| `path` | text | `/users` | starts with `/`, no `?`, `#` or spaces, max 200 |
| `successStatus` | select | GET 200, POST 201, PUT 200, DELETE 204 | `200`, `201`, `202`, `204` |
| `delay.minMs` | number | 0 | `0..10000` |
| `delay.maxMs` | number | 0 | `0..10000`, `>= minMs` |
| `errors.ratePercent` | number | 0 | `0..100`, one decimal |
| `errors.statusCodes` | chips/multi-select | `[500]` | 1–10 unique, `400..599`; required when rate > 0 |
| `list.size.min` | number | 10 | `0..1000` |
| `list.size.max` | number | 10 | `0..1000`, `>= min` |

Rules:

- Changing `method` updates `successStatus` to the method default.
- Keep the payload shape stable when `errors.ratePercent` is 0: send the current
  `statusCodes` (the backend ignores them at 0%).
- Trim `path`; add a leading `/` if the user omitted it; reject spaces.
- Expose an `isValid` boolean and a field-error map to the page.
- Render every field error inline and link it with `aria-describedby`.
- Add three presets:
  - **Fast + reliable:** delay `0–0`, errors `0`.
  - **Realistic:** delay `300–1500`, errors `10%` with `[500, 503]`.
  - **Flaky demo:** errors `100%` with `[503]`.
- If `GET /api/v1/meta` is available, use its limits/status lists. Otherwise use
  `lib/defaults.ts`. Do not block the form on meta.

## Acceptance criteria

- [x] Defaults match the table above.
- [x] Selecting `POST`/`PUT`/`DELETE` updates the success-status default and allows only
      `200`, `201`, `202`, `204`.
- [x] Path without a leading `/` is normalised; spaces, `?` and `#` are rejected.
- [x] `min > max` is rejected for both delay and list size.
- [x] Delay and list values outside their ranges are rejected.
- [x] Error rate outside `0..100`, more than one decimal, or > 10 codes is rejected.
- [x] Error codes outside `400..599` or duplicates are rejected.
- [x] Error rate > 0 with no codes is rejected.
- [x] Presets apply the expected values.
- [x] The page receives `isValid` and disables **Create mock** when false.
- [x] Every input has a label and inline errors use `aria-describedby`.

## Implementation notes

- Keep numeric inputs as strings while editing; parse and validate on change.
- Do not use Zod/React Hook Form. Plain TypeScript validators are enough for the sprint.
- Keep the settings object shape exactly as `EndpointSettings` in `lib/types.ts`.
- `wrapInList` lives with the sample input (SPR-02), not in this form.
- No `successStatus: 204` body hints are needed because the FakeEnd runtime is tested
  separately. If `204` is selected, the test panel will show an empty body.
- Do not hard-code limits in multiple components; read from `defaults.ts` or meta.

## Testing

- Each invalid field blocks creation and shows one clear message.
- Boundary values: `0`, `10000`, `1000`, `100`, `400`, `599`, `10` codes.
- Presets change every relevant field.
- Keyboard-only pass; errors are announced/associated.

## Definition of Done

- [x] Acceptance criteria verified against the real backend.
- [x] Form validity is based on the same rules the API enforces.
- [x] Works at 360 px and by keyboard.
- [x] Build and typecheck pass.
- [x] No hard-coded limits scattered outside `defaults.ts`.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
