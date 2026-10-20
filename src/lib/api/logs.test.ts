import { describe, expect, it } from "vitest";
import { normalizeLogsResponse } from "@/lib/api/logs";

describe("normalizeLogsResponse (RUN-03)", () => {
  it("normalizes a canonical cursor page", () => {
    const response = normalizeLogsResponse({
      items: [
        {
          id: "log_1",
          timestamp: "2026-10-20T12:00:00.000Z",
          method: "POST",
          path: "/users",
          status: 201,
          endpointId: "ep_1",
          endpointPath: "/users",
          injected: false,
          injectedError: null,
          delayMs: 0,
          latencyMs: 12,
          requestId: "req_1",
          requestBody: { name: "Ada" },
          query: "?page=2",
          userAgent: "vitest",
          byteSize: 42,
        },
      ],
      nextCursor: "log_1",
    });

    expect(response.nextCursor).toBe("log_1");
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      id: "log_1",
      method: "POST",
      status: 201,
      endpointId: "ep_1",
      endpointPath: "/users",
      requestBody: { name: "Ada" },
      query: "?page=2",
    });
  });

  it("accepts snake_case aliases and nested endpoint data", () => {
    const response = normalizeLogsResponse({
      logs: [
        {
          endpoint_id: "ep_2",
          endpoint: { id: "ep_2", path: "/items/{id}" },
          endpoint_path: "/items/{id}",
          request_id: "req_2",
          injected_error: "rate_limit",
          request_body: "raw text",
          query_string: "?q=1",
          user_agent: "curl",
          delay_ms: 10,
          latency_ms: 25,
          byte_size: 8,
          created_at: "2026-10-20T12:00:01.000Z",
          method: "get",
          status: 200,
        },
      ],
      next_cursor: "cursor_2",
    });

    expect(response.nextCursor).toBe("cursor_2");
    expect(response.items[0]).toMatchObject({
      requestId: "req_2",
      method: "GET",
      endpointId: "ep_2",
      endpointPath: "/items/{id}",
      injected: true,
      injectedError: "rate_limit",
      requestBody: "raw text",
      query: "?q=1",
      userAgent: "curl",
      delayMs: 10,
      latencyMs: 25,
      byteSize: 8,
    });
  });

  it("normalizes query objects to a search string", () => {
    const response = normalizeLogsResponse({
      entries: [
        {
          id: "log_3",
          method: "GET",
          path: "/search",
          query: { q: "ada", page: 2, skip: null },
        },
      ],
    });
    expect(response.items[0]?.query).toBe("q=ada&page=2");
  });

  it("uses nested endpoint ids and derives a stable fallback id", () => {
    const response = normalizeLogsResponse({
      data: [
        {
          endpoint: { id: "ep_3" },
          path: "/derived",
          method: "DELETE",
          status: 204,
          timestamp: "2026-10-20T12:00:02.000Z",
        },
      ],
    });
    expect(response.items[0]?.endpointId).toBe("ep_3");
    expect(response.items[0]?.id).toBe(
      "2026-10-20T12:00:02.000Z-DELETE-/derived-204-0",
    );
  });

  it("drops non-object entries and empty payloads safely", () => {
    expect(normalizeLogsResponse({ items: [null, 1, "x", {}] }).items).toHaveLength(1);
    expect(normalizeLogsResponse(null)).toEqual({ items: [], nextCursor: null });
    expect(normalizeLogsResponse({ logs: [] })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
