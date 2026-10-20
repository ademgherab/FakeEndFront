"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import type {
  EndpointSettings,
  PreviewResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { AppError, isAppError } from "@/lib/errors";
import { previewEndpoint } from "@/lib/api/preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/common/error-alert";
import { JsonViewer } from "@/components/common/json-viewer";
import { formatBytesExact } from "@/lib/format";

export interface PreviewPanelProps {
  schema: Schema | null;
  settings: EndpointSettings | null;
  className?: string;
}

export function PreviewPanel({ schema, settings, className }: PreviewPanelProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(settings?.pagination?.defaultLimit ?? 10);
  const [refreshKey, setRefreshKey] = useState(0);

  const paginationOn = settings?.pagination != null;
  const effectiveLimit = settings?.pagination
    ? Math.min(Math.max(limit, 1), settings.pagination.maxLimit)
    : limit;

  useEffect(() => {
    if (!schema || !settings) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void previewEndpoint(
        {
          schema,
          settings,
          ...(paginationOn ? { page, limit: effectiveLimit } : {}),
        },
        { signal: controller.signal },
      )
        .then((response) => {
          if (!controller.signal.aborted) setPreview(response);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          if (isAppError(caught) && caught.code === "aborted") return;
          setError(
            isAppError(caught)
              ? caught
              : new AppError({ status: 0, code: "unknown_error", cause: caught }),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [schema, settings, page, effectiveLimit, paginationOn, refreshKey]);

  const content = useMemo(() => {
    if (!schema || !settings) {
      return (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-zinc-400">
          Infer a schema and review settings to generate a preview.
        </p>
      );
    }
    if (loading && !preview) {
      return (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4" aria-label="Loading preview">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      );
    }
    if (error) {
      return <ErrorAlert error={error} onRetry={() => setRefreshKey((key) => key + 1)} />;
    }
    if (!preview) return null;
    return <JsonViewer value={preview.body} label="Preview response" />;
  }, [schema, settings, loading, preview, error]);

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span>
            Status <code className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-200">{settings?.successStatus ?? "—"}</code>
          </span>
          {preview?.byteSize !== undefined ? (
            <span>{formatBytesExact(preview.byteSize)}</span>
          ) : null}
          {settings?.seed !== null && settings?.seed !== undefined ? (
            <span>Seed {settings.seed} · repeatable</span>
          ) : (
            <span>Random output each request</span>
          )}
          {loading ? (
            <span className="inline-flex items-center gap-1 text-lime-300">
              <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" />
              Generating…
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {settings?.pagination ? (
            <>
              <label className="space-y-1 text-[0.68rem] text-zinc-400">
                <span className="block">Page</span>
                <Input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(event) => setPage(Math.max(1, Number(event.target.value || 1)))}
                  className="h-7 w-20"
                />
              </label>
              <label className="space-y-1 text-[0.68rem] text-zinc-400">
                <span className="block">Limit</span>
                <Input
                  type="number"
                  min={1}
                  max={settings.pagination.maxLimit}
                  value={effectiveLimit}
                  onChange={(event) =>
                    setLimit(
                      Math.max(
                        1,
                        Math.min(
                          settings.pagination?.maxLimit ?? 1,
                          Number(event.target.value || 1),
                        ),
                      ),
                    )
                  }
                  className="h-7 w-20"
                />
              </label>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={!schema || !settings || loading}
          >
            <RefreshCwIcon aria-hidden="true" />
            Regenerate
          </Button>
        </div>
      </div>
      {content}
    </div>
  );
}
