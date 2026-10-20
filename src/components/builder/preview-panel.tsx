"use client";

import { useState } from "react";
import type { EndpointSettings, Schema } from "@/lib/types";
import { ApiError, previewWithHeaders, type PreviewResult } from "@/lib/api";
import { parsePaginationHeaders, parseLinkHeader } from "@/lib/runtime";
import { ErrorBanner } from "@/components/builder/error-banner";

export interface PreviewPanelProps {
  schema: Schema | null;
  settings: EndpointSettings;
  /** Preview needs an inferred schema and valid settings. */
  enabled: boolean;
  /** Shown next to the panel when the sample changed after the inference. */
  stale?: boolean;
}

/**
 * Optional panel. It calls `POST /api/v1/preview`, which never creates
 * anything, and renders the generated data. A failing preview is contained in
 * this panel: creating and testing keep working.
 */
export function PreviewPanel({
  schema,
  settings,
  enabled,
  stale = false,
}: PreviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<{ code?: string; title?: string; detail?: string } | null>(
    null,
  );
  const [unavailable, setUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const paginationEnabled = settings.pagination?.enabled === true;

  async function runPreview() {
    if (!schema || !enabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await previewWithHeaders({
        schema,
        settings,
        ...(paginationEnabled ? { page, limit } : {}),
      });
      setResult(response);
    } catch (caught) {
      setResult(null);
      // The preview route is optional. A `404` means it is not deployed yet,
      // so the panel hides itself instead of nagging the user.
      if (caught instanceof ApiError && caught.status === 404) {
        setUnavailable(true);
        setError(null);
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.problem
          : { title: caught instanceof Error ? caught.message : "Preview failed." },
      );
    } finally {
      setLoading(false);
    }
  }

  if (unavailable) return null;

  const paginationHeaders = result
    ? parsePaginationHeaders(result.headers)
    : null;
  const link = result ? parseLinkHeader(result.headers.get("Link")) : null;

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">
          Preview data{stale ? " (stale)" : ""}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {paginationEnabled ? (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <label htmlFor="preview-page" className="block text-xs text-zinc-400">
                  Page
                </label>
                <input
                  id="preview-page"
                  type="number"
                  min={1}
                  value={page}
                  onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
                  className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="preview-limit" className="block text-xs text-zinc-400">
                  Limit
                </label>
                <input
                  id="preview-limit"
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                  className="w-16 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none"
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void runPreview();
            }}
            disabled={!enabled || loading}
            aria-busy={loading}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Previewing…" : "Preview data"}
          </button>
        </div>
      </div>

      {!enabled ? (
        <p className="text-xs text-zinc-400">
          Infer a schema and fix the settings to preview the generated data.
        </p>
      ) : null}

      <ErrorBanner error={error} />

      {result ? (
        <details className="rounded-lg border border-white/10 bg-black/20" open>
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-200">
            Generated response
          </summary>
          <pre className="max-h-72 overflow-auto border-t border-white/10 p-3 font-mono text-xs leading-5 text-zinc-200">
            {JSON.stringify(result.data, null, 2)}
          </pre>
          {result.pagination ? (
            <div className="border-t border-white/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Pagination
              </p>
              <pre className="mt-1 overflow-auto font-mono text-xs leading-5 text-zinc-300">
                {JSON.stringify(result.pagination, null, 2)}
              </pre>
            </div>
          ) : null}
          {paginationHeaders ? (
            <div className="border-t border-white/10 p-3 text-xs text-zinc-400">
              <p>
                X-Total-Count: {paginationHeaders.totalCount ?? "—"} · X-Page:{" "}
                {paginationHeaders.page ?? "—"} · X-Limit:{" "}
                {paginationHeaders.limit ?? "—"} · X-Total-Pages:{" "}
                {paginationHeaders.totalPages ?? "—"}
              </p>
              {link ? (
                <ul className="mt-1 space-y-0.5 font-mono text-zinc-300">
                  {(["first", "prev", "next", "last"] as const).map((relation) =>
                    link[relation] ? (
                      <li key={relation} className="break-all">
                        {relation}: {link[relation]}
                      </li>
                    ) : null,
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
