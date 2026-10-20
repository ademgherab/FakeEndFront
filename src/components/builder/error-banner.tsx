"use client";

import type { ApiError } from "@/lib/api";

export interface ErrorBannerProps {
  error: ApiError["problem"] | null;
  /** Field errors keyed by field name, rendered as a list. */
  errors?: Record<string, string[]>;
}

/**
 * Single inline API error surface. Shows `code` and `detail` when present,
 * never a generic "Something went wrong".
 */
export function ErrorBanner({ error, errors }: ErrorBannerProps) {
  if (!error && (!errors || Object.keys(errors).length === 0)) return null;

  const detail = error?.detail?.trim() ?? "";
  const fieldErrors = Object.entries(errors ?? {})
    .flatMap(([, messages]) => messages)
    .filter((message) => message.trim() !== detail);

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm"
    >
      {error?.code || error?.title ? (
        <p className="font-semibold text-red-100">
          {error.code ? `${error.code}: ` : ""}
          {error.title ?? ""}
        </p>
      ) : null}
      {error?.detail ? <p className="mt-1 text-red-100/80">{error.detail}</p> : null}
      {fieldErrors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-100/70">
          {fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
