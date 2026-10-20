"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, deleteLogs, getLogs } from "@/lib/api";
import type { LogEntry } from "@/lib/types";

export interface LogFilters {
  endpointId: string | null;
  status: number | null;
  injected: boolean | null;
}

export interface UseLogsResult {
  items: LogEntry[];
  /** Cursor for the next "older" page. `null` when everything is loaded. */
  nextCursor: number | null;
  latestId: number | null;
  loading: boolean;
  loadingOlder: boolean;
  error: string | null;
  /** Live polling is paused by the user. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
  loadOlder: () => void;
  refresh: () => void;
  clear: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;
const BACKOFF_STEPS_MS = [2000, 4000, 8000, 16000, 30000];

/**
 * Loads the request log for a project.
 *
 * - The first page is fetched with `limit`.
 * - Older entries are loaded with `before=<nextCursor>`.
 * - New entries are polled with `after=<latestId>` every two seconds, and
 *   only while the tab is visible.
 * - A recursive `setTimeout` is used so slow answers cannot stack, and the
 *   interval backs off (2 s → 4 s → 8 s, capped at 30 s) after an error.
 */
export function useLogs(
  slug: string,
  token: string | null,
  filters: LogFilters,
  enabled = true,
): UseLogsResult {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [nonce, setNonce] = useState(0);

  const latestIdRef = useRef<number | null>(null);
  const backoffRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const visibleRef = useRef(true);
  const filterKey = `${filters.endpointId ?? ""}|${filters.status ?? ""}|${filters.injected ?? ""}`;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadPage = useCallback(
    async (mode: "initial" | "older" | "new") => {
      if (!token || !slug || inFlightRef.current) return;
      inFlightRef.current = true;
      if (mode === "initial") setLoading(true);
      if (mode === "older") setLoadingOlder(true);

      try {
        const response = await getLogs(slug, token, {
          limit: 50,
          before: mode === "older" ? nextCursor : null,
          after: mode === "new" ? latestIdRef.current : null,
          endpointId: filters.endpointId,
          status: filters.status,
          injected: filters.injected,
        });

        setItems((previous) => {
          if (mode === "older") {
            const known = new Set(previous.map((entry) => entry.id));
            const older = response.items.filter((entry) => !known.has(entry.id));
            return [...previous, ...older];
          }
          if (mode === "new") {
            if (response.items.length === 0) return previous;
            const known = new Set(previous.map((entry) => entry.id));
            const fresh = response.items
              .filter((entry) => !known.has(entry.id))
              .sort((a, b) => b.id - a.id);
            return [...fresh, ...previous];
          }
          return response.items;
        });

        setNextCursor(response.nextCursor ?? null);
        if (response.latestId !== null && response.latestId !== undefined) {
          latestIdRef.current = response.latestId;
          setLatestId(response.latestId);
        }
        backoffRef.current = 0;
        setError(null);
      } catch (caught) {
        if (caught instanceof ApiError) {
          setError(
            `${caught.problem.code ?? caught.status}: ${caught.problem.detail ?? caught.problem.title ?? "Log request failed."}`,
          );
        } else {
          setError("Could not load the request log.");
        }
        backoffRef.current = Math.min(
          backoffRef.current + 1,
          BACKOFF_STEPS_MS.length - 1,
        );
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingOlder(false);
      }
    },
    [slug, token, nextCursor, filters.endpointId, filters.status, filters.injected],
  );

  // First page. The reset and the fetch run in the same tick, so a filter
  // change never leaves stale entries on screen.
  useEffect(() => {
    if (!enabled || !token) return;
    const timer = window.setTimeout(() => {
      latestIdRef.current = null;
      backoffRef.current = 0;
      setItems([]);
      setNextCursor(null);
      setLatestId(null);
      setError(null);
      void loadPage("initial");
    }, 0);
    return () => window.clearTimeout(timer);
    // `loadPage` is intentionally excluded: it changes on every cursor move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, slug, filterKey, nonce]);

  // Track the tab visibility.
  useEffect(() => {
    const onVisibilityChange = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Live polling. Recursive timeout, visible tab only, never overlapping.
  useEffect(() => {
    if (!enabled || !token || paused) return;

    let active = true;

    const schedule = (delay: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (!active) return;
        if (!visibleRef.current) {
          // Wait for the tab to become visible again.
          schedule(POLL_INTERVAL_MS);
          return;
        }
        void loadPage("new").finally(() => {
          if (!active) return;
          const delay = BACKOFF_STEPS_MS[backoffRef.current] ?? POLL_INTERVAL_MS;
          schedule(delay);
        });
      }, delay);
    };

    schedule(POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, paused, slug, filterKey, nonce, loadPage]);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  const clear = useCallback(async () => {
    if (!token) return;
    await deleteLogs(slug, token);
    setItems([]);
    setNextCursor(null);
    latestIdRef.current = null;
    setLatestId(null);
    refresh();
  }, [slug, token, refresh]);

  return {
    items,
    nextCursor,
    latestId,
    loading,
    loadingOlder,
    error,
    paused,
    setPaused,
    loadOlder: () => {
      if (nextCursor === null) return;
      void loadPage("older");
    },
    refresh,
    clear,
  };
}
