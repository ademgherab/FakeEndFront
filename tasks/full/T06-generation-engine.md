# T06 — Generation engine

- **Milestone:** M1
- **Depends on:** T04
- **Spec refs:** §5.3, §7 (all), §8.3–§8.4, §9.1 (step 10)

## Goal

Deterministic-or-random JSON generation from a validated schema, streamed directly to the response, with a hard cap and every generator in the catalog.

## Scope

- `JsonGenerator` writing into `Utf8JsonWriter`.
- Full generator catalog (§7.1) using Bogus for names/addresses/lorem.
- Seed derivation and fixed time reference (§7.3).
- Nested array lengths, `nullProbability`, `omitProbability`, `enum`.
- Pagination-aware `autoId` and list sizing hooks.
- 100,000 generated-value cap at runtime and a matching estimator for save-time checks.

## Implementation checklist

- [ ] All generators: `autoId`, `randomInt`, `randomDecimal`, `price`, `unixTimestamp`, `randomBool`, `nullValue`, `uuid`, `email`, `fullName`, `firstName`, `lastName`, `username`, `phone`, `city`, `country`, `countryCode`, `state`, `streetAddress`, `zipCode`, `company`, `productName`, `jobTitle`, `currencyCode`, `url`, `imageUrl`, `avatarUrl`, `hexColor`, `ipv4`, `words`, `sentence`, `paragraph`, `dateTime`, `date`, `enum`, `constant`.
- [x] Generators format output to the node type (e.g. `price` on a string node returns `"19.99"`).
- [x] Dates: UTC, seconds precision, `Z` suffix; `iso-datetime-ms` adds `.fff`; `kind` supports `past`/`future`/`recent`.
- [ ] `autoId` in a list = `(page-1)*limit + index + start`; outside a list = random 1..100000.
- [ ] Images use `https://picsum.photos/seed/{random}/200/200` and `https://i.pravatar.cc/150?u={random}`; never fetch them (§7.4).
- [x] Nested arrays use their own `length`; the list array's `length` is ignored (§5.3).
- [ ] Seeded mode: `itemSeed = XxHash32(seed, endpointId, globalIndex)`; a new `Faker("en")` with `Random = new Randomizer(itemSeed)` per item. Use `i = 0` for non-list responses.
- [ ] Seed applies to `omitProbability`, `nullProbability`, and `enum` picks.
- [ ] Seeded dates are relative to the project's `created_at`, not `UtcNow`.
- [x] Never use `string.GetHashCode()`, `Randomizer.Seed` static, or Bogus's clock.
- [x] Unseeded mode: `Random.Shared` + fresh `Faker` per request.
- [x] Delay and error injection are **not** passed into this component and are never seeded.
- [x] Write with `Utf8JsonWriter` directly to the response; no intermediate object graph.
- [x] Enforce the 100,000-value cap during generation; throw a typed `ResponseTooLargeException` for the runtime/host to map.
- [ ] Provide `EstimateValueCount(schema, settings)` used by save-time cross-checks (T12), consistent with the runtime counter.

## Acceptance criteria

- [ ] Same schema + seed + page/limit ⇒ byte-identical output across processes and restarts.
- [ ] Different seeds ⇒ different output (statistically; test with fixed fixtures).
- [ ] `autoId` continues across pages (`page 2` starts after `page 1`).
- [x] A schema that exceeds 100k values fails at runtime with a controlled error, not an OOM.
- [x] Field order in output matches `fields` array order.
- [x] Booleans, nulls, integers, decimals, and nested arrays all emit valid JSON (no trailing commas, correct escaping).
- [x] Unicode and control characters in strings are escaped correctly.

## Tests

- Golden tests for seeded output across page 1/2.
- Per-generator unit tests for ranges, formats, precision, and type formatting.
- Determinism test running the same request twice in two separate app instances.
- Cap test with a wide nested schema.
- Fuzz test: random valid schemas always produce parseable JSON matching the schema shape.

## Notes

- Keep generation synchronous; the runtime owns `Task.Delay` and cancellation.
- The estimator and the runtime counter must share one traversal implementation to avoid drift.
