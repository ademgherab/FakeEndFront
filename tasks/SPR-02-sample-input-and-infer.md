---
id: "SPR-02"
title: "JSON sample input and infer"
milestone: "Sprint — 10–25 min"
priority: "P0"
size: "15 min"
status: "todo"
owner: ""
depends_on: ["SPR-01"]
spec_refs: ["§2","§3.1","§6","§9"]
---

# SPR-02 · JSON sample input and infer

| Field | Value |
|---|---|
| Milestone | Sprint — 10–25 min |
| Priority | P0 |
| Size | 15 min |
| Depends on | SPR-01 |
| Spec | §2, §3.1, §6, §9 |

## Context

This is the first user action: paste a JSON sample, validate it locally, and call
`POST /api/v1/infer`. The inferred schema unlocks **Create mock**. A bad sample must fail
locally before any request is sent.

## Scope

- Add the header: product name and `API: {BASE}`.
- Add the privacy note above the textarea:
  **"Do not paste real or sensitive data."**
- Add the sample textarea with a label.
- Add the **Return as list** switch (`wrapInList`). It only applies when the sample root is
  not already an array; disable it when the root is an array.
- Parse the textarea locally with `JSON.parse` on change:
  - Empty input is not an error; it disables inference.
  - Invalid JSON shows a readable inline message and disables inference.
  - A valid scalar or `null` root may be sent; the API will explain if it is unacceptable.
- Add **Infer schema**:
  - Disabled while empty, invalid or inferring.
  - `aria-busy="true"` while running; label changes to "Inferring…".
  - Calls `infer({ sample, options: { wrapInList } })` from `lib/api.ts`.
- State transitions: `idle → inferring → inferred` or `error`.
- On success:
  - Store `schema`, `warnings` and `suggestions`.
  - Show warnings as advisory text; they never block creation.
  - Render a read-only `SchemaPreview` as formatted JSON in a collapsible panel.
  - Enable creation (the target state is `inferred`).
- On error:
  - Show an `ErrorBanner` with `problem.code` and `problem.detail`.
  - Render `problem.errors` under matching fields when possible; otherwise list them in the
    banner.
- When the sample changes after a successful inference:
  - Invalidate the schema and return to `idle`.
  - Keep the old schema preview visible but mark it **stale**.
  - Disable creation until inference runs again.

## Acceptance criteria

- [ ] A valid object sample infers successfully and shows the schema JSON.
- [ ] An array sample works; **Return as list** is disabled for array roots.
- [ ] Empty input disables **Infer schema**.
- [ ] Invalid JSON disables inference and shows a readable message.
- [ ] The inference request never sends an empty sample.
- [ ] `warnings` render without blocking creation.
- [ ] Sample change after inference marks the schema stale and disables creation.
- [ ] `400`, `422` and `413` errors show `code` + `detail`, not a generic message.
- [ ] The button exposes `aria-busy` while inferring.
- [ ] The flow is keyboard accessible and the textarea has a label.

## Implementation notes

- Run inference on button click, not on every keystroke. No debounce is needed.
- Use the parsed object from `JSON.parse`, not the raw text, in the API payload.
- Keep the textarea value as a string; keep the parsed sample separate.
- `SchemaPreview` is display-only: `<pre>` with monospace text, no CodeMirror, no editing.
- Do not add a schema field editor. This sprint only shows the JSON.
- Keep state in `page.tsx` or a single `useMockBuilder` hook.
- Do not persist the sample in `localStorage`/`sessionStorage`.

## Testing

- Valid object, valid array, scalar (`42`), `null`, empty string, invalid JSON.
- Backend errors: `400 validation_failed`, `422 sample_invalid`, `413 payload_too_large`.
- Change the sample after inference; confirm creation is disabled and the preview is stale.
- Tab through the textarea, switch and button.

## Definition of Done

- [ ] Acceptance criteria verified against the real backend.
- [ ] Loading, empty, error and success states are handled.
- [ ] Works at 360 px and by keyboard.
- [ ] Build and typecheck pass.
- [ ] No sample content is logged to the console.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
