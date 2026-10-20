import { describe, expect, it } from "vitest";
import {
  AppError,
  ERROR_CODES,
  copyForCode,
  explainError,
  parseRetryAfter,
  redactSecrets,
} from "@/lib/errors";

describe("error copy", () => {
  it("maps every documented code to specific copy", () => {
    for (const code of ERROR_CODES) {
      if (code === "unknown_error") continue;
      const copy = copyForCode(code);
      expect(copy.title, code).toBeTruthy();
      expect(copy.message, code).toBeTruthy();
      expect(copy.action, code).toBeTruthy();
      expect(copy.title, code).not.toBe(copyForCode("unknown_error").title);
    }
  });

  it("uses the server title and detail for unknown codes", () => {
    const error = new AppError({
      status: 418,
      code: "teapot_mode",
      title: "Teapot mode",
      detail: "The endpoint is resting.",
    });

    expect(explainError(error)).toMatchObject({
      title: "Teapot mode",
      message: "The endpoint is resting.",
    });
  });

  it("does not leak internal detail for unknown codes", () => {
    const error = new AppError({
      status: 500,
      code: "mystery_error",
      title: "Server error",
      detail: "System.NullReferenceException at Foo.Bar()",
    });

    const copy = explainError(error);
    expect(copy.message).not.toContain("NullReference");
    expect(copy.message).not.toContain("Foo.Bar");
  });

  it("redacts edit tokens and bearer headers", () => {
    const secret = "et_Qm3vExampleTokenValue";
    expect(redactSecrets(`Bearer ${secret}`)).not.toContain(secret);
    expect(redactSecrets(`token ${secret} leaked`)).not.toContain(secret);
  });

  it("never puts a token in the thrown message", () => {
    const secret = "et_Qm3vExampleTokenValue";
    const error = new AppError({
      status: 403,
      code: "invalid_token",
      detail: `Rejected Authorization: Bearer ${secret}`,
    });
    expect(error.message).not.toContain(secret);
  });
});

describe("retry-after parsing", () => {
  it("accepts seconds", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("accepts an HTTP date", () => {
    const target = new Date(Date.now() + 30_000).toUTCString();
    const seconds = parseRetryAfter(target);
    expect(seconds).toBeGreaterThanOrEqual(28);
    expect(seconds).toBeLessThanOrEqual(31);
  });

  it("ignores invalid values", () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});
