import { describe, expect, it } from "vitest";
import {
  analyzeSample,
  classifyRoot,
  countBytes,
  describeWrapInList,
  pathTemplateNames,
  validatePath,
  validateProjectName,
} from "@/lib/wizard/validation";

describe("sample analysis", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(countBytes("abc")).toBe(3);
    expect(countBytes("é")).toBe(2);
    expect(countBytes("😀")).toBe(4);
  });

  it("reports line and column for invalid JSON", () => {
    const result = analyzeSample('{\n  "a": 1,\n  "b": }\n}', 1024);

    expect(result.valid).toBe(false);
    expect(result.jsonError?.line).toBe(3);
    expect(result.jsonError?.column).toBeGreaterThan(0);
  });

  it("accepts an object root", () => {
    const result = analyzeSample('{"a":1}', 1024);
    expect(result.valid).toBe(true);
    expect(result.rootKind).toBe("object");
  });

  it("accepts an array root", () => {
    const result = analyzeSample("[1,2,3]", 1024);
    expect(result.valid).toBe(true);
    expect(result.rootKind).toBe("array");
  });

  it("blocks scalar roots with an explanation", () => {
    const result = analyzeSample("42", 1024);
    expect(result.valid).toBe(false);
    expect(result.rootKind).toBe("scalar");
    expect(result.rootError).toMatch(/object/i);
  });

  it("blocks null roots", () => {
    const result = analyzeSample("null", 1024);
    expect(result.valid).toBe(false);
    expect(result.rootKind).toBe("null");
    expect(result.rootError).toMatch(/null/i);
  });

  it("blocks a sample over the limit and reports both sizes", () => {
    const text = JSON.stringify({ blob: "x".repeat(100) });
    const result = analyzeSample(text, 20);

    expect(result.valid).toBe(false);
    expect(result.withinLimit).toBe(false);
    expect(result.sizeError).toContain(`${countBytes(text).toLocaleString("en-US")}`);
    expect(result.sizeError).toContain("20");
  });

  it("classifies values", () => {
    expect(classifyRoot(null)).toBe("null");
    expect(classifyRoot([])).toBe("array");
    expect(classifyRoot({})).toBe("object");
    expect(classifyRoot("x")).toBe("scalar");
  });
});

describe("path validation", () => {
  it.each(["/", "/users", "/users/{id}", "/v1/users/{userId}/posts/{postId}", "/a.b_c~d-e"])(
    "accepts %s",
    (path) => {
      expect(validatePath(path).valid).toBe(true);
    },
  );

  it.each([
    ["", /required/i],
    ["users", /start with/i],
    ["/users?page=1", /query/i],
    ["/users#top", /fragment/i],
    ["/users//posts", /empty segments/i],
    ["/users/../admin", /\.\./i],
    ["/users/{id", /complete template/i],
    ["/users/{id}/{id}", /more than once/i],
    ["/users/{id}/{}", /complete template/i],
    ["/users/hello world", /unsupported characters/i],
  ])("rejects %s", (path, pattern) => {
    const result = validatePath(path);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(pattern);
  });

  it("rejects a path over 200 characters", () => {
    const result = validatePath(`/${"a".repeat(200)}`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/200/);
  });

  it("extracts unique template names", () => {
    expect(pathTemplateNames("/users/{id}/posts/{postId}")).toEqual(["id", "postId"]);
  });
});

describe("project name validation", () => {
  it("allows an empty name", () => {
    expect(validateProjectName("", 60).valid).toBe(true);
  });

  it("rejects an over-long name", () => {
    const result = validateProjectName("x".repeat(61), 60);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/60/);
  });
});

describe("wrapInList copy", () => {
  it("describes both output shapes", () => {
    expect(describeWrapInList(true, "object")).toMatch(/array of objects/i);
    expect(describeWrapInList(false, "object")).toMatch(/single object/i);
  });
});
