"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react";
import type { ProjectLogEntry } from "@/lib/api/generated/schema";
import { listLogs } from "@/lib/api/logs";
import { AppError, isAppError } from "@/lib/errors";
import { CopyButton } from "@/components/common/copy-button";
import { ErrorAlert } from "@/components/common/error-alert";
import { MethodBadge } from "@/components/common/method-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-project";
import { useLogsPolling } from "@/hooks/use-logs-polling";
import {
  formatBytes,
  formatClockTime,
  formatDuration,
  formatUtcDateTime,
} from "@/lib/format";

const PAGE_SIZE = 50;
const MAX_DETAIL_BODY = 8_000;

function toAppError(caught: unknown): AppError {
  return isAppError(caught)
    ? caught
    : new AppError({
        status: 0,
        code: "unknown_error",
        title: "Could not load request logs",
        cause: caught,
      });
}

function formatBody(value: ProjectLogEntry["requestBody"]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function LogSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading logs">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function LogDetail({
  log,
  slug,
  onClose,
}: {
  log: ProjectLogEntry | null;
  slug: string;
  onClose: () => void;
}) {
  const body = log ? formatBody(log.requestBody) : null;
  const truncated = body !== null && body.length > MAX_DETAIL_BODY;
  const href = log?.endpointId
    ? `/p/${slug}/endpoints/${encodeURIComponent(log.endpointId)}`
    : null;

  return (
    <Dialog
      open={log !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request detail</DialogTitle>
          <DialogDescription>
            One runtime call, including the headers the browser was allowed to
            read.
          </DialogDescription>
        </DialogHeader>

        {log ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method={log.method} />
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-200">
                {log.path}
              </code>
              <StatusBadge status={log.status} injected={log.injected} />
            </div>

            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Time</dt>
                <dd>
                  <time
                    dateTime={log.timestamp}
                    title={formatUtcDateTime(log.timestamp)}
                  >
                    {formatClockTime(log.timestamp)}
                  </time>
                  <span className="block text-[0.7rem] text-zinc-500">
                    {formatUtcDateTime(log.timestamp)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Endpoint</dt>
                <dd className="break-all font-mono text-zinc-300">
                  {log.endpointPath ?? log.path}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Delay</dt>
                <dd>
                  {log.delayMs !== null ? formatDuration(log.delayMs) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Latency</dt>
                <dd>
                  {log.latencyMs !== null ? formatDuration(log.latencyMs) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Injected</dt>
                <dd>
                  {log.injected ? (
                    <span className="text-amber-200">
                      {log.injectedError
                        ? `Yes — ${log.injectedError}`
                        : "Yes"}
                    </span>
                  ) : (
                    "No"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Response size</dt>
                <dd>
                  {log.byteSize !== null ? formatBytes(log.byteSize) : "—"}
                </dd>
              </div>
            </dl>

            {log.query ? (
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">
                  Query string
                </h3>
                <code className="mt-1 block break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-300">
                  {log.query}
                </code>
              </div>
            ) : null}

            {log.userAgent ? (
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">
                  User agent
                </h3>
                <p className="mt-1 break-all text-xs text-zinc-400">
                  {log.userAgent}
                </p>
              </div>
            ) : null}

            {log.requestId ? (
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">
                  Request ID
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded bg-black/30 px-2 py-1 font-mono text-xs text-zinc-300">
                    {log.requestId}
                  </code>
                  <CopyButton
                    value={log.requestId}
                    label="Copy request ID"
                    toastMessage="Request ID copied."
                    variant="ghost"
                    size="xs"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-200">
                  Request body
                </h3>
                {body ? (
                  <span className="text-[0.7rem] text-zinc-500">
                    {formatBytes(new TextEncoder().encode(body).length)}
                  </span>
                ) : null}
              </div>
              {body ? (
                <>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-zinc-300">
                    <code>
                      {truncated ? body.slice(0, MAX_DETAIL_BODY) : body}
                    </code>
                  </pre>
                  {truncated ? (
                    <p className="mt-1 text-xs text-amber-300">
                      Showing the first {MAX_DETAIL_BODY.toLocaleString("en-US")}{" "}
                      characters.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  This request had no body.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {href ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link href={href}>
                      Open endpoint
                      <ArrowUpRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`${href}?tab=try-it`}>Replay in Try it</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export interface LogsViewProps {
  /** When set, the first page is filtered to this endpoint (PRJ-06). */
  endpointId?: string;
  endpointPath?: string;
  heading?: string;
  /**
   * RUN-04: the endpoint workspace keeps hidden tabs mounted, so it turns
   * polling off explicitly when the user leaves the Logs tab.
   */
  pollingEnabled?: boolean;
}

/**
 * RUN-03/RUN-04: request log table with cursor pagination and live polling.
 * The first page uses no cursor; older pages use `nextCursor` as `before`.
 * Rows are keyed by their stable ids.
 */
export function LogsView({
  endpointId,
  endpointPath,
  heading,
  pollingEnabled = true,
}: LogsViewProps) {
  const { slug, token } = useProject();
  const [entries, setEntries] = useState<ProjectLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [olderError, setOlderError] = useState<AppError | null>(null);
  const [selected, setSelected] = useState<ProjectLogEntry | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const requestRef = useRef(0);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const handleNewEntries = useCallback((fresh: ProjectLogEntry[]) => {
    if (fresh.length === 0) return;
    setEntries((current) => {
      const seen = new Set(current.map((entry) => entry.id));
      const added = fresh.filter((entry) => !seen.has(entry.id));
      return added.length === 0 ? current : [...added, ...current];
    });
    setNewIds((current) => {
      const next = new Set(current);
      for (const entry of fresh) next.add(entry.id);
      return next;
    });
    if (highlightTimer.current !== null) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => {
      setNewIds(new Set<string>());
      highlightTimer.current = null;
    }, 4_000);
  }, []);

  const loadFirst = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError(null);
      setOlderError(null);

      try {
        const response = await listLogs(
          slug,
          token,
          { limit: PAGE_SIZE, endpointId: endpointId ?? null },
          { signal },
        );
        if (requestRef.current !== requestId || signal?.aborted) return;
        setEntries(response.items);
        setNextCursor(response.nextCursor);
      } catch (caught) {
        if (requestRef.current !== requestId || signal?.aborted) return;
        if (isAppError(caught) && caught.code === "aborted") return;
        setError(toAppError(caught));
      } finally {
        if (requestRef.current === requestId && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [endpointId, slug, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Defer the first request so the effect body itself does not trigger a
    // synchronous state update (cascading render) on mount.
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadFirst(controller.signal);
    });
    return () => controller.abort();
  }, [loadFirst]);

  const latestId = entries[0]?.id ?? null;
  const knownIds = useMemo(
    () => entries.map((entry) => entry.id),
    [entries],
  );
  const polling = useLogsPolling({
    slug,
    token,
    endpointId: endpointId ?? null,
    latestId,
    knownIds,
    onEntries: handleNewEntries,
    // Wait for the first page so a poll cannot replace a newer response with
    // an older one. An initial load error stays paused until the user retries.
    enabled: pollingEnabled && !loading && error === null,
  });

  async function loadOlder() {
    if (!token || !nextCursor || loadingOlder) return;
    const requestId = requestRef.current;
    setLoadingOlder(true);
    setOlderError(null);

    try {
      const response = await listLogs(slug, token, {
        limit: PAGE_SIZE,
        endpointId: endpointId ?? null,
        before: nextCursor,
      });
      if (requestRef.current !== requestId) return;
      // Appending never moves rows already on screen, so the user's scroll
      // position is preserved naturally.
      setEntries((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        const appended = response.items.filter((entry) => !seen.has(entry.id));
        return [...current, ...appended];
      });
      setNextCursor(response.nextCursor);
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      if (isAppError(caught) && caught.code === "aborted") return;
      setOlderError(toAppError(caught));
    } finally {
      if (requestRef.current === requestId) setLoadingOlder(false);
    }
  }

  if (loading && entries.length === 0) {
    return <LogSkeleton />;
  }

  if (error && entries.length === 0) {
    return (
      <div className="space-y-3">
        <ErrorAlert
          error={error}
          title="Could not load request logs"
          onRetry={() => {
            void loadFirst();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            {heading ?? (endpointId ? "Calls to this endpoint" : "Request logs")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {endpointPath
              ? `${endpointPath} · newest first`
              : "Newest first. Older pages load without refreshing the table."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void loadFirst();
          }}
          disabled={loading}
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={loading ? "animate-spin" : undefined}
          />
          Refresh
        </Button>
      </div>

      {pollingEnabled ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs"
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span
              aria-hidden="true"
              className={
                polling.status === "live"
                  ? "size-1.5 rounded-full bg-lime-300"
                  : polling.status === "reconnecting"
                    ? "size-1.5 animate-pulse rounded-full bg-amber-300"
                    : "size-1.5 rounded-full bg-zinc-500"
              }
            />
            {polling.status === "live"
              ? "Live"
              : polling.status === "reconnecting"
                ? `Reconnecting in ${Math.max(1, Math.ceil((polling.retryInMs ?? 0) / 1_000))}s`
                : polling.status === "paused"
                  ? "Live paused"
                  : "Live updates off"}
          </span>
          <span className="text-zinc-500">
            {polling.status === "reconnecting"
              ? "Keeping the last good cursor. New calls appear when the API recovers."
              : polling.paused
                ? "Resume to keep new calls coming in."
                : "New calls appear automatically every 2 seconds while this tab is visible."}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {polling.status === "reconnecting" ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={polling.pollNow}
              >
                Retry now
              </Button>
            ) : null}
            {polling.paused ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={polling.resume}
              >
                <PlayIcon aria-hidden="true" />
                Resume live
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={polling.pause}
                disabled={!pollingEnabled || loading}
              >
                <PauseIcon aria-hidden="true" />
                Pause live
              </Button>
            )}
          </span>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollTextIcon aria-hidden="true" />}
          title="No requests logged yet"
          description={
            endpointId
              ? "Call this endpoint from Try it or from your own app. Requests appear here, newest first."
              : "Call any endpoint URL from Try it or your app. The first request appears here with its status, delay and injected-error state."
          }
          action={
            endpointId ? (
              <Button asChild size="sm">
                <Link
                  href={`/p/${slug}/endpoints/${encodeURIComponent(endpointId)}?tab=try-it`}
                >
                  Open Try it
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[54rem] border-collapse text-left text-xs">
              <caption className="sr-only">
                Request logs, newest first
              </caption>
              <thead className="bg-white/[0.03] text-zinc-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Time</th>
                  <th scope="col" className="px-3 py-2 font-medium">Method</th>
                  <th scope="col" className="px-3 py-2 font-medium">Path</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Injected</th>
                  <th scope="col" className="px-3 py-2 font-medium">Delay</th>
                  <th scope="col" className="px-3 py-2 font-medium">Latency</th>
                  <th scope="col" className="px-3 py-2 font-medium">Endpoint</th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((log) => (
                  <tr
                    key={log.id}
                    data-new={newIds.has(log.id) ? "true" : undefined}
                    tabIndex={0}
                    onClick={() => setSelected(log)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelected(log);
                    }}
                    className={`cursor-pointer border-t border-white/10 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-300/50 ${
                      newIds.has(log.id)
                        ? "bg-lime-300/[0.07] motion-safe:animate-pulse"
                        : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                      <time
                        dateTime={log.timestamp}
                        title={formatUtcDateTime(log.timestamp)}
                      >
                        {formatClockTime(log.timestamp)}
                      </time>
                    </td>
                    <td className="px-3 py-2">
                      <MethodBadge method={log.method} />
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-zinc-200">
                      {log.path}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={log.status}
                        injected={log.injected}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {log.injected ? (
                        <span
                          className="text-amber-200"
                          title={log.injectedError ?? "Injected by the mock"}
                        >
                          Injected
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                      {log.delayMs !== null ? formatDuration(log.delayMs) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                      {log.latencyMs !== null
                        ? formatDuration(log.latencyMs)
                        : "—"}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-zinc-500">
                      {log.endpointPath ?? log.endpointId ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={`View request ${log.requestId ?? log.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(log);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              {entries.length.toLocaleString("en-US")} loaded
              {nextCursor === null ? " · all entries loaded" : ""}
            </p>
            {nextCursor !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadOlder();
                }}
                disabled={loadingOlder}
              >
                <ArrowDownIcon aria-hidden="true" />
                {loadingOlder ? "Loading older…" : "Load older"}
              </Button>
            ) : null}
          </div>

          {olderError ? (
            <ErrorAlert
              error={olderError}
              title="Could not load older entries"
              compact
              onRetry={() => {
                void loadOlder();
              }}
            />
          ) : null}
        </>
      )}

      {error && entries.length > 0 ? (
        <ErrorAlert
          error={error}
          title="Could not refresh the log table"
          compact
          onRetry={() => {
            void loadFirst();
          }}
        />
      ) : null}

      <LogDetail log={selected} slug={slug} onClose={() => setSelected(null)} />
    </div>
  );
}
