import { describe, expect, it } from "vitest";
import type { EndpointSettings, Schema } from "@/lib/api/generated/schema";
import { makeMeta } from "@/test/fixtures/meta";
import {
  createDelaySchema,
  createEndpointSettingsSchema,
  createErrorInjectionSchema,
  createListSettingsSchema,
  createPaginationSchema,
  createPathSchema,
  createProjectNameSchema,
  createSampleTextSchema,
  createSchemaShapeSchema,
  createSeedSchema,
  endpointCollisionKey,
  findNormalizedPathCollision,
  normalizePathForComparison,
  validateEndpointSettings,
  validateSchemaShape,
  validateWith,
  zodIssues,
} from "@/lib/validation/schemas";
import { defaultEndpointSettings, defaultPaginationSettings } from "@/lib/settings/defaults";

const meta = makeMeta();

function expectValid(schema: Parameters<typeof validateWith>[0], value: unknown) {
  const result = validateWith(schema, value);
  expect(result.issues).toEqual([]);
  expect(result.valid).toBe(true);
  return result;
}

function expectInvalid(
  schema: Parameters<typeof validateWith>[0],
  value: unknown,
  pattern?: RegExp,
) {
  const result = validateWith(schema, value);
  expect(result.valid).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
  if (pattern) {
    expect(result.issues.map((issue) => issue.message).join(" ")).toMatch(pattern);
  }
  return result;
}

describe("path schema", () => {
  it.each([
    "/",
    "/users",
    "/users/{id}",
    "/v1/users/{userId}/posts/{postId}",
    "/a.b_c~d-e",
  ])("accepts %s", (path) => {
    expectValid(createPathSchema(200), path);
  });

  it.each([
    ["", /required/i],
    ["users", /start with/i],
    ["/users?page=1", /query/i],
    ["/users#top", /fragment/i],
    ["/users//posts", /empty segments/i],
    ["/users/../admin", /\.\./],
    ["/users/{id", /complete template/i],
    ["/users/{id}/{id}", /more than once/i],
    ["/users/hello world", /unsupported characters/i],
  ])("rejects %s", (path, pattern) => {
    expectInvalid(createPathSchema(200), path, pattern);
  });

  it("accepts exactly 200 characters and rejects 201", () => {
    expectValid(createPathSchema(200), `/${"a".repeat(199)}`);
    expectInvalid(createPathSchema(200), `/${"a".repeat(200)}`, /200/);
  });
});

describe("sample schema", () => {
  const max = meta.limits.maxSampleBytes;

  it("accepts an object and array at the limit", () => {
    expectValid(createSampleTextSchema(max), "{}");
    expectValid(createSampleTextSchema(max), "[]");
  });

  it("accepts exactly 100 KB and rejects one byte more", () => {
    const empty = JSON.stringify({ data: "" });
    const exact = JSON.stringify({ data: "x".repeat(max - empty.length) });
    expect(new TextEncoder().encode(exact).length).toBe(max);
    expectValid(createSampleTextSchema(max), exact);

    const over = JSON.stringify({ data: "x".repeat(max - empty.length + 1) });
    expectInvalid(createSampleTextSchema(max), over, /102,400|100/);
  });

  it("rejects scalar and null roots with an explanation", () => {
    expectInvalid(createSampleTextSchema(max), "42", /object/i);
    expectInvalid(createSampleTextSchema(max), "null", /null/i);
  });

  it("rejects invalid JSON with line and column", () => {
    expectInvalid(createSampleTextSchema(max), '{"a": }', /line 1/i);
  });
});

describe("project name schema", () => {
  it("allows empty and exactly the maximum", () => {
    expectValid(createProjectNameSchema(60), "");
    expectValid(createProjectNameSchema(60), "x".repeat(60));
  });

  it("rejects 61 characters and reports both values", () => {
    expectInvalid(createProjectNameSchema(60), "x".repeat(61), /60/);
  });

  it("rejects whitespace-only names", () => {
    expectInvalid(createProjectNameSchema(60), "   ", /whitespace/i);
  });
});

describe("delay schema", () => {
  it("accepts the 0 and max boundaries and min <= max", () => {
    expectValid(createDelaySchema(meta), { minMs: 0, maxMs: 0 });
    expectValid(createDelaySchema(meta), { minMs: 0, maxMs: 10_000 });
    expectValid(createDelaySchema(meta), { minMs: 10_000, maxMs: 10_000 });
  });

  it("rejects min > max with both values in the message", () => {
    expectInvalid(createDelaySchema(meta), { minMs: 501, maxMs: 500 }, /501.*500/);
  });

  it("rejects out-of-range and fractional values", () => {
    expectInvalid(createDelaySchema(meta), { minMs: -1, maxMs: 10 }, /0/);
    expectInvalid(createDelaySchema(meta), { minMs: 0, maxMs: 10_001 }, /10000|10,000/);
    expectInvalid(createDelaySchema(meta), { minMs: 0.5, maxMs: 10 }, /whole number/i);
  });
});

describe("error injection schema", () => {
  it("accepts zero rate and up to 10 unique valid codes", () => {
    expectValid(createErrorInjectionSchema(meta), { rate: 0, codes: [500] });
    expectValid(createErrorInjectionSchema(meta), {
      rate: 0.25,
      codes: [400, 401, 403, 404, 409, 422, 429, 500, 503, 599],
    });
  });

  it("rejects more than 10 codes", () => {
    const codes = Array.from({ length: 11 }, (_, index) => 400 + index);
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1, codes }, /10/);
  });

  it("rejects duplicate and out-of-range codes", () => {
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1, codes: [500, 500] }, /unique/i);
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1, codes: [399] }, /400.*599/);
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1, codes: [600] }, /400.*599/);
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1, codes: [] }, /at least one/i);
  });

  it("rejects rates above 100% and more than one decimal", () => {
    expectInvalid(createErrorInjectionSchema(meta), { rate: 1.01, codes: [500] }, /100/);
    expectInvalid(createErrorInjectionSchema(meta), { rate: 0.1234, codes: [500] }, /1 decimal/i);
  });
});

describe("list and pagination schemas", () => {
  it("accepts the list-size boundaries", () => {
    expectValid(createListSettingsSchema(meta), { minSize: 0, maxSize: 0 });
    expectValid(createListSettingsSchema(meta), { minSize: 1_000, maxSize: 1_000 });
  });

  it("rejects min > max and out-of-range list sizes", () => {
    expectInvalid(createListSettingsSchema(meta), { minSize: 11, maxSize: 10 }, /11.*10/);
    expectInvalid(createListSettingsSchema(meta), { minSize: 0, maxSize: 1_001 }, /1000|1,000/);
    expectInvalid(createListSettingsSchema(meta), { minSize: -1, maxSize: 1 }, /0/);
  });

  it("accepts pagination boundary values", () => {
    expectValid(createPaginationSchema(meta), {
      totalItems: 0,
      defaultLimit: 1,
      maxLimit: 1,
      pageBinding: null,
      limitBinding: "/meta/limit",
      totalBinding: null,
      totalPagesBinding: null,
      hasNextBinding: null,
      hasPrevBinding: null,
    });
    const max = defaultPaginationSettings(meta);
    expectValid(createPaginationSchema(meta), {
      ...max,
      totalItems: 10_000,
      defaultLimit: 100,
      maxLimit: 100,
    });
  });

  it("rejects defaultLimit above maxLimit, maxLimit above 100 and totalItems above 10000", () => {
    expectInvalid(
      createPaginationSchema(meta),
      { ...defaultPaginationSettings(meta), defaultLimit: 81, maxLimit: 80 },
      /81.*80/,
    );
    expectInvalid(
      createPaginationSchema(meta),
      { ...defaultPaginationSettings(meta), maxLimit: 101, defaultLimit: 10 },
      /100/,
    );
    expectInvalid(
      createPaginationSchema(meta),
      { ...defaultPaginationSettings(meta), totalItems: 10_001 },
      /10000|10,000/,
    );
  });

  it("rejects invalid JSON Pointer bindings", () => {
    expectInvalid(
      createPaginationSchema(meta),
      { ...defaultPaginationSettings(meta), totalBinding: "meta total" },
      /JSON Pointer/i,
    );
  });
});

describe("seed schema", () => {
  it("accepts Int32 boundaries and null", () => {
    expectValid(createSeedSchema(), null);
    expectValid(createSeedSchema(), -2_147_483_648);
    expectValid(createSeedSchema(), 2_147_483_647);
  });

  it("rejects one past the Int32 boundaries and fractions", () => {
    expectInvalid(createSeedSchema(), 2_147_483_648, /2147483647/);
    expectInvalid(createSeedSchema(), -2_147_483_649, /-2147483648/);
    expectInvalid(createSeedSchema(), 1.5, /whole number/i);
  });
});

describe("endpoint settings schema", () => {
  it("accepts the meta defaults and reports field errors", () => {
    const result = validateEndpointSettings(defaultEndpointSettings("GET", meta), meta);
    expect(result.valid).toBe(true);

    const invalid = validateEndpointSettings(
      {
        ...defaultEndpointSettings("GET", meta),
        delay: { minMs: 500, maxMs: 100 },
      } as EndpointSettings,
      meta,
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.fieldErrors["delay.maxMs"]?.[0]).toMatch(/500.*100/);
  });

  it("rejects an invalid success status", () => {
    expectInvalid(
      createEndpointSettingsSchema(meta),
      { ...defaultEndpointSettings("GET", meta), successStatus: 99 },
      /100.*599/,
    );
  });
});

function node(name: string, depth: number, type: "object" | "string" = "object"): Schema["root"] {
  if (depth === 0 || type === "string") return { name, type: "string" };
  return { name, type: "object", fields: [node(`${name}_child`, depth - 1)] };
}

describe("schema shape validation", () => {
  it("accepts a schema at the depth and node limits", () => {
    const schema: Schema = { version: 1, root: node("root", 9) };
    expect(validateSchemaShape(schema, meta).valid).toBe(true);
  });

  it("reaches depth 10 but rejects depth 11", () => {
    const atLimit: Schema = { version: 1, root: node("root", 9) };
    expect(validateSchemaShape(atLimit, meta).valid).toBe(true);

    const over: Schema = { version: 1, root: node("root", 10) };
    expect(validateSchemaShape(over, meta).issues[0]?.message).toMatch(/11|10/);
  });

  it("rejects more than 2,000 nodes", () => {
    const schema: Schema = {
      version: 1,
      root: {
        name: "root",
        type: "object",
        fields: Array.from({ length: 2_000 }, (_, index) => ({
          name: `field${index}`,
          type: "string" as const,
        })),
      },
    };
    expect(validateSchemaShape(schema, meta).issues[0]?.message).toMatch(/2,000|2000/);
  });

  it("rejects duplicate field names in one object", () => {
    const schema: Schema = {
      version: 1,
      root: {
        name: "root",
        type: "object",
        fields: [
          { name: "id", type: "string" },
          { name: "id", type: "number" },
        ],
      },
    };
    expect(createSchemaShapeSchema(meta).safeParse(schema).success).toBe(true);
    expect(validateSchemaShape(schema, meta).issues[0]?.message).toMatch(/more than once/i);
  });

  it("rejects probabilities outside 0..1", () => {
    const schema: Schema = {
      version: 1,
      root: { name: "root", type: "string", nullProbability: 1.2 },
    };
    expect(validateSchemaShape(schema, meta).issues[0]?.message).toMatch(/between 0 and 1/i);
  });

  it("rejects an empty schema value", () => {
    expect(validateSchemaShape(null, meta).valid).toBe(false);
  });
});

describe("normalised path collisions", () => {
  it("normalises case, trailing slashes and template names", () => {
    expect(normalizePathForComparison("/Users/{id}/")).toBe("/users/{}");
    expect(normalizePathForComparison("/users/{userId}")).toBe("/users/{}");
    expect(endpointCollisionKey({ method: "get", path: "/Users/{id}/" })).toBe(
      "GET /users/{}",
    );
  });

  it("detects a collision before submit and respects ignore", () => {
    const existing = [{ method: "GET" as const, path: "/users/{id}" }];
    expect(
      findNormalizedPathCollision({ method: "GET", path: "/users/{userId}" }, existing),
    ).toEqual(existing[0]);
    expect(
      findNormalizedPathCollision({ method: "POST", path: "/users/{id}" }, existing),
    ).toBeNull();
    expect(
      findNormalizedPathCollision({ method: "GET", path: "/users/{id}" }, existing, {
        ignore: (entry) => entry === existing[0],
      }),
    ).toBeNull();
  });
});

describe("issue formatting", () => {
  it("turns a Zod error into field errors", () => {
    const result = createDelaySchema(meta).safeParse({ minMs: 5, maxMs: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issues = zodIssues(result.error);
    expect(issues[0]?.path).toBe("maxMs");
  });
});
