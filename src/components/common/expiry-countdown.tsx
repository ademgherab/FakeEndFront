"use client";

import { cn } from "cn";
import { useNow } from "@/hooks/use-now";
import { evaluateExpiry } from "@/lib/project/expiry";
import { formatUtcDateTime } from "@/lib/format";

export interface ExpiryCountdownProps {
  expiresAt: string;
  className?: string;
  /** Show the full sentence used in banners. */
  verbose?: boolean;
}

/** Local countdown with a UTC tooltip; never renders a mismatched SSR value. */
export function ExpiryCountdown({
  expiresAt,
  className,
  verbose = false,
}: ExpiryCountdownProps) {
  const now = useNow();

  if (now === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400",
          className,
        )}
      >
        Expires {formatUtcDateTime(expiresAt)}
      </span>
    );
  }

  const info = evaluateExpiry(expiresAt, now);
  const tone =
    info.state === "warning"
      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
      : info.state === "expired"
        ? "border-red-400/30 bg-red-400/10 text-red-200"
        : "border-white/10 bg-white/[0.03] text-zinc-300";

  return (
    <span
      title={`Expires ${formatUtcDateTime(expiresAt)}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {verbose
        ? info.isExpired
          ? "This project has expired"
          : info.isWarning
            ? `Expires in ${info.label}`
            : `Active for ${info.label}`
        : info.isExpired
          ? "Expired"
          : `Expires in ${info.label}`}
    </span>
  );
}
