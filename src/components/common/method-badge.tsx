import { cn } from "cn";
import type { HttpMethod } from "@/lib/api/generated/schema";

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  POST: "border-lime-300/25 bg-lime-300/10 text-lime-200",
  PUT: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  DELETE: "border-red-400/25 bg-red-400/10 text-red-300",
};

export function MethodBadge({
  method,
  className,
}: {
  method: HttpMethod;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[0.7rem] font-semibold tracking-wide",
        METHOD_STYLES[method],
        className,
      )}
    >
      {method}
    </span>
  );
}
