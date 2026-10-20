"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { MetaResponse } from "@/lib/api/generated/schema";
import { getMeta } from "@/lib/api/meta";
import { AppError, isAppError } from "@/lib/errors";
import { MetaContext } from "@/hooks/use-meta";

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError({
    status: 0,
    code: "unknown_error",
    title: "Could not load API configuration",
    detail: error instanceof Error ? error.message : undefined,
    cause: error,
  });
}

export interface MetaProviderProps {
  children: ReactNode;
  /** Test-only starting point; production reads the session cache. */
  initialData?: MetaResponse | null;
}

/**
 * Loads GET /api/v1/meta once per session, caches it in memory and
 * sessionStorage, and exposes refresh() to consumers.
 *
 * Mount this provider only around routes that need meta (builder/workspace)
 * so the landing page stays fully static.
 */
export function MetaProvider({ children, initialData = null }: MetaProviderProps) {
  const [data, setData] = useState<MetaResponse | null>(initialData);
  const [isLoading, setIsLoading] = useState(initialData === null);
  const [error, setError] = useState<AppError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (force: boolean) => {
    try {
      const meta = await getMeta({ force });
      if (!mounted.current) return;
      setData(meta);
      setError(null);
    } catch (caught) {
      if (!mounted.current) return;
      setError(toAppError(caught));
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // A cached payload still resolves without a network call. Initial loading
    // state already covers the first paint, so no state is set synchronously.
    let active = true;
    void (async () => {
      try {
        const meta = await getMeta();
        if (!active) return;
        setData(meta);
        setError(null);
      } catch (caught) {
        if (!active) return;
        setError(toAppError(caught));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await load(true);
  }, [load]);

  return (
    <MetaContext.Provider value={{ data, isLoading, error, refresh }}>
      {children}
    </MetaContext.Provider>
  );
}
