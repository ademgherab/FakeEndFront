"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

function parts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function label(ms: number): string {
  if (ms <= 0) return "expired";
  const { days, hours, minutes, seconds } = parts(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function RelativeCountdown({
  target,
  className,
  prefix,
  expiredLabel = "expired",
  onExpire,
}: {
  target: string | Date | number;
  className?: string;
  prefix?: string;
  expiredLabel?: string;
  onExpire?: () => void;
}) {
  const targetMs =
    typeof target === "number"
      ? target
      : (target instanceof Date ? target : new Date(target)).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Number.isFinite(targetMs) && targetMs <= now) onExpire?.();
  }, [now, onExpire, targetMs]);

  if (!Number.isFinite(targetMs)) {
    return <span className={className}>unknown</span>;
  }

  const remaining = targetMs - now;
  const value = remaining <= 0 ? expiredLabel : label(remaining);

  return (
    <span className={cn("tabular-nums", className)} aria-live="polite">
      {prefix}
      {value}
    </span>
  );
}
