"use client";

import { useCallback, useEffect, useState } from "react";
import { getLiveness, getReadiness } from "@/lib/api";

export type BackendState = "checking" | "live" | "offline";

export interface BackendHealth {
  state: BackendState;
  /** `GET /health/ready` answered `200`: PostgreSQL is reachable. */
  ready: boolean;
  error: string | null;
  refresh: () => void;
}

interface Probe {
  nonce: number;
  state: BackendState;
  ready: boolean;
  error: string | null;
}

/**
 * Probes the public health routes once on mount.
 *
 * The health routes are the only implemented backend routes right now, so
 * they are the honest signal for "is the API up and is CORS configured".
 * The UI never blocks on it: the builder still works when the probe fails.
 */
export function useBackendHealth(): BackendHealth {
  const [nonce, setNonce] = useState(0);
  const [probe, setProbe] = useState<Probe>({
    nonce: 0,
    state: "checking",
    ready: false,
    error: null,
  });

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await getLiveness();
      } catch (cause) {
        if (!active) return;
        setProbe({
          nonce,
          state: "offline",
          ready: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Cannot reach the API. Is the backend running?",
        });
        return;
      }
      if (!active) return;
      setProbe({ nonce, state: "live", ready: false, error: null });

      try {
        await getReadiness();
      } catch {
        // Readiness needs PostgreSQL. A `503` is a valid answer, not a crash.
        if (!active) return;
      }
      if (!active) return;
      setProbe((current) => ({ ...current, ready: true }));
    })();

    return () => {
      active = false;
    };
  }, [nonce]);

  // A newer probe is running: the previous answer is stale.
  const state = probe.nonce === nonce ? probe.state : "checking";

  return {
    state,
    ready: probe.nonce === nonce ? probe.ready : false,
    error: probe.nonce === nonce ? probe.error : null,
    refresh,
  };
}
