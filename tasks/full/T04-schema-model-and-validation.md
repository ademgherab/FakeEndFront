# T04 — Schema model and validation

- **Milestone:** M1
- **Depends on:** T00, T02
- **Spec refs:** §5, §6.1, §7.1, §10.4 (Schema), §8.3

## Goal

The exact `Schema` type from §5.1 as C# DTOs, with a single validator used by inference output, management writes, and preview.

## Scope

- `Schema`, `SchemaNode` (object/array/leaf), `Field`, `GeneratorSpec`.
- Polymorphic JSON mapping using the `type` discriminator (`object`, `array`, `string`, `integer`, `number`, `boolean`, `null`).
- Structural validator: node counts, depth, name rules, probabilities, generator/type compatibility, params.
- Shared limit constants sourced from `MockApiOptions`.

## Implementation checklist

- [x] Models serialize to the exact camelCase shape in §5.1 with `fields` as an **array**, never an object.
- [x] `LeafNode.generator` is `{ name, params? }`; unknown generator names → `400 validation_failed`.
- [x] Unknown params for a generator → `400 validation_failed` (strict).
- [x] Validate `version == 1`.
- [x] Validate probabilities `0..1` for `nullProbability`/`omitProbability`.
- [x] Validate field names unique per object, 1..100 chars, 1..100 fields per object.
- [x] Validate max depth 10 and max total nodes 2000.
- [x] Validate `generator.name` exists in the catalog and supports the node type (`autoId` integer only, `price` number/string, `enum` string/integer, `constant` any leaf, etc. — §7.1).
- [x] Validate generator params (required, ranges, enum values, `min <= max`, `precision`, `rangeDays`, `format`, `kind`).
- [x] `list.path` and `bindings.*` are RFC 6901 JSON Pointers; resolver returns a typed target or a path-specific error.
- [x] Validator returns errors keyed by dotted path (e.g. `root.fields[2].node.generator.params.min`) so T02 can emit `errors`.

## Acceptance criteria

- [x] The example schema in §5.2 validates and round-trips byte-stable (modulo insignificant whitespace).
- [x] Each invalid case above produces exactly one targeted error path, not a generic "invalid schema".
- [x] Validator is pure and reusable without HTTP or DB dependencies.
- [x] A schema with 2001 nodes or depth 11 is rejected with the correct limit message.

## Tests

- Table-driven valid/invalid cases for every generator and param type.
- Round-trip serialization tests for deeply nested object/array/leaf combinations.
- JSON Pointer resolver tests including `~0`, `~1`, missing targets, and non-array targets.

## Notes

- Keep one validator. Do not duplicate rules in the API layer; inference must emit schemas that already pass it.
- `jsonb` ordering: because `fields` is an array, order survives storage.
