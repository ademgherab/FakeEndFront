import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectLogEntry } from "@/lib/api/generated/schema";
import { listLogs } from "@/lib/api/logs";
import { AppError } from "@/lib/errors";
import {
  LOG_POLL_INTERVAL_MS,
  LOG_POLL_MAX_BACKOFF_MS,
  useLogsPolling,
} from "@/hooks/use-logs-polling";

vi.mock("@/lib/api/logs", () => ({
  listLogs: vi.fn(),
}));

const mockedListLogs = vi.mocked(listLogs);

function log(id: string): ProjectLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    method: "GET",
    path: "/users",
    status: 200,
    endpointId: "ep_1",
    endpointPath: "/users",
    injected: false,
    injectedError: null,
    delayMs: 0,
    latencyMs: 4,
    requestId: id,
    requestBody: null,
    query: null,
    userAgent: null,
    byteSize: 20,
  };
}

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  mockedListLogs.mockReset();
  mockedListLogs.mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(() => {
  vi.useRealTimers();
});

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function lastQuery() {
  return mockedListLogs.mock.calls.at(-1)?.[2];
}

describe("useLogsPolling (RUN-04)", () => {
  it("polls with after=<latestId> on a recursive 2 s timeout", async () => {
    const onEntries = vi.fn();
    const { unmount } = renderHook(() =>
      useLogsPolling({
        slug: "demo",
        token: "et_demo",
        latestId: "log_000001",
        knownIds: ["log_000001"],
        onEntries,
      }),
    );

    await flush();
    expect(mockedListLogs).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toMatchObject({
      after: "log_000001",
      endpointId: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOG_POLL_INTERVAL_MS - 1);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("dedupes by id, emits only new rows and advances the cursor", async () => {
    const onEntries = vi.fn();
    mockedListLogs
      .mockResolvedValueOnce({
        items: [log("log_000003"), log("log_000002"), log("log_000001")],
        nextCursor: null,
      })
      .mockResolvedValue({ items: [], nextCursor: null });

    renderHook(() =>
      useLogsPolling({
        slug: "demo",
        token: "et_demo",
        latestId: "log_000001",
        knownIds: ["log_000001"],
        onEntries,
      }),
    );

    await flush();
    expect(onEntries).toHaveBeenCalledTimes(1);
    expect(onEntries.mock.calls[0]?.[0].map((entry: ProjectLogEntry) => entry.id)).toEqual([
      "log_000003",
      "log_000002",
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOG_POLL_INTERVAL_MS);
    });
    expect(lastQuery()).toMatchObject({ after: "log_000003" });
  });

  it("makes no requests while hidden and polls immediately on return", async () => {
    const { result, unmount } = renderHook(() =>
      useLogsPolling({
        slug: "demo",
        token: "et_demo",
        latestId: null,
        knownIds: [],
        onEntries: vi.fn(),
      }),
    );

    await flush();
    expect(mockedListLogs).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("hidden");
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("visible");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("backs off 2 → 4 → 8 s (capped at 30 s) and recovers without a reload", async () => {
    const failure = new AppError({
      status: 500,
      code: "internal_error",
      title: "Service unavailable",
    });
    mockedListLogs
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ items: [], nextCursor: null });

    const { result, unmount } = renderHook(() =>
      useLogsPolling({
        slug: "demo",
        token: "et_demo",
        latestId: "log_000001",
        knownIds: ["log_000001"],
        onEntries: vi.fn(),
      }),
    );

    await flush();
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.retryInMs).toBe(2_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(2);
    expect(result.current.retryInMs).toBe(4_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(3);
    expect(result.current.retryInMs).toBe(8_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(4);
    expect(result.current.status).toBe("live");
    expect(result.current.retryInMs).toBeNull();
    expect(result.current.error).toBeNull();

    expect(LOG_POLL_MAX_BACKOFF_MS).toBe(30_000);
    unmount();
  });

  it("supports manual pause/resume and cleans up requests on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useLogsPolling({
        slug: "demo",
        token: "et_demo",
        latestId: null,
        knownIds: [],
        onEntries: vi.fn(),
      }),
    );

    await flush();
    const afterMount = mockedListLogs.mock.calls.length;

    await act(async () => {
      result.current.pause();
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(afterMount);

    await act(async () => {
      result.current.resume();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedListLogs.mock.calls.length).toBeGreaterThan(afterMount);

    unmount();
    const afterUnmount = mockedListLogs.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedListLogs).toHaveBeenCalledTimes(afterUnmount);
  });
});
