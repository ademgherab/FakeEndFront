import { formatCountdown, type CountdownTone } from "@/lib/format";

export type ExpiryState = "active" | "warning" | "expired" | "unknown";

export interface ExpiryInfo {
  state: ExpiryState;
  tone: CountdownTone;
  label: string;
  msRemaining: number;
  isExpired: boolean;
  /** True in the final 24 hours before expiry. */
  isWarning: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/** One place decides what "expiring" means for every badge and banner. */
export function evaluateExpiry(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): ExpiryInfo {
  if (!expiresAt) {
    return {
      state: "unknown",
      tone: "expired",
      label: "Unknown expiry",
      msRemaining: 0,
      isExpired: false,
      isWarning: false,
    };
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return {
      state: "unknown",
      tone: "expired",
      label: "Unknown expiry",
      msRemaining: 0,
      isExpired: false,
      isWarning: false,
    };
  }

  const countdown = formatCountdown(date, now);
  if (countdown.msRemaining <= 0) {
    return {
      state: "expired",
      tone: "expired",
      label: "Expired",
      msRemaining: 0,
      isExpired: true,
      isWarning: false,
    };
  }

  const isWarning = countdown.msRemaining <= DAY_MS;
  return {
    state: isWarning ? "warning" : "active",
    tone: countdown.tone,
    label: countdown.label,
    msRemaining: countdown.msRemaining,
    isExpired: false,
    isWarning,
  };
}
