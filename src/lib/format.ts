const BYTE_UNITS = ["B", "KB", "MB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = BYTE_UNITS[unitIndex] ?? "B";
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export function formatBytesExact(bytes: number): string {
  return `${bytes.toLocaleString("en-US")} bytes`;
}

/** `et_Qm3v…` — never the full value. */
export function maskToken(token: string): string {
  if (!token) return "";
  const visible = token.slice(0, 7);
  return `${visible}…`;
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatUtcDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

/** Request/response timing: `84 ms`, `1.4 s`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** Local clock time with seconds, used in the log table. */
export function formatClockTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/** `just now`, `3 min ago`, `2 days ago`. */
export function formatRelativeTime(
  value: string | Date,
  now: number = Date.now(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const seconds = Math.round((date.getTime() - now) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
    style: "short",
  });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["week", 7 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export type CountdownTone = "active" | "warning" | "expired";

export interface Countdown {
  tone: CountdownTone;
  label: string;
  msRemaining: number;
}

/**
 * Compact countdown for project expiry. Days/hours while there is room,
 * minutes/seconds in the final hour. Invalid dates are treated as expired.
 */
export function formatCountdown(
  target: string | Date,
  now: number = Date.now(),
): Countdown {
  const date = target instanceof Date ? target : new Date(target);
  if (Number.isNaN(date.getTime())) {
    return { tone: "expired", label: "Unknown expiry", msRemaining: 0 };
  }

  const msRemaining = date.getTime() - now;
  if (msRemaining <= 0) {
    return { tone: "expired", label: "Expired", msRemaining: 0 };
  }

  const totalSeconds = Math.floor(msRemaining / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s`;
  else label = `${seconds}s`;

  return {
    tone: msRemaining <= 24 * 60 * 60 * 1_000 ? "warning" : "active",
    label,
    msRemaining,
  };
}

/** Clamp a usage ratio to 0..1 for the progress bar. */
export function usageRatio(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(1, Math.max(0, used / limit));
}

