# T13 — Request logs, usage counters, logs API

- **Milestone:** M4
- **Depends on:** T11, T12
- **Spec refs:** §2.2, §4.1 (`request_logs`, `project_usage_daily`), §9.1 (steps 4, 11), §10.1 (#14, #15), §10.3 (#14, #15), §11.1

## Goal

Asynchronous, non-blocking logging and usage tracking for mock calls, plus the management endpoints that read and clear logs.

## Scope

- Bounded log queue + batch writer.
- Usage counter with periodic flush and daily quota check.
- `GET /projects/{slug}/logs`, `DELETE /projects/{slug}/logs`.

## Implementation checklist

- [ ] Enqueue from runtime step 11 without awaiting DB I/O; bounded channel with a documented drop policy when full (log the drop, never fail the request).
- [ ] Fields persisted: `project_id`, `endpoint_id` (nullable), `request_id`, `method`, `path`, `query`, `status`, `injected_error`, `delay_ms`, `latency_ms`, `request_content_type`, `request_body`, `user_agent`, `created_at`.
- [ ] Truncate: request body to 4096 **bytes** (valid UTF-8, no broken characters), query to 500 chars, user agent to 200 chars, path to 300.
- [ ] No IP address stored anywhere.
- [ ] Batch insert on a size/time trigger; failure retries with backoff and does not crash the worker.
- [ ] Do not log steps 1–5; log steps 6–10 including `404`/`405`/`400` and injected errors (the runtime decides, this task stores).
- [ ] Usage: increment an in-memory counter per project per UTC day; flush to `project_usage_daily` periodically and on shutdown.
- [ ] Daily quota check reads the in-memory count (plus flushed baseline) and returns seconds until 00:00 UTC for `Retry-After`.
- [ ] `GET /logs`: params `limit 1..100` (default 50), `before`, `after`, `endpointId`, `status`, `injected`; `before` + `after` together → `400`.
- [ ] Always newest first: `ORDER BY id DESC`; `nextCursor` = smallest returned id (or null); `latestId` = newest id in the project, independent of filters.
- [ ] `DELETE /logs` → `204` and clears only that project's logs.
- [ ] Token auth per T08; unknown slug/endpoint rules as documented.

## Acceptance criteria

- [ ] A mock request produces exactly one log row with a `request_id` equal to `X-Request-Id`.
- [ ] A slow/failing database does not increase mock response latency beyond the enqueue cost.
- [ ] Body truncation never splits a multi-byte character and never exceeds 4096 bytes.
- [ ] `after=<id>` polling returns only newer rows; `before` scrolls page-by-page without duplicates.
- [ ] `latestId` is stable across filters and increases with new traffic.
- [ ] Clearing logs does not delete endpoints or usage.
- [ ] The 5000th request of the UTC day succeeds and the 5001st returns `429 daily_quota_exceeded` with correct `Retry-After`.

## Tests

- Queue/batch integration tests (success, retry, shutdown flush).
- Truncation unit tests with multi-byte input.
- Logs API filter/cursor tests.
- Quota boundary test with a controlled clock.
- Concurrency test: parallel mock calls produce exactly one row each.

## Notes

- Retention (newest 1000 per project) is T14; this task only writes.
- Use `DateTimeOffset.UtcNow` behind `TimeProvider` so UTC-day rollover is testable.
