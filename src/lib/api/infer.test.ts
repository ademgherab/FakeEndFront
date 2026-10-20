import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inferSchema, normalizeInferResponse } from "@/lib/api/infer";
import { AppError } from "@/lib/errors";

const validSchema = {
  version: 1,
  root: { name: "root", type: "object", fields: [] },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("normalizeInferResponse", () => {
  it("keeps the schema, warnings and suggestions", () => {
    const response = normalizeInferResponse({
      schema: validSchema,
      warnings: [
        { path: "/id", code: "constant_value", message: "All ids are 1." },
        { path: 3, code: "ignored", message: "bad entry" },
      ],
      suggestions: [
        { path: "/id", code: "use_uuid", message: "Try UUIDs.", generator: "string.uuid" },
      ],
    });

    expect(response.schema).toEqual(validSchema);
    expect(response.warnings).toHaveLength(1);
    expect(response.suggestions?.[0]?.generator).toBe("string.uuid");
  });

  it("rejects a malformed schema", () => {
    expect(() => normalizeInferResponse({ schema: { version: 2 } })).toThrow(
      /malformed schema/i,
    );
  });
});

describe("inferSchema", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the sample and wrap option without a token", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ schema: validSchema, warnings: [], suggestions: [] }),
    );

    const result = await inferSchema({
      sample: [{ id: 1 }],
      options: { wrapInList: true },
    });

    expect(result.schema).toEqual(validSchema);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://localhost:5080/api/v1/infer");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      options: { wrapInList: true },
    });
  });

  it("maps a 422 sample_invalid and keeps the user on the step", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Invalid sample", code: "sample_invalid" }),
        { status: 422 },
      ),
    );

    const error = (await inferSchema({ sample: {} }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("sample_invalid");
    expect(error.status).toBe(422);
  });

  it("maps 429 with a retry window", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "rate_limited" }), {
        status: 429,
        headers: { "Retry-After": "5" },
      }),
    );

    const error = (await inferSchema({ sample: {} }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error.code).toBe("rate_limited");
    expect(error.retryAfter).toBe(5);
  });

  it("does not retry an infer write", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = (await inferSchema({ sample: {} }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error.code).toBe("network_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
