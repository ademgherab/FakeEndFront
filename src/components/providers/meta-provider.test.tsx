import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MetaProvider } from "@/components/providers/meta-provider";
import { useMeta } from "@/hooks/use-meta";
import { resetMetaCacheForTests } from "@/lib/api/meta";
import { makeMeta } from "@/test/fixtures/meta";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Probe() {
  const { data, isLoading, error, refresh } = useMeta();
  const state = error ? "error" : data ? "ready" : isLoading ? "loading" : "empty";

  return (
    <div>
      <span data-testid="state">{state}</span>
      {data ? <span data-testid="limit">{data.limits.maxSampleBytes}</span> : null}
      <button type="button" onClick={() => void refresh()}>
        refresh
      </button>
    </div>
  );
}

describe("MetaProvider", () => {
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

  it("loads once, then serves the cached payload to a second mount", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(makeMeta()));

    const first = render(
      <MetaProvider>
        <Probe />
      </MetaProvider>,
    );

    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));
    expect(screen.getByTestId("limit")).toHaveTextContent("102400");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.unmount();

    render(
      <MetaProvider>
        <Probe />
      </MetaProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the cache and updates consumers", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(makeMeta()));

    render(
      <MetaProvider>
        <Probe />
      </MetaProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));

    fetchMock.mockImplementation(async () =>
      jsonResponse(
        makeMeta({
          limits: { ...makeMeta().limits, maxSampleBytes: 2048 },
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => expect(screen.getByTestId("limit")).toHaveTextContent("2048"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders a retryable error on failure", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ title: "Unavailable", code: "internal_error" }, 400),
    );

    render(
      <MetaProvider>
        <Probe />
      </MetaProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("error"));

    fetchMock.mockImplementation(async () => jsonResponse(makeMeta()));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));
  });
});
