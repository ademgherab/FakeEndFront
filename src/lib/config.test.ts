import { describe, expect, it } from "vitest";
import {
  joinUrl,
  normalizeBaseUrl,
  parseConfig,
  resolveMockBaseUrl,
} from "@/lib/config";

const valid = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/",
  NEXT_PUBLIC_APP_URL: "https://mock.example.com/",
};

describe("config", () => {
  it("fails fast and names the missing variable", () => {
    expect(() => parseConfig({ ...valid, NEXT_PUBLIC_API_BASE_URL: "" })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
    expect(() => parseConfig({ ...valid, NEXT_PUBLIC_API_BASE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });

  it("rejects a malformed API URL and names the variable", () => {
    expect(() =>
      parseConfig({ ...valid, NEXT_PUBLIC_API_BASE_URL: "api.example.com" }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
    expect(() =>
      parseConfig({ ...valid, NEXT_PUBLIC_API_BASE_URL: "ftp://api.example.com" }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("parses valid values and strips trailing slashes", () => {
    const parsed = parseConfig({
      ...valid,
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com///",
      NEXT_PUBLIC_MOCK_BASE_URL: "https://mock.example.com/m/",
      NEXT_PUBLIC_APP_VERSION: "2.4.0",
    });

    expect(parsed.apiBaseUrl).toBe("https://api.example.com");
    expect(parsed.appUrl).toBe("https://mock.example.com");
    expect(parsed.mockBaseUrl).toBe("https://mock.example.com/m");
    expect(parsed.version).toBe("2.4.0");
    expect(parsed.enableMocks).toBe(false);
  });

  it("treats the mock base URL as optional", () => {
    expect(parseConfig(valid).mockBaseUrl).toBeNull();
  });

  it("enables contract mocks only for the literal string true", () => {
    expect(parseConfig({ ...valid, NEXT_PUBLIC_ENABLE_MOCKS: "true" }).enableMocks).toBe(true);
    expect(parseConfig({ ...valid, NEXT_PUBLIC_ENABLE_MOCKS: "1" }).enableMocks).toBe(false);
  });

  it("rejects a base URL with a query string or credentials", () => {
    expect(() =>
      normalizeBaseUrl("NEXT_PUBLIC_API_BASE_URL", "https://x.test/?a=1", {
        required: true,
      }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
    expect(() =>
      normalizeBaseUrl("NEXT_PUBLIC_API_BASE_URL", "https://u:p@x.test", {
        required: true,
      }),
    ).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("falls back to the meta mock base URL at runtime", () => {
    expect(resolveMockBaseUrl("https://api.example.com/m/", null)).toBe(
      "https://api.example.com/m",
    );
    expect(resolveMockBaseUrl("https://api.example.com/m", "https://env.test/m")).toBe(
      "https://env.test/m",
    );
    expect(resolveMockBaseUrl(undefined, null)).toBeNull();
  });

  it("joins URLs without producing duplicate slashes", () => {
    expect(joinUrl("https://api.example.com/m/", "/users")).toBe(
      "https://api.example.com/m/users",
    );
    expect(joinUrl("https://api.example.com/m", "users")).toBe(
      "https://api.example.com/m/users",
    );
  });
});
