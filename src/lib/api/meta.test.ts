import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMeta,
  normalizeMeta,
  readCachedMeta,
  resetMetaCacheForTests,
} from "@/lib/api/meta";
import { AppError } from "@/lib/errors";
import { makeMeta } from "@/test/fixtures/meta";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("normalizeMeta", () => {
  it("accepts a complete payload", () => {
    const meta = normalizeMeta(makeMeta());
    expect(meta.methods).toEqual(["GET", "POST", "PUT", "DELETE"]);
    expect(meta.limits.maxSampleBytes).toBe(102_400);
    expect(meta.mockBaseUrl).toBe("https://api.example.com/m");
  });

  it("rejects a malformed response with a readable field name", () => {
    expect(() => normalizeMeta({})).toThrow(/limit|methods|mockBaseUrl/i);
    expect(() => normalizeMeta({ ...makeMeta(), limits: {} })).toThrow(
      /maxSampleBytes/,
    );
    expect(() => normalizeMeta({ ...makeMeta(), mockBaseUrl: "not-a-url" })).toThrow(
      /mockBaseUrl/,
    );
  });

  it("throws an AppError for a malformed response", () => {
    try {
      normalizeMeta({ methods: ["GET"] });
      throw new Error("expected normalizeMeta to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("invalid_response");
    }
  });
});

describe("meta cache", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetMetaCacheForTests();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes exactly one request per session", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(makeMeta()));

    const first = await getMeta();
    const second = await getMeta();

    expect(first.mockBaseUrl).toBe(second.mockBaseUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readCachedMeta()?.limits.maxSampleBytes).toBe(102_400);
  });

  it("manual refresh bypasses the cache", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(makeMeta()));

    await getMeta();
    await getMeta({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
