import { cn } from "cn";
import { statusCategory } from "@/lib/runtime/request";

function statusStyle(status: number): string {
  if (status === 0) return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  if (status < 300) return "border-lime-300/25 bg-lime-300/10 text-lime-200";
  if (status < 400) return "border-sky-300/25 bg-sky-300/10 text-sky-200";
  if (status < 500) return "border-amber-300/25 bg-amber-300/10 text-amber-200";
  return "border-red-400/25 bg-red-400/10 text-red-300";
}

/**
 * Status is never colour-only: the code and a short category are both text.
 * Injected runtime errors get an extra label so a simulated 503 is never
 * mistaken for a real outage.
 */
export function StatusBadge({
  status,
  injected = false,
  className,
}: {
  status: number;
  injected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold",
        statusStyle(status),
        className,
      )}
    >
      <span>{status === 0 ? "—" : status}</span>
      <span className="font-sans font-medium opacity-80">
        {injected ? "Injected" : statusCategory(status)}
      </span>
    </span>
  );
}
