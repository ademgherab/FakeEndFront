"use client";

import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/common/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta } from "@/hooks/use-meta";

function MetaSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading API configuration…</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Blocks only the routes that need meta. A failure always offers a retry
 * instead of rendering a blank page.
 */
export function MetaGate({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refresh } = useMeta();

  if (error && !data) {
    return (
      <ErrorAlert
        error={error}
        onRetry={() => {
          void refresh();
        }}
        title="Could not load the API limits"
      />
    );
  }

  if (!data) {
    return isLoading ? <MetaSkeleton /> : null;
  }

  return (
    <>
      {error ? (
        <ErrorAlert
          error={error}
          onRetry={() => {
            void refresh();
          }}
          title="Could not refresh the API limits"
          className="mb-6"
          compact
        />
      ) : null}
      {children}
    </>
  );
}
