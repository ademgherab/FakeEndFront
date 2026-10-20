"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  EndpointSettings,
  InferResponse,
  MetaResponse,
  Method,
  Project,
  Schema,
} from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  FALLBACK_META,
  cloneSettings,
  limitsFromMeta,
} from "@/lib/defaults";
import {
  parseSample,
  validatePath,
  validateSettings,
  validateSettingsAgainstSchema,
  type FieldErrors,
} from "@/lib/validation";
import {
  BASE,
  ApiError,
  createProject,
  getMeta,
  infer,
} from "@/lib/api";
import { rememberToken } from "@/lib/credentials";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { JsonSampleInput } from "@/components/builder/json-sample-input";
import { SettingsForm } from "@/components/builder/settings-form";
import { SchemaPreview } from "@/components/builder/schema-preview";
import { PreviewPanel } from "@/components/builder/preview-panel";
import { ResultPanel } from "@/components/builder/result-panel";
import { TestPanel } from "@/components/builder/test-panel";
import { ErrorBanner } from "@/components/builder/error-banner";

type Phase = "idle" | "inferring" | "inferred" | "creating" | "created";

export function Builder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sampleText, setSampleText] = useState("");
  const [wrapInList, setWrapInList] = useState(false);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [stale, setStale] = useState(false);
  const [inferredSample, setInferredSample] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<InferResponse["warnings"]>([]);
  const [inferError, setInferError] = useState<ApiError["problem"] | null>(null);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/users");
  const [settings, setSettings] = useState<EndpointSettings>(() =>
    cloneSettings(DEFAULT_SETTINGS),
  );
  const [createError, setCreateError] = useState<ApiError["problem"] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors>({});
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const creatingRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const health = useBackendHealth();

  // Meta is optional: the form falls back to the defaults and never blocks.
  useEffect(() => {
    let active = true;
    void getMeta().then((payload) => {
      if (active && payload) setMeta(payload);
    });
    return () => {
      active = false;
    };
  }, []);

  // A 429 with `Retry-After` blocks the create button until the window ends.
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetrySeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retrySeconds]);

  const sample = parseSample(sampleText);
  const parsedOk = sample.ok && !sample.isEmpty;
  const rootIsArray = sample.rootIsArray;
  const pathValidation = validatePath(path, limitsFromMeta(meta).maxPathLength);
  const settingsValidation = validateSettings(
    settings,
    method,
    limitsFromMeta(meta),
    meta?.errorStatusRange ?? FALLBACK_META.errorStatusRange,
  );
  const schemaValidation = validateSettingsAgainstSchema(settings, schema);
  const fieldErrors: FieldErrors = {
    ...settingsValidation.errors,
    ...schemaValidation.errors,
    ...(pathValidation.valid ? {} : { path: pathValidation.errors }),
  };
  const settingsValid =
    settingsValidation.valid && schemaValidation.valid && pathValidation.valid;
  const canInfer = parsedOk && phase !== "inferring" && phase !== "creating";
  const createBlocked = retrySeconds > 0;
  const canCreate =
    (phase === "inferred" || phase === "created") &&
    !stale &&
    settingsValid &&
    !createBlocked;

  function handleSampleText(value: string) {
    setSampleText(value);
    if (parseSample(value).rootIsArray) {
      setWrapInList(false);
    }
    if (schema && !stale) {
      setStale(true);
      setPhase("idle");
    }
  }

  async function runInfer() {
    if (!parsedOk || !sample.value) return;
    setPhase("inferring");
    setInferError(null);
    try {
      const response = await infer({
        sample: sample.value,
        options: { wrapInList },
      });
      setSchema(response.schema);
      setWarnings(response.warnings ?? []);
      setInferredSample(sample.value);
      setStale(false);
      setPhase("inferred");
    } catch (error) {
      setInferError(
        error instanceof ApiError
          ? error.problem
          : {
              title: "Cannot reach API",
              detail: `Cannot reach API at ${BASE}. Is the backend running?`,
            },
      );
      setPhase("idle");
    }
  }

  async function runCreate() {
    if (!canCreate || !schema || creatingRef.current) return;
    creatingRef.current = true;
    setPhase("creating");
    setCreateError(null);
    setCreateFieldErrors({});

    const normalized = pathValidation.value || path;
    const sampleMatches =
      JSON.stringify(inferredSample) === JSON.stringify(sample.value);

    // Exactly one of `sample` or `schema` is sent, never both.
    const endpoint = {
      method,
      path: normalized,
      ...(sampleMatches ? { schema } : { sample: sample.value }),
      options: { wrapInList },
      settings,
    };

    try {
      const result = await createProject({
        name: "Users demo",
        endpoints: [endpoint],
      });
      setProject(result);
      setPhase("created");
      if (result.editToken) {
        // The token is returned exactly once and is kept in memory only.
        rememberToken(result.slug, result.editToken);
      }
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      const problem =
        error instanceof ApiError
          ? error.problem
          : {
              title: "Cannot reach API",
              detail: `Cannot reach API at ${BASE}. Is the backend running?`,
            };
      setCreateError(problem);
      setCreateFieldErrors(problem.errors ?? {});
      setPhase("inferred");
      if (error instanceof ApiError && error.retryAfter) {
        setRetrySeconds(error.retryAfter);
      }
    } finally {
      creatingRef.current = false;
    }
  }

  function handleSettings(next: {
    method: Method;
    path: string;
    settings: EndpointSettings;
  }) {
    setMethod(next.method);
    setPath(next.path);
    setSettings(next.settings);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">FakeEnd</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/landing"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            About
          </Link>
          <p className="text-sm text-zinc-400">
            API:{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
              {BASE}
            </code>
          </p>
        </div>
      </header>

      {health.state === "offline" ? (
        <p
          role="status"
          className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-100"
        >
          The API at <code className="font-mono">{BASE}</code> is not
          answering. Requests will fail until it is running and allows this
          origin.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <JsonSampleInput
            sampleText={sampleText}
            onSampleText={handleSampleText}
            wrapInList={wrapInList}
            onWrapInList={setWrapInList}
            inferring={phase === "inferring"}
            inferError={inferError}
            warnings={warnings}
            parsedOk={parsedOk}
            isEmpty={sample.isEmpty}
            rootIsArray={rootIsArray}
            parseError={sample.error}
            canInfer={canInfer}
            onInfer={() => {
              void runInfer();
            }}
          />

          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-sm font-semibold text-zinc-100">Endpoint settings</h2>
            <SettingsForm
              method={method}
              path={path}
              settings={settings}
              errors={fieldErrors}
              limits={limitsFromMeta(meta)}
              successStatuses={meta?.successStatuses ?? FALLBACK_META.successStatuses}
              errorRange={meta?.errorStatusRange ?? FALLBACK_META.errorStatusRange}
              onChange={handleSettings}
            />
            <button
              type="button"
              onClick={() => {
                void runCreate();
              }}
              disabled={!canCreate}
              aria-busy={phase === "creating"}
              className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === "creating" ? "Creating…" : "Create mock"}
            </button>
            {createError ? (
              <ErrorBanner error={createError} errors={createFieldErrors} />
            ) : null}
            {createBlocked ? (
              <p role="status" className="text-xs text-amber-200">
                Rate limited. Try again in {retrySeconds} second
                {retrySeconds === 1 ? "" : "s"}.
              </p>
            ) : null}
          </div>

          <PreviewPanel
            schema={schema}
            settings={settings}
            enabled={Boolean(schema) && settingsValid}
            stale={stale}
          />
        </div>

        <div className="space-y-8" ref={resultRef}>
          {project ? (
            <>
              <ResultPanel project={project} />
              <TestPanel project={project} method={method} />
            </>
          ) : (
            <SchemaPreview schema={schema} stale={stale} />
          )}
        </div>
      </div>
    </div>
  );
}
