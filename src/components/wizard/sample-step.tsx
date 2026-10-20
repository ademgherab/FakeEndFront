"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangleIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { cn } from "cn";
import type {
  HttpMethod,
  InferRequest,
  MetaResponse,
} from "@/lib/api/generated/schema";
import type { AppError } from "@/lib/errors";
import { useWizardStore } from "@/stores/wizard";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRetryAfter } from "@/hooks/use-retry-after";
import {
  analyzeSample,
  describeWrapInList,
  validateMethod,
  validatePath,
} from "@/lib/wizard/validation";
import { sampleTemplates } from "@/lib/wizard/templates";
import { formatBytes, formatBytesExact } from "@/lib/format";
import { ErrorAlert } from "@/components/common/error-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

const JsonEditor = dynamic(() => import("@/components/wizard/json-editor"), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Loading JSON editor">
      <Skeleton className="h-[360px] w-full rounded-lg" />
    </div>
  ),
});

export interface SampleStepProps {
  meta: MetaResponse;
  isInferring: boolean;
  inferError: AppError | null;
  serverFieldErrors: Record<string, string[]>;
  onInfer: (request: InferRequest) => void;
  onRetry?: () => void;
}

function FieldError({ messages }: { messages: string[] | undefined }) {
  if (!messages || messages.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs text-red-300">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function SampleStep({
  meta,
  isInferring,
  inferError,
  serverFieldErrors,
  onInfer,
  onRetry,
}: SampleStepProps) {
  const sampleText = useWizardStore((state) => state.endpoint.sampleText);
  const method = useWizardStore((state) => state.endpoint.method);
  const path = useWizardStore((state) => state.endpoint.path);
  const wrapInList = useWizardStore((state) => state.endpoint.wrapInList);
  const contextError = useWizardStore((state) => state.contextError);
  const setSampleText = useWizardStore((state) => state.setSampleText);
  const setMethod = useWizardStore((state) => state.setMethod);
  const setPath = useWizardStore((state) => state.setPath);
  const setWrapInList = useWizardStore((state) => state.setWrapInList);

  const [localPathErrors, setLocalPathErrors] = useState<string[]>([]);
  const debouncedText = useDebouncedValue(sampleText, 150);
  const { isBlocked } = useRetryAfter(inferError);

  const analysis = useMemo(
    () => analyzeSample(debouncedText, meta.limits.maxSampleBytes),
    [debouncedText, meta.limits.maxSampleBytes],
  );

  const pathValidation = useMemo(() => validatePath(path), [path]);
  const methodError = validateMethod(method, meta.methods);
  const isStale = debouncedText !== sampleText;

  const serverPathErrors = serverFieldErrors["endpoints[0].path"] ?? [];
  const serverMethodErrors = serverFieldErrors["endpoints[0].method"] ?? [];
  const serverSampleErrors =
    serverFieldErrors["endpoints[0].sample"] ??
    serverFieldErrors.sample ??
    [];

  const pathErrors = [
    ...pathValidation.errors,
    ...localPathErrors,
    ...serverPathErrors,
    ...(methodError ? [methodError] : []),
    ...serverMethodErrors,
  ];

  const canInfer =
    analysis.valid &&
    pathValidation.valid &&
    !methodError &&
    !isInferring &&
    !isBlocked &&
    !isStale;

  function handleFormat() {
    if (!analysis.parsed?.ok) return;
    setSampleText(JSON.stringify(analysis.parsed.value, null, 2));
  }

  function handleInfer() {
    if (!canInfer || !analysis.parsed?.ok) return;
    setLocalPathErrors(validatePath(path).errors);
    onInfer({
      sample: analysis.parsed.value,
      options: { wrapInList },
    });
  }

  const statusTone =
    analysis.valid && !isStale
      ? "text-lime-300"
      : analysis.jsonError || analysis.rootError || analysis.sizeError
        ? "text-red-300"
        : "text-zinc-500";

  return (
    <div className="space-y-6">
      {contextError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-sm text-amber-100"
        >
          <p className="font-semibold">The project was not created</p>
          <p className="mt-1 text-amber-100/80">{contextError}</p>
        </div>
      ) : null}

      <aside className="rounded-xl border border-lime-300/20 bg-lime-300/[0.04] p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-lime-300"
          />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Do not paste real or sensitive data
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Samples are analyzed in memory and never stored, except for values
              kept by enum generators. Request bodies sent to the mock appear in
              logs, truncated to 4 KB.
            </p>
          </div>
        </div>
      </aside>

      <section
        aria-labelledby="sample-heading"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="sample-heading" className="text-base font-semibold text-zinc-100">
              JSON sample
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Paste an object or an array. Inference reads names, types and value
              patterns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleFormat}
              disabled={!analysis.parsed?.ok}
            >
              Format
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Examples:</span>
          {sampleTemplates.map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="ghost"
              size="xs"
              title={template.description}
              onClick={() => setSampleText(template.text)}
            >
              {template.label}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <JsonEditor
            value={sampleText}
            onChange={setSampleText}
            ariaLabel="JSON sample"
            invalid={Boolean(analysis.jsonError || analysis.rootError || analysis.sizeError)}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p
            role="status"
            aria-live="polite"
            className={cn("text-xs leading-5", statusTone)}
          >
            {analysis.jsonError ? (
              <>
                Invalid JSON
                {analysis.jsonError.line !== null
                  ? ` at line ${analysis.jsonError.line}, column ${analysis.jsonError.column}`
                  : ""}
                . {analysis.jsonError.message}
              </>
            ) : analysis.rootError ? (
              analysis.rootError
            ) : analysis.sizeError ? (
              analysis.sizeError
            ) : analysis.valid ? (
              <>
                Valid JSON · {analysis.rootKind} root ·{" "}
                {formatBytesExact(analysis.bytes)}
              </>
            ) : (
              "Paste JSON to begin."
            )}
          </p>

          <div className="shrink-0 text-right">
            <p
              className={cn(
                "font-mono text-xs",
                analysis.withinLimit ? "text-zinc-400" : "text-red-300",
              )}
            >
              {formatBytes(analysis.bytes)} / {formatBytes(meta.limits.maxSampleBytes)}
            </p>
            <p className="mt-0.5 text-[0.7rem] text-zinc-500">
              {formatBytesExact(analysis.bytes)} of{" "}
              {formatBytesExact(meta.limits.maxSampleBytes)}
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              analysis.withinLimit ? "bg-lime-300" : "bg-red-400",
            )}
            style={{
              width: `${Math.min(
                100,
                (analysis.bytes / Math.max(1, meta.limits.maxSampleBytes)) * 100,
              )}%`,
            }}
          />
        </div>

        <FieldError messages={serverSampleErrors} />
      </section>

      <section
        aria-labelledby="endpoint-heading"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <h2 id="endpoint-heading" className="text-base font-semibold text-zinc-100">
          Endpoint
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Pick a method and the path the mock will answer on.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
          <div>
            <Label htmlFor="endpoint-method">Method</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as HttpMethod)}
            >
              <SelectTrigger
                id="endpoint-method"
                className="mt-2 w-full"
                aria-label="HTTP method"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.methods.map((allowed) => (
                  <SelectItem key={allowed} value={allowed}>
                    <Badge variant="outline" className="font-mono">
                      {allowed}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="endpoint-path">Path</Label>
            <Input
              id="endpoint-path"
              value={path}
              onChange={(event) => {
                setPath(event.target.value);
                if (localPathErrors.length > 0) {
                  setLocalPathErrors([]);
                }
              }}
              onBlur={() => setLocalPathErrors(validatePath(path).errors)}
              placeholder="/users/{id}"
              className="mt-2 font-mono"
              aria-invalid={pathErrors.length > 0 || undefined}
              aria-describedby={pathErrors.length > 0 ? "endpoint-path-errors" : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Must start with /. Use {"{name}"} for path parameters.
            </p>
            <div id="endpoint-path-errors">
              <FieldError messages={pathErrors} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="wrap-in-list">Wrap in a list</Label>
            <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-400">
              {describeWrapInList(wrapInList, analysis.rootKind)}
            </p>
          </div>
          <Switch
            id="wrap-in-list"
            checked={wrapInList}
            onCheckedChange={setWrapInList}
            aria-describedby="wrap-in-list-description"
          />
        </div>
        <p id="wrap-in-list-description" className="mt-3 text-xs text-zinc-500">
          {wrapInList
            ? "Use this when the client expects a collection rather than one record."
            : "Use this when the endpoint should return one record."}
        </p>
      </section>

      {inferError ? (
        <ErrorAlert
          error={inferError}
          title={
            inferError.code === "rate_limited"
              ? "Too many inference requests"
              : undefined
          }
          onRetry={inferError.code === "aborted" ? undefined : onRetry}
        />
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          Step 1 · Inference is explicit; nothing is stored until you create the
          project.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={handleInfer}
          disabled={!canInfer}
          className="sm:min-w-40"
        >
          {isInferring ? (
            <>
              <Loader2Icon aria-hidden="true" className="animate-spin" />
              Inferring…
            </>
          ) : (
            <>
              <SparklesIcon aria-hidden="true" />
              Infer schema
            </>
          )}
        </Button>
      </div>
      {!canInfer && !isInferring && !isBlocked ? (
        <p className="text-right text-xs text-zinc-500">
          Fix the sample, method or path to continue.
        </p>
      ) : null}
    </div>
  );
}
