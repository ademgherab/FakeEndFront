"use client";

import { useState } from "react";
import type { Endpoint, Project } from "@/lib/types";
import { useLogs, type LogFilters } from "@/hooks/use-logs-polling";

export interface LogsViewerProps {
  project: Project;
  token: string;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusTone(status: number): string {
  if (status >= 500) return "text-red-300";
  if (status >= 400) return "text-amber-300";
  if (status >= 200 && status < 300) return "text-lime-300";
  return "text-zinc-300";
}

export function LogsViewer({ project, token }: LogsViewerProps) {
  const [endpointFilter, setEndpointFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [injectedOnly, setInjectedOnly] = useState(false);

  const filters: LogFilters = {
    endpointId: endpointFilter || null,
    status: statusFilter ? Number(statusFilter) : null,
    injected: injectedOnly ? true : null,
  };

  const logs = useLogs(project.slug, token, filters);

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Request log</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => logs.setPaused(!logs.paused)}
            aria-pressed={logs.paused}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
          >
            {logs.paused ? "Resume live" : "Pause live"}
          </button>
          <button
            type="button"
            onClick={logs.refresh}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              void logs.clear();
            }}
            className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-400/10"
          >
            Clear log
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="log-endpoint" className="block text-xs text-zinc-400">
            Endpoint
          </label>
          <select
            id="log-endpoint"
            value={endpointFilter}
            onChange={(event) => setEndpointFilter(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
          >
            <option value="">All endpoints</option>
            {project.endpoints.map((endpoint: Endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.method} {endpoint.path}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="log-status" className="block text-xs text-zinc-400">
            Status
          </label>
          <input
            id="log-status"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 503"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={injectedOnly}
              onChange={(event) => setInjectedOnly(event.target.checked)}
              className="size-3.5 rounded border-white/20 bg-transparent accent-lime-300"
            />
            Injected errors only
          </label>
        </div>
      </div>

      {logs.error ? (
        <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
          {logs.error}
        </p>
      ) : null}

      {logs.loading ? (
        <p className="text-xs text-zinc-400">Loading the request log…</p>
      ) : null}

      {!logs.loading && logs.items.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No requests recorded yet. Call the mock URL and the entries appear
          here.
        </p>
      ) : null}

      {logs.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-zinc-400">
              <tr className="border-b border-white/10">
                <th scope="col" className="py-2 pr-3 font-medium">Time</th>
                <th scope="col" className="py-2 pr-3 font-medium">Method</th>
                <th scope="col" className="py-2 pr-3 font-medium">Path</th>
                <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="py-2 pr-3 font-medium">Delay</th>
                <th scope="col" className="py-2 pr-3 font-medium">Latency</th>
                <th scope="col" className="py-2 font-medium">Request ID</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-300">
              {logs.items.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{formatTime(entry.createdAt)}</td>
                  <td className="py-1.5 pr-3">{entry.method}</td>
                  <td className="py-1.5 pr-3">
                    <span className="break-all">{entry.path}</span>
                    {entry.query ? (
                      <span className="break-all text-zinc-500">?{entry.query}</span>
                    ) : null}
                  </td>
                  <td className={`py-1.5 pr-3 ${statusTone(entry.status)}`}>
                    {entry.status}
                    {entry.injectedError ? (
                      <span className="ml-1 rounded border border-amber-400/40 bg-amber-400/10 px-1 text-[10px] font-semibold text-amber-200">
                        injected
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3">
                    {entry.delayMs === null ? "—" : `${entry.delayMs} ms`}
                  </td>
                  <td className="py-1.5 pr-3">
                    {entry.latencyMs === null ? "—" : `${entry.latencyMs} ms`}
                  </td>
                  <td className="py-1.5 break-all text-zinc-400">
                    {entry.requestId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {logs.nextCursor !== null ? (
        <button
          type="button"
          onClick={logs.loadOlder}
          disabled={logs.loadingOlder}
          aria-busy={logs.loadingOlder}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logs.loadingOlder ? "Loading…" : "Load older entries"}
        </button>
      ) : null}
    </section>
  );
}
