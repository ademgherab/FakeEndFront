# S02 — Generation (20 min)

- **Depends on:** S00
- **File:** `src/MockApi/Generation.cs`

## Checklist

- [ ] `Generate(JsonNode schema, EndpointSettings settings, int index = 0)` → `JsonNode`.
- [ ] Walk object/array/leaf; preserve field order.
- [ ] Core generators only: `autoId`, `randomInt`, `randomDecimal`, `price`, `randomBool`, `nullValue`, `uuid`, `email`, `fullName`, `firstName`, `lastName`, `username`, `city`, `country`, `phone`, `company`, `url`, `words`, `sentence`, `paragraph`, `dateTime`, `date`, `enum`, `constant`.
- [ ] Deferred (do not build): `ipv4`, `hexColor`, `imageUrl`, `avatarUrl`, `unixTimestamp`, `streetAddress`, `state`, `zipCode`, `countryCode`, `currencyCode`, `productName`, `jobTitle`.
- [ ] `autoId` uses list index; outside a list random 1..100000.
- [ ] Price on a string node returns a string.
- [ ] Dates UTC, `Z` suffix, `yyyy-MM-dd` for `date`.
- [ ] Root array length from `settings.list.size`; nested arrays from node `length` (fallback 1..3).
- [ ] Support `nullProbability`/`omitProbability` if present.
- [ ] No DB, no Bogus, no NuGet; use `Random.Shared` and hardcoded word arrays.

## Done

Same schema called twice returns different shapes-compatible JSON; delay/errors are not handled here.
