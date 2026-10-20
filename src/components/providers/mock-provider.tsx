"use client";

import { useEffect, useState, type ReactNode } from "react";
import { config } from "@/lib/config";

const MOCKS_ENABLED = config.enableMocks;

/**
 * Starts the MSW contract mocks when `NEXT_PUBLIC_ENABLE_MOCKS=true`.
 *
 * The form is rendered only after the worker is ready, so the first `/meta`
 * request cannot race the service worker registration. In normal builds the
 * provider is a transparent pass-through.
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    MOCKS_ENABLED ? "starting" : "ready",
  );

  useEffect(() => {
    if (!MOCKS_ENABLED) return;
    let cancelled = false;

    void import("@/mocks/browser")
      .then(({ startMocks }) => startMocks())
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!MOCKS_ENABLED || status === "ready") return <>{children}</>;

  if (status === "error") {
    return (
      <main id="main-content" className="mx-auto max-w-xl px-5 py-24">
        <h1 className="text-2xl font-semibold text-zinc-50">Mock mode could not start</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          The contract mocks are enabled but the service worker did not register.
          Run <code className="font-mono text-zinc-200">pnpm dev:mock</code> from a
          secure origin (localhost is allowed), reload, or unset{" "}
          <code className="font-mono text-zinc-200">NEXT_PUBLIC_ENABLE_MOCKS</code>{" "}
          to use the real API.
        </p>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5"
    >
      <p className="text-sm text-zinc-400">Starting the mock API…</p>
    </main>
  );
}
