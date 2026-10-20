---
id: "SPR-06"
title: "States, accessibility, responsive, build and smoke"
milestone: "Sprint — 80–90 min"
priority: "P0"
size: "10 min"
status: "review"
owner: ""
depends_on: ["SPR-02","SPR-03","SPR-04","SPR-05"]
spec_refs: ["§6","§9","§10","§11"]
---

# SPR-06 · States, accessibility, responsive, build and smoke

| Field | Value |
|---|---|
| Milestone | Sprint — 80–90 min |
| Priority | P0 |
| Size | 10 min |
| Depends on | SPR-02, SPR-03, SPR-04, SPR-05 |
| Spec | §6, §9, §10, §11 |

## Context

The sprint ends with a reliable demo, not more features. This task is the final gate:
remove dead legacy code, cover the empty/loading/error/success states, verify mobile and
keyboard use, and run the real acceptance checklist.

## Scope

### State audit

- `idle`: empty or valid sample; infer available; create disabled.
- `inferring`: button busy, create disabled.
- `inferred`: schema visible; create enabled only when settings are valid.
- `creating`: create busy; duplicate submissions blocked.
- `created`: result and test panels visible.
- `error`: inline field errors and/or banner with `code` + `detail`.
- Empty, loading, error and success states are all present in the UI.

### Cleanup

- Remove any remaining legacy routes, components, stores, hooks and dependencies that are
  outside the sprint scope.
- Keep only `/`.
- Remove dead imports, commented-out flows and unused packages.
- Ensure one lockfile remains.

### Accessibility

- Every input has a visible label.
- Field errors are linked with `aria-describedby`.
- Buttons expose `aria-busy` while loading.
- Copy actions announce **"Copied"** for 2 seconds.
- Errors use `role="alert"` or an equivalent live region.
- Keyboard-only run: sample → infer → settings → create → copy → test.
- Visible focus rings; no keyboard traps.

### Responsive

- 360 px: single column, no horizontal scroll, code blocks scroll internally.
- 768/1024/1440 px: two columns where appropriate; no clipped panels.
- Long URLs and JSON wrap or scroll without breaking the page.

### Build and smoke

- `npm run build` passes.
- `npm run dev` with the real backend at `http://localhost:5031`.
- No console errors or warnings in the demo flow.
- No sample content, token or request body in the console.
- No `localStorage`/`sessionStorage` entries for sample, schema or token.
- `examples/users.json` matches the demo script.

## Acceptance criteria

- [x] All acceptance criteria in `frontend-spec.md` §9 pass.
- [x] Only `/` is routable; legacy pages are gone.
- [x] 360 px layout has no horizontal scroll.
- [x] Keyboard-only flow works end to end.
- [x] `npm run build` passes.
- [x] No console errors in the demo flow.
- [x] No sample/token is persisted in browser storage.
- [x] The demo script in `frontend-spec.md` §10 runs without a workaround.

## Implementation notes

- Do not add new features in this task. Fix only what blocks the acceptance criteria.
- If a legacy file is reused, verify it does not import auth/logs/meta/schema-editor code.
- If the build fails because of an unused legacy dependency, remove the dependency and its
  imports rather than disabling type checks.
- If the backend is unavailable, fix the network message and document the blocker; do not
  fake the result.
- If time is short, prioritise create → copy → test over the optional preview (SPR-07).

## Testing

- Run the full demo script twice: once with the default settings and once with the
  realistic/flaky presets.
- Use browser devtools at 360 px and 1440 px.
- Disable the backend and confirm the error message.
- Check console and application storage after the flow.

## Definition of Done

- [x] Acceptance criteria verified against the real backend.
- [x] Build and typecheck pass.
- [x] No console errors or warnings.
- [x] No out-of-scope routes or features remain.
- [x] Demo is rehearsed and the fallback plan is clear.

---

[← Back to the task index](./README.md) · [Master plan](../frontend-tasks.md)
