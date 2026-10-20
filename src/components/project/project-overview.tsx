"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  GaugeIcon,
  LayersIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
} from "lucide-react";
import type { ProjectEndpoint } from "@/lib/api/generated/schema";
import { CopyButton } from "@/components/common/copy-button";
import { ExpiryCountdown } from "@/components/common/expiry-countdown";
import { MethodBadge } from "@/components/common/method-badge";
import { AddEndpointDialog } from "@/components/project/add-endpoint-dialog";
import { DeleteEndpointButton } from "@/components/project/delete-endpoint-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta } from "@/hooks/use-meta";
import { useNow } from "@/hooks/use-now";
import { useProject } from "@/hooks/use-project";
import {
  formatDateTime,
  formatRelativeTime,
  formatUtcDateTime,
  usageRatio,
} from "@/lib/format";
import { evaluateExpiry } from "@/lib/project/expiry";

function settingsSummary(endpoint: ProjectEndpoint): string {
  const settings = endpoint.settings;
  if (!settings) return "Default settings";

  const parts: string[] = [];
  if (settings.delay.maxMs > 0) {
    parts.push(
      settings.delay.minMs === settings.delay.maxMs
        ? `${settings.delay.minMs} ms delay`
        : `${settings.delay.minMs}–${settings.delay.maxMs} ms delay`,
    );
  } else {
    parts.push("No delay");
  }

  if (settings.errorInjection.rate > 0) {
    parts.push(
      `${Math.round(settings.errorInjection.rate * 10) / 10}% errors`,
    );
  } else {
    parts.push("No injected errors");
  }

  if (settings.pagination) {
    parts.push(
      `${settings.pagination.totalItems} items · ${settings.pagination.defaultLimit}/page`,
    );
  } else {
    parts.push(`list ${settings.list.minSize}–${settings.list.maxSize}`);
  }

  if (settings.seed !== null) parts.push(`seed ${settings.seed}`);
  return parts.join(" · ");
}

function EndpointCard({
  endpoint,
  basePath,
  canMutate,
  now,
}: {
  endpoint: ProjectEndpoint;
  basePath: string;
  canMutate: boolean;
  now: number | null;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="truncate font-mono text-sm text-zinc-100">
            {endpoint.path}
          </code>
        </div>
        {endpoint.updatedAt && now !== null ? (
          <span
            className="shrink-0 text-[0.7rem] text-zinc-500"
            title={formatUtcDateTime(endpoint.updatedAt)}
          >
            {formatRelativeTime(endpoint.updatedAt, now)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-hidden rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">
          {endpoint.url}
        </code>
        <CopyButton
          value={endpoint.url}
          label={`Copy ${endpoint.method} ${endpoint.path} URL`}
          toastMessage="Endpoint URL copied."
          variant="ghost"
          size="xs"
          className="shrink-0"
        />
      </div>

      <p className="mt-3 flex-1 text-xs leading-5 text-zinc-500">
        {settingsSummary(endpoint)}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`${basePath}/endpoints/${encodeURIComponent(endpoint.id)}?tab=schema`}
          >
            Open endpoint
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        </Button>
        {canMutate ? (
          <DeleteEndpointButton
            endpointId={endpoint.id}
            endpointPath={endpoint.path}
          />
        ) : null}
      </div>
    </article>
  );
}

function StatCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
        <span className="text-zinc-400" aria-hidden="true">
          {icon}
        </span>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** PRJ-02: project home. Values come from GET /projects/{slug} and /meta. */
export function ProjectOverview() {
  const { slug, token, project, refresh, isRefreshing, setProject } = useProject();
  const {
    data: meta,
    error: metaError,
    isLoading: metaLoading,
    refresh: refreshMeta,
  } = useMeta();
  const now = useNow();
  const [addOpen, setAddOpen] = useState(false);

  const basePath = useMemo(() => `/p/${slug}`, [slug]);

  if (!project) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const endpointCount = project.endpoints.length;
  const maxEndpoints = meta?.limits.maxEndpointsPerProject ?? null;
  const atLimit = maxEndpoints !== null && endpointCount >= maxEndpoints;
  const expiry = now === null ? null : evaluateExpiry(project.expiresAt, now);
  const isExpired = expiry?.isExpired ?? false;

  const usage = project.usage
    ? {
        used: project.usage.requestsToday,
        limit: project.usage.dailyLimit,
        resetsAt: project.usage.resetsAt,
      }
    : project.quota
      ? {
          used: Math.max(0, project.quota.limit - project.quota.remaining),
          limit: project.quota.limit,
          resetsAt: project.quota.resetsAt,
        }
      : null;
  const ratio = usage ? usageRatio(usage.used, usage.limit) : 0;
  const capped = usage ? usage.used >= usage.limit : false;

  const addDisabledReason = !meta
    ? metaLoading
      ? "Endpoint limits are still loading."
      : "Endpoint limits are unavailable. Retry the limits request."
    : atLimit
      ? `This project can have at most ${maxEndpoints} endpoint${maxEndpoints === 1 ? "" : "s"}.`
      : isExpired
        ? "Expired projects are read-only."
        : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project overview"
        title={project.name?.trim() || "Untitled project"}
        description={`Slug ${project.slug} · created ${formatDateTime(project.createdAt ?? project.expiresAt)}`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void refresh();
              }}
              disabled={isRefreshing}
            >
              <RefreshCwIcon
                aria-hidden="true"
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={Boolean(addDisabledReason)}
              title={addDisabledReason ?? undefined}
            >
              <PlusIcon aria-hidden="true" />
              Add endpoint
            </Button>
          </>
        }
      />

      {expiry?.isWarning && !isExpired ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-sm text-amber-100"
        >
          <AlertTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <div>
            <p className="font-semibold">
              This project expires in under 24 hours.
            </p>
            <p className="mt-1 text-amber-100/80">
              Save what you need or create a new project. Expired projects stop
              answering after the grace period.
            </p>
          </div>
        </div>
      ) : null}

      {isExpired ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-100"
        >
          <p className="font-semibold">This project has expired.</p>
          <p className="mt-1 text-red-100/80">
            Read-only data may still be visible during the grace period. Create
            a new project to keep testing.
          </p>
        </div>
      ) : null}

      {addDisabledReason && !isExpired ? (
        <p className="text-xs text-zinc-500">{addDisabledReason}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ServerIcon className="size-3.5" />} label="Base URL">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">
              {project.baseUrl}
            </code>
            <CopyButton
              value={project.baseUrl}
              label="Copy base URL"
              toastMessage="Base URL copied."
              variant="ghost"
              size="xs"
            />
          </div>
        </StatCard>

        <StatCard
          icon={<CalendarClockIcon className="size-3.5" />}
          label="Lifetime"
        >
          <ExpiryCountdown expiresAt={project.expiresAt} />
          <p className="mt-1 text-[0.7rem] text-zinc-500">
            {formatUtcDateTime(project.expiresAt)}
          </p>
        </StatCard>

        <StatCard icon={<GaugeIcon className="size-3.5" />} label="Usage today">
          {usage ? (
            <>
              <p className="font-mono text-sm text-zinc-200">
                {usage.used.toLocaleString("en-US")} /{" "}
                {usage.limit.toLocaleString("en-US")}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={Math.min(usage.used, usage.limit)}
                aria-label="Daily request usage"
              >
                <div
                  className={
                    capped
                      ? "h-full rounded-full bg-red-400"
                      : ratio > 0.8
                        ? "h-full rounded-full bg-amber-300"
                        : "h-full rounded-full bg-lime-300"
                  }
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[0.7rem] text-zinc-500">
                {capped
                  ? "Quota exhausted"
                  : `${Math.round(ratio * 100)}% used`}
                {usage.resetsAt
                  ? ` · resets ${formatUtcDateTime(usage.resetsAt)}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Not reported by the API.</p>
          )}
        </StatCard>

        <StatCard icon={<LayersIcon className="size-3.5" />} label="Endpoints">
          <p className="font-mono text-sm text-zinc-200">
            {endpointCount}
            {maxEndpoints !== null ? ` / ${maxEndpoints}` : ""}
          </p>
          <p className="mt-1 text-[0.7rem] text-zinc-500">
            {maxEndpoints === null
              ? "Limit unavailable"
              : atLimit
                ? "Limit reached"
                : "Room for another endpoint"}
          </p>
        </StatCard>
      </div>

      {metaError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-3 text-xs text-amber-100">
          <span>Could not load endpoint limits from /meta.</span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              void refreshMeta();
            }}
          >
            Retry limits
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="endpoints-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="endpoints-heading"
              className="text-base font-semibold text-zinc-100"
            >
              Endpoints
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Each endpoint returns fresh data from its own URL.
            </p>
          </div>
        </div>

        {endpointCount === 0 ? (
          <EmptyState
            icon={<LayersIcon aria-hidden="true" />}
            title="No endpoints yet"
            description="Add the first endpoint to get a live mock URL. You can paste a small JSON sample and refine the schema afterwards."
            action={
              isExpired ? (
                <Button asChild>
                  <Link href="/new">Create a new project</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  disabled={Boolean(addDisabledReason)}
                  title={addDisabledReason ?? undefined}
                >
                  <PlusIcon aria-hidden="true" />
                  Add endpoint
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {project.endpoints.map((endpoint) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                basePath={basePath}
                canMutate={!isExpired}
                now={now}
              />
            ))}
          </div>
        )}
      </section>

      {meta ? (
        <AddEndpointDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          slug={slug}
          token={token ?? ""}
          baseUrl={project.baseUrl}
          meta={meta}
          existingEndpoints={project.endpoints}
          onCreated={(created) => {
            setProject({
              ...project,
              endpoints: [...project.endpoints, created],
            });
            setAddOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
