"use client";

import { useEffect, useMemo, useState } from "react";
import { isAppError } from "@/lib/errors";

export interface RetryAfterState {
  /** Seconds left before the action is allowed again. */
  remaining: number;
  isBlocked: boolean;
}

interface CountdownState {
  key: string;
  remaining: number;
}

/**
 * Tracks the Retry-After window on a 429 (or any error carrying retryAfter).
 * The countdown is per error, so a fresh 429 restarts it. A changed error is
 * picked up during render (React's keyed-state adjustment pattern) instead of
 * resetting state from an effect.
 */
export function useRetryAfter(error: unknown): RetryAfterState {
  const initial = useMemo(() => {
    if (!isAppError(error) || typeof error.retryAfter !== "number") return 0;
    return Math.max(0, Math.ceil(error.retryAfter));
  }, [error]);

  const key = useMemo(() => {
    if (!isAppError(error)) return "";
    return `${error.code}:${error.retryAfter ?? ""}:${error.requestId ?? ""}`;
  }, [error]);

  const [countdown, setCountdown] = useState<CountdownState>({
    key,
    remaining: initial,
  });

  if (countdown.key !== key) {
    setCountdown({ key, remaining: initial });
  }

  const remaining = countdown.key === key ? countdown.remaining : initial;

  useEffect(() => {
    if (remaining <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((previous) =>
        previous.key === key
          ? { ...previous, remaining: previous.remaining <= 1 ? 0 : previous.remaining - 1 }
          : previous,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [key, remaining]);

  return { remaining, isBlocked: remaining > 0 };
}
