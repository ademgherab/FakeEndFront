# S01 — Inference (20 min)

- **Depends on:** S00
- **File:** `src/MockApi/Inference.cs`

## Checklist

- [ ] `Infer(JsonNode sample, bool wrapInList)` → schema `JsonNode`.
- [ ] Types: object, array, string, integer, number, boolean, null.
- [ ] Integer vs number from raw JSON text (`1` vs `1.0`).
- [ ] Objects: `fields` as an ordered array; nested recursion.
- [ ] Arrays: infer from first item; empty → null leaf; length `{min:1,max:max(3,n)}`.
- [ ] `wrapInList`: wrap non-array root in an array.
- [ ] Name rules, in order: pattern → name → type fallback.
- [ ] Value patterns (core only): UUID, email, ISO date-time, date, URL.
- [ ] Core name rules: `email`, `firstName`, `lastName`, `fullName`, `username`, `city`, `country`, `phone`, `company`, `title`, `description`, `status/type/role`, `created/updated/*_at`, `id`, `age`, `price/amount`, `rating/score`, `count/views`, `url`.
- [ ] Do **not** implement niche types: IPv4, hex color, image/avatar URLs, Unix timestamps, street/state/zip, country/currency codes, product/job titles.
- [ ] Fallbacks: integer `randomInt`, number `randomDecimal`, bool `randomBool`, string `words`, null `nullValue`.
- [ ] Output is spec-shaped: `{version:1, root:{...}}` with `{name,node}` fields.

## Done

Inferring the demo sample yields sensible generators (`autoId`, `fullName`, `email`, `randomInt`, `dateTime`).
