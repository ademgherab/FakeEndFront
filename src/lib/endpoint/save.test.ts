import { describe, expect, it } from "vitest";
import {
  chooseSaveOperation,
  isDirty,
  stableJson,
  valuesEqual,
} from "@/lib/endpoint/save";

describe("chooseSaveOperation (PRJ-07)", () => {
  it("does nothing when the draft matches the saved endpoint", () => {
    expect(
      chooseSaveOperation({
        metaDirty: false,
        schemaDirty: false,
        settingsDirty: false,
      }),
    ).toBe("none");
  });

  it("uses the schema-only path for a schema edit", () => {
    expect(
      chooseSaveOperation({
        metaDirty: false,
        schemaDirty: true,
        settingsDirty: false,
      }),
    ).toBe("schema");
  });

  it("uses the settings-only path for a settings edit", () => {
    expect(
      chooseSaveOperation({
        metaDirty: false,
        schemaDirty: false,
        settingsDirty: true,
      }),
    ).toBe("settings");
  });

  it("falls back to a full replace when method or path changed", () => {
    expect(
      chooseSaveOperation({
        metaDirty: true,
        schemaDirty: false,
        settingsDirty: false,
      }),
    ).toBe("full");
    expect(
      chooseSaveOperation({
        metaDirty: true,
        schemaDirty: true,
        settingsDirty: true,
      }),
    ).toBe("full");
  });

  it("uses a full replace when schema and settings changed together", () => {
    expect(
      chooseSaveOperation({
        metaDirty: false,
        schemaDirty: true,
        settingsDirty: true,
      }),
    ).toBe("full");
  });

  it("reports any dirty field", () => {
    expect(
      isDirty({ metaDirty: false, schemaDirty: false, settingsDirty: false }),
    ).toBe(false);
    expect(
      isDirty({ metaDirty: false, schemaDirty: false, settingsDirty: true }),
    ).toBe(true);
  });
});

describe("stableJson", () => {
  it("is independent of object key order", () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
  });

  it("preserves array order", () => {
    expect(stableJson([1, 2])).not.toBe(stableJson([2, 1]));
  });

  it("handles nested values and null", () => {
    expect(
      stableJson({ root: { fields: [{ name: "id", type: "number" }] }, extra: null }),
    ).toBe(
      '{"extra":null,"root":{"fields":[{"name":"id","type":"number"}]}}',
    );
  });

  it("compares values structurally", () => {
    expect(valuesEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(valuesEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
  });
});
