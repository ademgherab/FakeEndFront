"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";

export interface RetryAfterCountdownProps {
  seconds: number;
  onElapsed?: () => void;
  className?: string;
}

/**
 * Visible countdown for a 429 Retry-After window. The inner component is keyed
 * by `seconds` so a fresh error remounts it with a clean countdown instead of
 * resetting state from an effect.
 */
export function RetryAfterCountdown(props: RetryAfterCountdownProps) {
  return <RetryAfterWindow key={props.seconds} {...props} />;
}

function RetryAfterWindow({
  seconds,
  onElapsed,
  className,
}: RetryAfterCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil(seconds)),
  );
  const elapsedRef = useRef(false);

  const notifyElapsed = useCallback(() => {
    if (elapsedRef.current) return;
    elapsedRef.current = true;
    onElapsed?.();
  }, [onElapsed]);

  useEffect(() => {
    if (remaining <= 0) {
      notifyElapsed();
      return;
    }

    const timer = window.setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [remaining, notifyElapsed]);

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("text-xs font-medium text-amber-200", className)}
    >
      {remaining > 0
        ? `Try again in ${remaining} second${remaining === 1 ? "" : "s"}.`
        : "You can try again now."}
    </p>
  );
}
