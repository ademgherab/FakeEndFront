"use client";

import { TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { RetryAfterCountdown } from "@/components/common/retry-after-countdown";
import { useRetryAfter } from "@/hooks/use-retry-after";
import { explainError, isAppError } from "@/lib/errors";

export interface ErrorAlertProps {
  error: unknown;
  onRetry?: () => void;
  /** Overrides the mapped title when the surrounding field adds context. */
  title?: string;
  className?: string;
  compact?: boolean;
}

/**
 * The single inline error surface. Known codes get curated copy; unknown codes
 * fall back to redacted server text. 429s show a countdown and disable retry.
 */
export function ErrorAlert({
  error,
  onRetry,
  title,
  className,
  compact = false,
}: ErrorAlertProps) {
  const copy = explainError(error);
  const appError = isAppError(error) ? error : null;
  const { isBlocked } = useRetryAfter(error);
  const traceId = appError?.traceId ?? null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm",
        compact && "p-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlertIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-red-300"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-red-100">{title ?? copy.title}</p>
          <p className="text-red-100/80">{copy.message}</p>
          {copy.action ? (
            <p className="text-red-100/70">{copy.action}</p>
          ) : null}

          {appError?.retryAfter !== null && appError?.retryAfter !== undefined ? (
            <RetryAfterCountdown
              seconds={appError.retryAfter}
              className="text-amber-200"
            />
          ) : null}

          {traceId ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-red-100/70">
              <span>Reference:</span>
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.7rem] text-red-100">
                {traceId}
              </code>
              <CopyButton
                value={traceId}
                label="Copy error reference"
                toastMessage="Reference copied."
                variant="ghost"
                size="xs"
                className="text-red-100/80"
              />
            </div>
          ) : null}

          {onRetry ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isBlocked}
              >
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
