import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";

const BASE = "http://localhost:5080/api/v1";

function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

describe("apiRequest", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns parsed JSON, status, headers and request id on 200", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { ok: true },
        { headers: { "X-Request-Id": "req_123" } },
      ),
    );

    const response = await apiRequest<{ ok: boolean }>("/meta");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(response.requestId).toBe("req_123");
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/meta`,
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
      }),
    );
  });

  it("returns undefined data for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await apiRequest<void>("/projects/x", { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(response.data).toBeUndefined();
  });

  it("handles problem+json with field errors and traceId", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://example.com/problems/validation",
          title: "Validation failed",
          status: 422,
          detail: "One field is invalid.",
          traceId: "trace_abc",
          errors: {
            "endpoints[0].path": ["Path is required."],
            "name": "Name is too long.",
          },
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/problem+json",
            "X-Request-Id": "req_abc",
          },
        },
      ),
    );

    const error = await apiRequest("/projects", {
      method: "POST",
      body: { name: "x" },
      retry: false,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.status).toBe(422);
    expect(appError.code).toBe("validation_failed");
    expect(appError.traceId).toBe("trace_abc");
    expect(appError.errors).toEqual({
      "endpoints[0].path": ["Path is required."],
      "name": ["Name is too long."],
    });
  });

  it("normalises the runtime error envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            status: 403,
            code: "invalid_token",
            title: "Invalid token",
            message: "The token does not match.",
            injected: false,
            requestId: "runtime_req",
          },
        },
        { status: 403 },
      ),
    );

    const error = (await apiRequest("/projects/x", {
      token: "et_Qm3vSecretValue",
    }).catch((caught: unknown) => caught)) as AppError;

    expect(error.code).toBe("invalid_token");
    expect(error.status).toBe(403);
    expect(error.requestId).toBe("runtime_req");
    expect(error.message).not.toContain("et_Qm3vSecretValue");
  });

  it("parses Retry-After on 429", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "rate_limited", title: "Slow down" }), {
        status: 429,
        headers: { "Retry-After": "7" },
      }),
    );

    const error = (await apiRequest("/infer", {
      method: "POST",
      body: { sample: {} },
      retry: false,
    }).catch((caught: unknown) => caught)) as AppError;

    expect(error.status).toBe(429);
    expect(error.code).toBe("rate_limited");
    expect(error.retryAfter).toBe(7);
  });

  it("retries a GET on network failure at most twice", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = (await apiRequest("/meta", { retryDelayMs: 0 }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error.code).toBe("network_error");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never retries a write", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = (await apiRequest("/projects", {
      method: "POST",
      body: {},
      retryDelayMs: 0,
    }).catch((caught: unknown) => caught)) as AppError;

    expect(error.code).toBe("network_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a timeout from an abort", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = apiRequest("/meta", { timeoutMs: 25, retry: false });
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
  });

  it("reports caller aborts distinctly and does not retry", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = apiRequest("/meta", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("distinguishes 413 from a validation error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ title: "Payload too large" }), {
        status: 413,
      }),
    );

    const error = (await apiRequest("/infer", {
      method: "POST",
      body: {},
      retry: false,
    }).catch((caught: unknown) => caught)) as AppError;

    expect(error.status).toBe(413);
    expect(error.code).toBe("payload_too_large");
  });

  it("only sends Authorization when a token is supplied", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}));

    await apiRequest("/meta");
    const [, firstInit] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(firstInit?.headers).get("Authorization")).toBeNull();

    await apiRequest("/projects/x", { token: "et_secret_value" });
    const [, secondInit] = fetchMock.mock.calls[1] ?? [];
    expect(new Headers(secondInit?.headers).get("Authorization")).toBe(
      "Bearer et_secret_value",
    );
  });

  it("rejects an unreadable success body as invalid_response", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>nope</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(apiRequest("/meta")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
