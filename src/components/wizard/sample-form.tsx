"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { LoaderCircleIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import type { AppError } from "@/lib/errors";
import type { HttpMethod, MetaResponse } from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/common/error-alert";
import { sampleTemplates } from "@/lib/wizard/templates";
import {
  analyzeSample,
  describeWrapInList,
  validatePath,
} from "@/lib/wizard/validation";
import { formatBytes, formatBytesExact } from "@/lib/format";

const JsonEditor = dynamic(() => import("@/components/wizard/json-editor"), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Loading JSON editor">
      <Skeleton className="h-[280px] w-full rounded-xl" />
    </div>
  ),
});

export interface SampleFormProps {
  sampleText: string;
  method: HttpMethod;
  path: string;
  wrapInList: boolean;
  meta: MetaResponse;
  inferring?: boolean;
  error?: AppError | null;
  /** Server field errors keyed by `path`, `method`, `sample` or dotted variants. */
  fieldErrors?: Record<string, string[]>;
  onSampleText: (value: string) => void;
  onMethod: (value: HttpMethod) => void;
  onPath: (value: string) => void;
  onWrapInList: (value: boolean) => void;
  onInfer: () => void;
}

export function SampleForm({
  sampleText,
  method,
  path,
  wrapInList,
  meta,
  inferring = false,
  error = null,
  fieldErrors = {},
  onSampleText,
  onMethod,
  onPath,
  onWrapInList,
  onInfer,
}: SampleFormProps) {
  const analysis = useMemo(
    () => analyzeSample(sampleText, meta.limits.maxSampleBytes),
    [sampleText, meta.limits.maxSampleBytes],
  );
  const pathValidation = useMemo(() => validatePath(path), [path]);
  const pathServerError =
    fieldErrors.path?.[0] ?? fieldErrors["endpoints[0].path"]?.[0] ?? null;
  const methodServerError =
    fieldErrors.method?.[0] ?? fieldErrors["endpoints[0].method"]?.[0] ?? null;
  const sampleServerError =
    fieldErrors.sample?.[0] ?? fieldErrors["endpoints[0].sample"]?.[0] ?? null;
  const canInfer =
    !inferring &&
    analysis.valid &&
    pathValidation.valid &&
    meta.methods.includes(method);

  function formatSample() {
    if (!analysis.parsed?.ok) return;
    onSampleText(JSON.stringify(analysis.parsed.value, null, 2));
  }

  const jsonProblem = analysis.jsonError;
  const problem =
    jsonProblem?.message ??
    analysis.rootError ??
    analysis.sizeError ??
    null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/90">
        <strong className="font-semibold text-amber-100">Do not paste real data.</strong>{" "}
        Samples are sent to the API to infer a schema. Request bodies are stored
        (truncated) for the logs.
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-200">Endpoint path</span>
          <Input
            value={path}
            onChange={(event) => onPath(event.target.value)}
            aria-invalid={Boolean(pathServerError) || (path !== "" && !pathValidation.valid)}
            spellCheck={false}
            className="font-mono"
            placeholder="/users/{id}"
          />
          {pathServerError ? (
            <span className="block text-xs text-red-300">{pathServerError}</span>
          ) : !pathValidation.valid && path !== "" ? (
            <span className="block text-xs text-red-300">{pathValidation.errors[0]}</span>
          ) : null}
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-200">Method</span>
          <select
            value={method}
            onChange={(event) => onMethod(event.target.value as HttpMethod)}
            aria-invalid={Boolean(methodServerError)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {meta.methods.map((entry) => (
              <option key={entry} value={entry} className="bg-zinc-900">
                {entry}
              </option>
            ))}
          </select>
          {methodServerError ? (
            <span className="block text-xs text-red-300">{methodServerError}</span>
          ) : null}
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-200">JSON sample</span>
          <span className="text-[0.7rem] text-zinc-500">
            {formatBytes(analysis.bytes)} / {formatBytes(meta.limits.maxSampleBytes)}
            <span className="sr-only"> ({formatBytesExact(analysis.bytes)} used)</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label="Sample templates">
          {sampleTemplates.map((template) => (
            <Button
              key={template.id}
              type="button"
              size="xs"
              variant={sampleText === template.text ? "secondary" : "outline"}
              onClick={() => onSampleText(template.text)}
              title={template.description}
            >
              {template.label}
            </Button>
          ))}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onSampleText("")}
            disabled={sampleText === ""}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={formatSample}
            disabled={!analysis.parsed?.ok}
          >
            <WandSparklesIcon aria-hidden="true" />
            Format
          </Button>
        </div>

        <JsonEditor
          value={sampleText}
          onChange={onSampleText}
          ariaLabel="JSON sample"
          invalid={sampleText !== "" && !analysis.valid}
          height="280px"
        />

        <div aria-live="polite" className="min-h-5 text-xs">
          {sampleServerError ? (
            <span className="text-red-300">{sampleServerError}</span>
          ) : !sampleText.trim() ? (
            <span className="text-zinc-500">Paste an object or array, or choose a template.</span>
          ) : analysis.valid ? (
            <span className="text-lime-300">
              Valid JSON · {analysis.bytes.toLocaleString("en-US")} bytes
              {analysis.rootKind ? ` · ${analysis.rootKind} root` : ""}
            </span>
          ) : (
            <span className="text-amber-300">
              {jsonProblem?.line
                ? `Line ${jsonProblem.line}${jsonProblem.column ? `, column ${jsonProblem.column}` : ""}: `
                : ""}
              {problem}
            </span>
          )}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <input
          type="checkbox"
          checked={wrapInList}
          onChange={(event) => onWrapInList(event.target.checked)}
          className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-lime-300"
        />
        <span className="space-y-0.5 text-sm">
          <span className="block font-medium text-zinc-200">Wrap in a list</span>
          <span className="block text-xs text-zinc-500">
            {describeWrapInList(wrapInList, analysis.rootKind)}
          </span>
        </span>
      </label>

      {error ? (
        <ErrorAlert
          error={error}
          onRetry={() => onInfer()}
          title={error.code === "rate_limited" ? "Too many inference requests" : undefined}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={onInfer} disabled={!canInfer}>
          {inferring ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <SparklesIcon aria-hidden="true" />
          )}
          {inferring ? "Inferring schema…" : "Infer schema"}
        </Button>
        {!analysis.valid && sampleText.trim() ? (
          <span className="text-xs text-zinc-500">Fix the sample to continue.</span>
        ) : null}
      </div>
    </div>
  );
}
