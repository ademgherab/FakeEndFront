"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectLogEntry } from "@/lib/api/generated/schema";
import { listLogs } from "@/lib/api/logs";
import { isAppError } from "@/lib/errors";

/** Cursor polling (RUN-04): a new call appears within ~2–4 s. */
export const LOG_POLL_INTERVAL_MS = 2_000;
export const LOG_POLL_MAX_BACKOFF_MS = 30_000;

export type LogPollingStatus =
  | "live"
  | "paused"
  | "reconnecting"
  | "disabled";

export interface UseLogsPollingOptions {
  slug: string;
  token: string | null;
  endpointId?: string | null;
  /** Newest id currently loaded; polling starts after it. */
  latestId: string | null;
  /** Ids already on screen, used to dedupe overlapping responses. */
  knownIds: readonly string[];
  /** Called with only the entries that were not on screen yet. */
  onEntries: (entries: ProjectLogEntry[]) => void;
  /** Additional entries per poll. */
  limit?: number;
  enabled?: boolean;
}

export interface UseLogsPollingResult {
  status: LogPollingStatus;
  paused: boolean;
  error: unknown | null;
  /** Delay until the next attempt while status is `reconnecting`. */
  retryInMs: number | null;
  pause: () => void;
  resume: () => void;
  /** Ask for an immediate poll without restarting the page. */
  pollNow: () => void;
}

const FATAL_CODES = new Set([
  "missing_token",
  "invalid_token",
  "project_not_found",
  "project_expired",
  "endpoint_not_found",
]);

function nextBackoff(failures: number): number {
  return Math.min(
    LOG_POLL_MAX_BACKOFF_MS,
    LOG_POLL_INTERVAL_MS * 2 ** Math.min(failures, 5),
  );
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * Recursive `setTimeout` polling with:
 * - `after=<latestId>` cursors and no overlapping requests,
 * - an immediate fetch when the tab becomes visible,
 * - no requests at all while hidden or manually paused,
 * - 2 → 4 → 8 s error backoff capped at 30 s,
 * - full timer/abort cleanup on unmount or when `enabled` turns false.
 *
 * The last successful cursor survives errors, and superseded responses are
 * discarded by both the abort signal and a request counter.
 */
export function useLogsPolling({
  slug,
  token,
  endpointId = null,
  latestId,
  knownIds,
  onEntries,
  limit = 50,
  enabled = true,
}: UseLogsPollingOptions): UseLogsPollingResult {
  const [paused, setPaused] = useState(false);
  const [pollStatus, setPollStatus] = useState<LogPollingStatus>(
    enabled ? (isHidden() ? "paused" : "live") : "disabled",
  );
  const [error, setError] = useState<unknown | null>(null);
  const [retryInMs, setRetryInMs] = useState<number | null>(null);
  const [manualTick, setManualTick] = useState(0);

  const cursorRef = useRef<string | null>(latestId);
  const latestIdRef = useRef<string | null>(latestId);
  const seenRef = useRef(new Set<string>(knownIds));
  const onEntriesRef = useRef(onEntries);
  const requestIdRef = useRef(0);

  useEffect(() => {
    onEntriesRef.current = onEntries;
  }, [onEntries]);

  useEffect(() => {
    latestIdRef.current = latestId;
  }, [latestId]);

  // A refresh or an incoming batch moves the cursor forward. It never moves
  // backwards, so a slow first-page request cannot replay old entries.
  useEffect(() => {
    if (latestId && latestId !== cursorRef.current) {
      cursorRef.current = latestId;
    }
  }, [latestId]);

  useEffect(() => {
    for (const id of knownIds) seenRef.current.add(id);
  }, [knownIds]);

  const pause = useCallback(() => {
    setPaused(true);
    setPollStatus("paused");
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setError(null);
    setRetryInMs(null);
    setPollStatus("live");
  }, []);

  const pollNow = useCallback(() => {
    if (paused || !enabled) return;
    setManualTick((tick) => tick + 1);
  }, [enabled, paused]);

  useEffect(() => {
    if (!enabled || !token || paused) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let failures = 0;

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function schedule(ms: number) {
      clearTimer();
      if (disposed) return;
      timer = setTimeout(() => {
        timer = null;
        void tick();
      }, ms);
    }

    async function tick() {
      if (disposed || inFlight) return;

      if (isHidden()) {
        setPollStatus("paused");
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      inFlight = controller;

      try {
        const response = await listLogs(
          slug,
          token as string,
          {
            limit,
            endpointId: endpointId ?? null,
            after: cursorRef.current ?? latestIdRef.current,
          },
          { signal: controller.signal },
        );

        if (
          disposed ||
          controller.signal.aborted ||
          requestIdRef.current !== requestId
        ) {
          return;
        }

        const fresh = response.items.filter(
          (entry) => !seenRef.current.has(entry.id),
        );
        for (const entry of fresh) seenRef.current.add(entry.id);

        // The API returns newest first; the first fresh id is the new cursor.
        const newest = response.items[0]?.id;
        if (newest) cursorRef.current = newest;

        if (fresh.length > 0) onEntriesRef.current(fresh);

        failures = 0;
        setError(null);
        setRetryInMs(null);
        setPollStatus("live");
        schedule(LOG_POLL_INTERVAL_MS);
      } catch (caught) {
        if (disposed || controller.signal.aborted) return;
        if (isAppError(caught) && caught.code === "aborted") return;

        setError(caught);

        if (isAppError(caught) && FATAL_CODES.has(caught.code)) {
          setPollStatus("paused");
          setRetryInMs(null);
          return;
        }

        failures += 1;
        const delay = nextBackoff(failures - 1);
        setRetryInMs(delay);
        setPollStatus("reconnecting");
        schedule(delay);
      } finally {
        if (inFlight === controller) inFlight = null;
      }
    }

    function onVisibilityChange() {
      if (isHidden()) {
        setPollStatus("paused");
        clearTimer();
        if (inFlight) {
          const controller = inFlight;
          inFlight = null;
          controller.abort();
        }
        return;
      }

      // Returning to the tab polls immediately, not after the old interval.
      setPollStatus("live");
      setError(null);
      setRetryInMs(null);
      void tick();
    }

    if (!isHidden()) void tick();

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      requestIdRef.current += 1;
      clearTimer();
      if (inFlight) {
        const controller = inFlight;
        inFlight = null;
        controller.abort();
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // `manualTick` intentionally restarts the loop for "check now".
  }, [enabled, token, slug, endpointId, limit, paused, manualTick]);

  const status: LogPollingStatus = !enabled
    ? "disabled"
    : !token || paused
      ? "paused"
      : pollStatus;

  return {
    status,
    paused,
    error,
    retryInMs,
    pause,
    resume,
    pollNow,
  };
}
