import { describe, expect, it } from "vitest";
import { evaluateExpiry } from "@/lib/project/expiry";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const HOUR = 60 * 60 * 1_000;

function at(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

describe("evaluateExpiry", () => {
  it("is unknown without a usable date", () => {
    expect(evaluateExpiry(null, NOW)).toMatchObject({
      state: "unknown",
      isExpired: false,
      isWarning: false,
    });
    expect(evaluateExpiry("not-a-date", NOW).state).toBe("unknown");
  });

  it("is active when more than a day remains", () => {
    const info = evaluateExpiry(at(3 * 24 * HOUR), NOW);
    expect(info.state).toBe("active");
    expect(info.isExpired).toBe(false);
    expect(info.isWarning).toBe(false);
    expect(info.msRemaining).toBe(3 * 24 * HOUR);
    expect(info.label).toMatch(/\d+d/);
  });

  it("warns in the final day", () => {
    const info = evaluateExpiry(at(HOUR), NOW);
    expect(info.state).toBe("warning");
    expect(info.isWarning).toBe(true);
    expect(info.isExpired).toBe(false);
    expect(info.label).toBe("1h 0m");
  });

  it("is expired at or after the deadline", () => {
    expect(evaluateExpiry(at(0), NOW)).toMatchObject({
      state: "expired",
      isExpired: true,
      msRemaining: 0,
      label: "Expired",
    });
    expect(evaluateExpiry(at(-HOUR), NOW).isExpired).toBe(true);
  });
});
