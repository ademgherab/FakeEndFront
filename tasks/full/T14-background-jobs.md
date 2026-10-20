# T14 — Background jobs: expiry, purge, log retention, usage flush

- **Milestone:** M4
- **Depends on:** T13 (T10 for invalidation)
- **Spec refs:** §0.2 (Q7), §4.2, §11.1, §9.1 (step 2), **§12.6 (missing — see README)**

## Goal

Keep the database bounded and enforce the project lifecycle without manual intervention.

## Scope

- `ProjectExpiryWorker`: nothing to mutate at expiry (runtime already returns `410`), but cache/state must stay consistent.
- `ProjectPurgeWorker`: delete projects `3 days` after `expires_at`.
- `LogRetentionWorker`: keep the newest 1000 rows per project.
- Usage flush is owned by T13; this task supervises it and adds shutdown/startup safety.
- Startup recovery: flush or rebuild in-memory counters consistently.

## Implementation checklist

- [ ] Run on a configurable cadence (e.g. every 5–15 min) with jitter; single instance so no distributed lock needed.
- [ ] Purge: `DELETE FROM projects WHERE expires_at < now() - interval '3 days'`; cascades remove endpoints/logs/usage.
- [ ] Invalidate cache entries for purged slugs.
- [ ] Expiry grace: between `expires_at` and `expires_at + 3 days` the runtime returns `410`; no renewal or extension.
- [ ] Log retention: for each project, delete rows outside the newest 1000 by `id`; batch deletes to avoid long locks.
- [ ] Do not delete logs of projects that still exist beyond the retention reason; only the count limit applies.
- [ ] Workers use `BackgroundService`, honor `CancellationToken`, and never crash the host on a transient DB error.
- [ ] Structured logs for each sweep: counts purged/trimmed, duration, failures.
- [ ] No work when there is nothing to do (cheap query first).
- [ ] Configurable enable/disable per worker for local development.

## Acceptance criteria

- [ ] A project expired 4 days ago is deleted by the purge worker; its endpoints/logs/usage are gone.
- [ ] A project expired 1 day ago still returns `410` and is not deleted.
- [ ] A project with 1500 logs is trimmed to exactly the newest 1000 after a sweep.
- [ ] Purge invalidates the cache; a purged slug returns `404`, not a stale cached project.
- [ ] A database outage during a sweep logs an error, retries next cycle, and does not stop the worker.
- [ ] Shutdown waits briefly for a flush and does not lose acknowledged usage.

## Tests

- Integration tests with a controllable clock for expiry and purge.
- Retention test with >1000 rows and interleaved deletes.
- Worker resilience test with a failing DB connection.
- Shutdown/flush test.

## Notes

- Section 12 of the spec is missing; confirm cadence, batch sizes, and whether expiry should also be surfaced in the management API. Defaults above are proposed.
- Log deletion by count must be efficient on `(project_id, id DESC)`.
