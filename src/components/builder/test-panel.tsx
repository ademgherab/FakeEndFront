"use client";

import { useState } from "react";
import type { Endpoint, Project } from "@/lib/types";
import { callRuntime, type RuntimeCall } from "@/lib/runtime";

export interface TestPanelProps {
  project: Project;
  endpoint?: Endpoint | null;
  /** Overrides the endpoint method (used while the builder is not created yet). */
  method?: Endpoint["method"];
}

function buildUrl(base: string, page: number | null, limit: number | null): string {
  if (page === null && limit === null) return base;
  const params = new URLSearchParams();
  if (page !== null) params.set("page", String(page));
  if (limit !== null) params.set("limit", String(limit));
  const search = params.toString();
  return search ? `${base}${base.includes("?") ? "&" : "?"}${search}` : base;
}

export function TestPanel({ project, endpoint, method }: TestPanelProps) {
  const [testing, setTesting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [state, setState] = useState<RuntimeCall | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | null>(null);
  const [paginate, setPaginate] = useState(false);

  const target = endpoint ?? project.endpoints[0] ?? null;
  const url = target?.url ?? project.baseUrl;
  const requestMethod = method ?? target?.method ?? "GET";
  const paginationEnabled = target?.settings?.pagination?.enabled === true;

  async function test() {
    setTesting(true);
    setNetworkError(null);
    try {
      const result = await callRuntime({
        url: buildUrl(url, paginate ? page : null, paginate ? limit : null),
        method: requestMethod,
      });
      setState(result);
    } catch {
      setNetworkError(
        `Cannot reach the mock URL. Is the backend running and is CORS enabled? Attempted: ${url}`,
      );
      setState(null);
    } finally {
      setTesting(false);
    }
  }

  const simulated = state?.injected === true;

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Test endpoint</h2>

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={test}
          disabled={testing}
          aria-busy={testing}
          className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test endpoint"}
        </button>

        {paginationEnabled ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={paginate}
                onChange={(event) => setPaginate(event.target.checked)}
                className="size-3.5 rounded border-white/20 bg-transparent accent-lime-300"
              />
              Pagination
            </label>
            <div className="space-y-1">
              <label htmlFor="test-page" className="block text-xs text-zinc-400">
                Page
              </label>
              <input
                id="test-page"
                type="number"
                min={1}
                value={page}
                disabled={!paginate}
                onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
                className="w-20 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-zinc-100 outline-none disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="test-limit" className="block text-xs text-zinc-400">
                Limit
              </label>
              <input
                id="test-limit"
                type="number"
                min={1}
                value={limit ?? target?.settings?.pagination?.defaultLimit ?? 10}
                disabled={!paginate}
                onChange={(event) => setLimit(Number(event.target.value) || 1)}
                className="w-20 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-zinc-100 outline-none disabled:opacity-50"
              />
            </div>
          </div>
        ) : null}
      </div>

      {networkError ? (
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/[0.06] p-3 text-sm text-red-100">
          {networkError}
        </p>
      ) : null}

      {state ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black/40 px-3 py-1.5 font-mono text-sm text-zinc-100">
              {state.status} {state.statusText}
            </span>
            {simulated ? (
              <span className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                simulated
              </span>
            ) : null}
            <span className="text-xs text-zinc-400">{state.latencyMs.toFixed(0)} ms</span>
          </div>

          <dl className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-black/40 px-3 py-2">
              <dt className="text-zinc-400">X-Request-Id</dt>
              <dd className="mt-0.5 break-all font-mono text-zinc-200">{state.requestId ?? "—"}</dd>
            </div>
            <div className="rounded-lg bg-black/40 px-3 py-2">
              <dt className="text-zinc-400">X-Mock-Delay-Ms</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">{state.delayMs ?? "—"}</dd>
            </div>
            <div className="rounded-lg bg-black/40 px-3 py-2">
              <dt className="text-zinc-400">X-Mock-Injected-Error</dt>
              <dd className="mt-0.5 font-mono text-zinc-200">
                {state.injected ? "true" : "—"}
              </dd>
            </div>
          </dl>

          {state.pagination ? (
            <dl className="grid gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-black/40 px-3 py-2">
                <dt className="text-zinc-400">X-Total-Count</dt>
                <dd className="mt-0.5 font-mono text-zinc-200">
                  {state.pagination.totalCount ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-black/40 px-3 py-2">
                <dt className="text-zinc-400">X-Page</dt>
                <dd className="mt-0.5 font-mono text-zinc-200">
                  {state.pagination.page ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-black/40 px-3 py-2">
                <dt className="text-zinc-400">X-Limit</dt>
                <dd className="mt-0.5 font-mono text-zinc-200">
                  {state.pagination.limit ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-black/40 px-3 py-2">
                <dt className="text-zinc-400">X-Total-Pages</dt>
                <dd className="mt-0.5 font-mono text-zinc-200">
                  {state.pagination.totalPages ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          {state.link ? (
            <div className="rounded-lg bg-black/40 px-3 py-2 text-xs">
              <p className="text-zinc-400">Link</p>
              <ul className="mt-1 space-y-0.5 font-mono text-zinc-300">
                {(["first", "prev", "next", "last"] as const).map((relation) =>
                  state.link?.[relation] ? (
                    <li key={relation} className="break-all">
                      {relation}: {state.link[relation]}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          {state.runtimeError ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-100">
              <p className="font-semibold">
                {state.runtimeError.code}: {state.runtimeError.title}
              </p>
              <p className="mt-1">{state.runtimeError.message}</p>
              <p className="mt-1 text-xs text-amber-100/70">
                Request ID: {state.runtimeError.requestId}
              </p>
              {state.retryAfter ? (
                <p className="mt-1 text-xs text-amber-100/70">
                  Retry-After: {state.retryAfter}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Body
            </p>
            <pre className="max-h-72 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 text-zinc-200">
              {state.isJson && state.json !== null
                ? JSON.stringify(state.json, null, 2)
                : state.body || "(empty body)"}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
