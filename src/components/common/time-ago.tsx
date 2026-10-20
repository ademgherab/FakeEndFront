"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { cn } from "cn";

function relativeLabel(value: string | Date, now: number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absolute < 45) return "just now";
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (absolute < 2_592_000) return formatter.format(Math.round(seconds / 86_400), "day");
  if (absolute < 31_536_000) return formatter.format(Math.round(seconds / 2_592_000), "month");
  return formatter.format(Math.round(seconds / 31_536_000), "year");
}

export function TimeAgo({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const date = value instanceof Date ? value : new Date(value);
  const iso = Number.isNaN(date.getTime()) ? undefined : date.toISOString();

  return (
    <time
      dateTime={iso}
      title={formatDateTime(value)}
      className={cn("text-zinc-400", className)}
      suppressHydrationWarning
    >
      {relativeLabel(value, now)}
    </time>
  );
}
