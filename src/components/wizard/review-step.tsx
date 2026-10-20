"use client";

import { useMemo } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, Loader2Icon, RocketIcon } from "lucide-react";
import { cn } from "cn";
import type { MetaResponse } from "@/lib/api/generated/schema";
import type { AppError } from "@/lib/errors";
import { useWizardStore } from "@/stores/wizard";
import { useRetryAfter } from "@/hooks/use-retry-after";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { validateProjectName } from "@/lib/wizard/validation";
import { formatBytes } from "@/lib/format";
import { ErrorAlert } from "@/components/common/error-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ReviewStepProps {
  meta: MetaResponse;
  isCreating: boolean;
  createError: AppError | null;
  onCreate: () => void;
  onRetry?: () => void;
  onBack: () => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-right font-mono text-xs text-zinc-200">{value}</dd>
    </div>
  );
}

export function ReviewStep({
  meta,
  isCreating,
  createError,
  onCreate,
  onRetry,
  onBack,
}: ReviewStepProps) {
  const projectName = useWizardStore((state) => state.projectName);
  const endpoint = useWizardStore((state) => state.endpoint);
  const setProjectName = useWizardStore((state) => state.setProjectName);
  const { isBlocked } = useRetryAfter(createError);

  const settings = useMemo(
    () => endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta),
    [endpoint.settings, endpoint.method, meta],
  );

  const nameValidation = validateProjectName(
    projectName,
    meta.limits.maxProjectNameLength,
  );
  const nameErrors = createError?.errors?.name ?? [];
  const endpointErrors =
    createError?.errors?.["endpoints[0].path"] ??
    createError?.errors?.["endpoints[0].method"] ??
    [];
  const duplicateEndpoint = createError?.code === "duplicate_endpoint";

  const canCreate =
    nameValidation.valid && !isCreating && !isBlocked && Boolean(endpoint.schema);

  const schemaPreview = endpoint.schema
    ? JSON.stringify(endpoint.schema, null, 2)
    : "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
          Step 2 of 2
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
          Review and create
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-400">
          Check the inferred schema and the defaults. Everything stays editable
          in the project after creation.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Optional, for example Acme sandbox"
          className="mt-2"
          aria-invalid={
            !nameValidation.valid || nameErrors.length > 0 || undefined
          }
          aria-describedby="project-name-help"
          autoComplete="off"
        />
        <p id="project-name-help" className="mt-1.5 text-xs text-zinc-500">
          Optional. Up to {meta.limits.maxProjectNameLength} characters.
        </p>
        {!nameValidation.valid ? (
          <p className="mt-1.5 text-xs text-red-300">{nameValidation.error}</p>
        ) : null}
        {nameErrors.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-red-300">
            {nameErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="endpoint-summary-heading"
        className={cn(
          "rounded-xl border bg-white/[0.02] p-5 sm:p-6",
          duplicateEndpoint || endpointErrors.length > 0
            ? "border-red-400/40"
            : "border-white/10",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="endpoint-summary-heading"
            className="text-base font-semibold text-zinc-100"
          >
            Endpoint
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {endpoint.method}
            </Badge>
            <code className="font-mono text-sm text-zinc-200">{endpoint.path}</code>
          </div>
        </div>

        <dl className="mt-4">
          <SummaryRow
            label="Success status"
            value={String(settings.successStatus)}
          />
          <SummaryRow
            label="Delay"
            value={`${settings.delay.minMs}–${settings.delay.maxMs} ms`}
          />
          <SummaryRow
            label="Random errors"
            value={`${Math.round(settings.errorInjection.rate * 100)}% · ${settings.errorInjection.codes.join(", ")}`}
          />
          <SummaryRow
            label="List size"
            value={`${settings.list.minSize}–${settings.list.maxSize}`}
          />
          <SummaryRow
            label="Pagination"
            value={settings.pagination ? "Enabled" : "Off"}
          />
          <SummaryRow
            label="Seed"
            value={settings.seed === null ? "Random" : String(settings.seed)}
          />
          <SummaryRow
            label="Sample size"
            value={formatBytes(
              new TextEncoder().encode(endpoint.sampleText).length,
            )}
          />
        </dl>

        {endpointErrors.length > 0 ? (
          <ul className="mt-3 space-y-0.5 text-xs text-red-300">
            {endpointErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {endpoint.warnings.length > 0 ? (
        <section
          aria-labelledby="warnings-heading"
          className="rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-5"
        >
          <h3
            id="warnings-heading"
            className="flex items-center gap-2 text-sm font-semibold text-amber-100"
          >
            <AlertTriangleIcon aria-hidden="true" className="size-4" />
            {endpoint.warnings.length} inference warning
            {endpoint.warnings.length === 1 ? "" : "s"}
          </h3>
          <p className="mt-1 text-xs text-amber-100/70">
            Warnings are advisory. You can create the project without changing
            them.
          </p>
          <ul className="mt-3 space-y-2">
            {endpoint.warnings.map((warning, index) => (
              <li
                key={`${warning.path ?? "root"}-${warning.code}-${index}`}
                className="text-sm text-amber-100/80"
              >
                {warning.path ? (
                  <code className="mr-2 rounded bg-black/20 px-1.5 py-0.5 font-mono text-[0.7rem] text-amber-100">
                    {warning.path}
                  </code>
                ) : null}
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="schema-heading"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <h3 id="schema-heading" className="text-base font-semibold text-zinc-100">
          Inferred schema
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          {endpoint.suggestions.length > 0
            ? `${endpoint.suggestions.length} suggestion${endpoint.suggestions.length === 1 ? "" : "s"} are available for the schema editor.`
            : "The schema is sent to the API exactly as inferred."}
        </p>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/10 bg-[#0b0b0e] p-3">
          <pre
            tabIndex={0}
            className="font-mono text-xs leading-5 text-zinc-300"
          >
            <code>{schemaPreview}</code>
          </pre>
        </div>
      </section>

      {createError ? (
        <ErrorAlert
          error={createError}
          title={
            createError.code === "rate_limited"
              ? "Too many create requests"
              : undefined
          }
          onRetry={createError.code === "aborted" ? undefined : onRetry}
        />
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isCreating}
          className="sm:w-auto"
        >
          <ArrowLeftIcon aria-hidden="true" />
          Back to sample
        </Button>

        <Button
          type="button"
          size="lg"
          onClick={onCreate}
          disabled={!canCreate}
          className="sm:min-w-44"
        >
          {isCreating ? (
            <>
              <Loader2Icon aria-hidden="true" className="animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <RocketIcon aria-hidden="true" />
              Create project
            </>
          )}
        </Button>
      </div>

      {!endpoint.schema ? (
        <p className="text-right text-xs text-zinc-500">
          Infer the sample before creating the project.
        </p>
      ) : null}
    </div>
  );
}
