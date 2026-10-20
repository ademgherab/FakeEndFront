# T10 — In-memory project cache

- **Milestone:** M2
- **Depends on:** T09
- **Spec refs:** §2.1, §2.2, §9.1 (step 1)

## Goal

Keep the mock hot path free of database reads by caching projects, endpoints, and compiled schemas in memory, with correct invalidation on every write.

## Scope

- `IProjectCache` keyed by slug.
- Snapshot model: project metadata, endpoint list, normalized routes, compiled schema/settings per endpoint.
- Invalidation hooks for project/endpoint create, update, delete.
- Fallback load from the database on miss.

## Implementation checklist

- [ ] Cache entry holds `expiresAt`, `createdAt`, `endpointId`, method, path, normalized path, schema, settings, and the compiled response plan.
- [ ] Lookup by slug is O(1) and does not allocate on the hot path.
- [ ] Endpoint matching data is precomputed (segments, template markers, static precedence) when the entry is built, not per request.
- [ ] On miss: load project + endpoints from DB, compile, cache; handle "not found" with a short negative cache or none (document the choice).
- [ ] Invalidate on project delete/rename/expiry-relevant update and on every endpoint write.
- [ ] Invalidate after background purge.
- [ ] Thread-safe for concurrent reads while a write invalidates (immutable snapshot swap).
- [ ] Compilation failures are logged and do not poison the cache (fail the write that caused them).
- [ ] Seeded generation uses the cached `project.createdAt` as the time reference.
- [ ] Never cache expired projects as usable; expiry is still checked per request from `expiresAt`.

## Acceptance criteria

- [ ] A mock request after warm-up performs zero DB queries (verified by a command counter).
- [ ] Editing an endpoint's schema/settings is visible on the next mock call (no restart, no TTL wait).
- [ ] Deleting an endpoint/project makes the mock return `404` immediately.
- [ ] Two endpoints with the same normalized route cannot both be cached (DB prevents it too).
- [ ] Cache under concurrent read/write does not throw or return partial snapshots.

## Tests

- Integration test with a DB command counter.
- Concurrency test with parallel reads and invalidations.
- Cache rebuild test after invalidation and after a simulated process restart.

## Notes

- Single instance only (Q13). If multi-instance is adopted, replace with a distributed cache + invalidation channel; document this in T19.
