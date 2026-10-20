"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LoaderCircleIcon,
  RocketIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useMeta } from "@/hooks/use-meta";
import { useRetryAfter } from "@/hooks/use-retry-after";
import { inferSchema } from "@/lib/api/infer";
import { buildCreateProjectRequest, createProject } from "@/lib/api/projects";
import { AppError, explainError, fieldErrors, isAppError } from "@/lib/errors";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { analyzeSample } from "@/lib/wizard/validation";
import {
  clampRequestedStep,
  furthestAccessibleStep,
  hasUnsavedWizardWork,
  stepProblem,
  WIZARD_STEPS,
} from "@/lib/wizard/steps";
import {
  canRedoSchema,
  canUndoSchema,
  useWizardHydration,
  useWizardStore,
  type WizardStep,
} from "@/stores/wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { SampleForm } from "@/components/wizard/sample-form";
import { SchemaStep } from "@/components/wizard/schema-step";
import { PreviewPanel } from "@/components/wizard/preview-panel";
import { SettingsEditor } from "@/components/settings/settings-editor";
import { cn } from "cn";

function WizardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading builder">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function NewProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useWizardHydration();
  const { data: meta, isLoading: metaLoading, error: metaError, refresh } = useMeta();

  const step = useWizardStore((state) => state.step);
  const projectName = useWizardStore((state) => state.projectName);
  const endpoint = useWizardStore((state) => state.endpoint);
  const contextError = useWizardStore((state) => state.contextError);
  const createResult = useWizardStore((state) => state.createResult);
  const schemaDirty = useWizardStore((state) => state.endpoint.schemaDirty);
  const schemaHistoryIndex = useWizardStore((state) => state.schemaHistoryIndex);
  const schemaHistoryLength = useWizardStore((state) => state.schemaHistory.length);

  const setStep = useWizardStore((state) => state.setStep);
  const setProjectName = useWizardStore((state) => state.setProjectName);
  const setSampleText = useWizardStore((state) => state.setSampleText);
  const setMethod = useWizardStore((state) => state.setMethod);
  const setPath = useWizardStore((state) => state.setPath);
  const setWrapInList = useWizardStore((state) => state.setWrapInList);
  const setInference = useWizardStore((state) => state.setInference);
  const updateSchema = useWizardStore((state) => state.updateSchema);
  const undoSchema = useWizardStore((state) => state.undoSchema);
  const redoSchema = useWizardStore((state) => state.redoSchema);
  const setSettings = useWizardStore((state) => state.setSettings);
  const dismissSuggestions = useWizardStore((state) => state.dismissSuggestions);
  const backToSample = useWizardStore((state) => state.backToSample);
  const resetDraft = useWizardStore((state) => state.resetDraft);
  const clearAfterCreate = useWizardStore((state) => state.clearAfterCreate);
  const setContextError = useWizardStore((state) => state.setContextError);

  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<AppError | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<AppError | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const [gateError, setGateError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const inferAbort = useRef<AbortController | null>(null);
  const creatingRef = useRef(false);
  const { isBlocked: createBlocked } = useRetryAfter(createError);
  const { isBlocked: inferBlocked } = useRetryAfter(inferError);

  const gateState = useMemo(
    () => ({
      step,
      sampleText: endpoint.sampleText,
      path: endpoint.path,
      method: endpoint.method,
      schema: endpoint.schema,
      settings: endpoint.settings,
      meta,
    }),
    [
      step,
      endpoint.sampleText,
      endpoint.path,
      endpoint.method,
      endpoint.schema,
      endpoint.settings,
      meta,
    ],
  );

  const furthest = meta ? furthestAccessibleStep(gateState) : 1;
  const hasWork =
    step > 1 ||
    endpoint.sampleText.trim().length > 0 ||
    Boolean(endpoint.schema) ||
    projectName.trim().length > 0;
  const unsaved = hasUnsavedWizardWork({
    step,
    sampleText: endpoint.sampleText,
    schema: endpoint.schema,
    projectName,
  });

  useEffect(() => {
    if (!meta || !endpoint.schema || endpoint.settings) return;
    setSettings(defaultEndpointSettings(endpoint.method, meta));
  }, [endpoint.method, endpoint.schema, endpoint.settings, meta, setSettings]);

  useEffect(() => {
    return () => inferAbort.current?.abort();
  }, []);

  // A sample or wrap change makes an in-flight inference stale immediately.
  useEffect(() => {
    inferAbort.current?.abort();
  }, [endpoint.sampleText, endpoint.wrapInList]);

  useEffect(() => {
    if (!unsaved || createResult) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved, createResult]);

  // Keep the URL and the draft step in sync, including direct URL edits.
  useEffect(() => {
    if (!hydrated || !meta || createResult) return;
    const raw = searchParams.get("step");
    const requested = raw === null ? step : Number(raw);
    const target = clampRequestedStep(requested, gateState);
    if (target !== step) setStep(target);
    if (raw !== String(target)) {
      router.replace(`/new?step=${target}`, { scroll: false });
    }
    // gateState fields are intentionally captured for the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, meta, searchParams, step, createResult, router, setStep, endpoint.schema, endpoint.sampleText, endpoint.path, endpoint.method, endpoint.settings]);

  const navigateStep = useCallback(
    (next: WizardStep) => {
      setGateError(null);
      if (next > step) {
        for (let current = step; current < next; current += 1) {
          const problem = stepProblem({ ...gateState, step: current as WizardStep });
          if (problem) {
            setGateError(problem);
            return;
          }
        }
      }
      setStep(next);
      router.push(`/new?step=${next}`, { scroll: false });
    },
    [gateState, router, setStep, step],
  );

  const handleSampleText = useCallback(
    (value: string) => {
      setInferError(null);
      setSampleText(value);
    },
    [setSampleText],
  );

  const handleInfer = useCallback(async () => {
    if (!meta) return;
    const analysis = analyzeSample(endpoint.sampleText, meta.limits.maxSampleBytes);
    if (!analysis.valid || !analysis.parsed?.ok) {
      setInferError(
        new AppError({
          status: 0,
          code: "sample_invalid",
          detail: analysis.jsonError?.message ?? analysis.rootError ?? analysis.sizeError ?? undefined,
        }),
      );
      return;
    }

    const inferenceKey = JSON.stringify({
      sampleText: endpoint.sampleText,
      wrapInList: endpoint.wrapInList,
    });

    inferAbort.current?.abort();
    const controller = new AbortController();
    inferAbort.current = controller;
    setInferring(true);
    setInferError(null);
    setServerFieldErrors({});
    setContextError(null);

    try {
      const response = await inferSchema(
        { sample: analysis.parsed.value, options: { wrapInList: endpoint.wrapInList } },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const current = useWizardStore.getState().endpoint;
      const currentKey = JSON.stringify({
        sampleText: current.sampleText,
        wrapInList: current.wrapInList,
      });
      if (currentKey !== inferenceKey) return;
      setInference({
        schema: response.schema,
        warnings: response.warnings ?? [],
        suggestions: response.suggestions ?? [],
        settings:
          endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta),
      });
      router.push("/new?step=2", { scroll: false });
    } catch (caught) {
      if (controller.signal.aborted) return;
      const appError = isAppError(caught)
        ? caught
        : new AppError({ status: 0, code: "unknown_error", cause: caught });
      if (appError.code === "aborted") return;
      setInferError(appError);
      setServerFieldErrors(fieldErrors(appError));
    } finally {
      if (inferAbort.current === controller) {
        inferAbort.current = null;
        setInferring(false);
      }
    }
  }, [endpoint.method, endpoint.sampleText, endpoint.settings, endpoint.wrapInList, meta, router, setContextError, setInference]);

  const handleCreate = useCallback(async () => {
    if (!meta || !endpoint.schema || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    setServerFieldErrors({});
    setContextError(null);
    try {
      const request = buildCreateProjectRequest({ name: projectName, endpoint, meta });
      const result = await createProject(request);
      clearAfterCreate(result);
      router.push("/new/success");
    } catch (caught) {
      const appError = isAppError(caught)
        ? caught
        : new AppError({ status: 0, code: "unknown_error", cause: caught });
      if (appError.code === "aborted") return;

      const copy = explainError(appError);
      const context = `${copy.message} ${copy.action ?? ""}`.trim();
      setServerFieldErrors(fieldErrors(appError));

      if (
        appError.code === "sample_invalid" ||
        appError.code === "sample_too_complex" ||
        appError.code === "payload_too_large" ||
        appError.code === "duplicate_endpoint" ||
        appError.code === "validation_failed"
      ) {
        setStep(1);
        setContextError(context);
        setCreateError(null);
        return;
      }

      if (appError.code === "response_too_large") {
        setStep(4);
        setContextError(context);
        setCreateError(null);
        return;
      }

      setCreateError(appError);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [clearAfterCreate, endpoint, meta, projectName, router, setContextError, setStep]);

  if (createResult) {
    // The success route renders CreateSuccess from the in-memory store.
    return null;
  }

  if (!hydrated || metaLoading) {
    return <WizardSkeleton />;
  }

  if (metaError || !meta) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Create a mock API</h1>
        <ErrorAlert error={metaError} onRetry={() => void refresh()} />
      </div>
    );
  }

  const stepIndex = WIZARD_STEPS.findIndex((entry) => entry.id === step);
  const nextLabel =
    step === 1
      ? "Infer and continue"
      : step === 2
        ? "Continue to settings"
        : step === 3
          ? "Continue to preview"
          : "Create project";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">Builder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Create a mock API
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Paste a sample, review the inferred schema, tune the settings and check
          the generated response before creating the project.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Wizard steps">
        {WIZARD_STEPS.map((definition) => {
          const accessible = definition.id <= Math.max(furthest, step);
          const active = definition.id === step;
          const complete =
            definition.id < step && stepProblem({ ...gateState, step: definition.id }) === null;
          return (
            <li key={definition.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-disabled={!accessible}
                onClick={() => {
                  if (!accessible) {
                    setGateError(`Complete "${WIZARD_STEPS[definition.id - 2]?.shortLabel ?? "the previous step"}" first.`);
                    return;
                  }
                  navigateStep(definition.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-lime-300/40 bg-lime-300/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                  !accessible && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.7rem] font-semibold",
                    active
                      ? "border-lime-300/60 bg-lime-300 text-zinc-950"
                      : complete
                        ? "border-lime-300/40 text-lime-300"
                        : "border-white/20 text-zinc-400",
                  )}
                >
                  {complete ? <CheckIcon aria-hidden="true" className="size-3.5" /> : definition.id}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-zinc-100">
                    {definition.shortLabel}
                  </span>
                  <span className="hidden truncate text-[0.65rem] text-zinc-500 sm:block">
                    {definition.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        {contextError ? (
          <ErrorAlert
            error={new AppError({ status: 0, detail: contextError })}
            className="mb-4"
          />
        ) : null}

        {step === 1 ? (
          <SampleForm
            sampleText={endpoint.sampleText}
            method={endpoint.method}
            path={endpoint.path}
            wrapInList={endpoint.wrapInList}
            meta={meta}
            inferring={inferring}
            error={inferError}
            fieldErrors={serverFieldErrors}
            onSampleText={handleSampleText}
            onMethod={setMethod}
            onPath={setPath}
            onWrapInList={setWrapInList}
            onInfer={() => void handleInfer()}
          />
        ) : null}

        {step === 2 ? (
          <SchemaStep
            schema={endpoint.schema}
            meta={meta}
            warnings={endpoint.warnings}
            suggestions={endpoint.suggestions}
            settings={endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta)}
            dismissedSuggestionKeys={endpoint.dismissedSuggestionKeys}
            schemaDirty={schemaDirty}
            canUndo={canUndoSchema({ schemaHistoryIndex })}
            canRedo={canRedoSchema({
              schemaHistoryIndex,
              schemaHistory: new Array(schemaHistoryLength),
            })}
            onSchemaChange={updateSchema}
            onSettingsChange={setSettings}
            onDismissSuggestions={dismissSuggestions}
            onUndo={undoSchema}
            onRedo={redoSchema}
            onBackToSample={backToSample}
          />
        ) : null}

        {step === 3 ? (
          <SettingsEditor
            settings={endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta)}
            meta={meta}
            schema={endpoint.schema}
            onChange={setSettings}
          />
        ) : null}

        {step === 4 ? (
          <div className="space-y-6">
            <label className="block max-w-md space-y-1.5 text-sm">
              <span className="text-zinc-200">Project name (optional)</span>
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                maxLength={meta.limits.maxProjectNameLength}
                placeholder="My demo API"
              />
              <span className="block text-xs text-zinc-500">
                {projectName.length} / {meta.limits.maxProjectNameLength} characters
              </span>
            </label>
            <PreviewPanel schema={endpoint.schema} settings={endpoint.settings} />
            {createError ? <ErrorAlert error={createError} onRetry={() => void handleCreate()} /> : null}
          </div>
        ) : null}
      </div>

      {gateError ? (
        <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
          {gateError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigateStep(Math.max(1, step - 1) as WizardStep)}
            disabled={step === 1}
          >
            <ArrowLeftIcon aria-hidden="true" />
            Back
          </Button>
          {hasWork ? (
            <Button type="button" variant="ghost" onClick={() => setResetOpen(true)}>
              <RotateCcwIcon aria-hidden="true" />
              Start over
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </span>
          {step < 4 ? (
            <Button
              type="button"
              size="lg"
              onClick={() => {
                if (step === 1) void handleInfer();
                else navigateStep((step + 1) as WizardStep);
              }}
              disabled={inferring || creating || (step === 1 && inferBlocked)}
            >
              {inferring ? <LoaderCircleIcon aria-hidden="true" className="animate-spin" /> : null}
              {nextLabel}
              {!inferring ? <ArrowRightIcon aria-hidden="true" /> : null}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => void handleCreate()}
              disabled={creating || createBlocked || !endpoint.schema}
            >
              {creating ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : (
                <RocketIcon aria-hidden="true" />
              )}
              {creating ? "Creating…" : "Create project"}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Start over?"
        description="This clears the sample, inferred schema and settings for this draft. Your saved projects are not affected."
        confirmLabel="Clear draft"
        destructive
        onConfirm={() => {
          inferAbort.current?.abort();
          setInferring(false);
          setInferError(null);
          setCreateError(null);
          setGateError(null);
          resetDraft();
          setResetOpen(false);
          router.replace("/new?step=1", { scroll: false });
        }}
      />
    </div>
  );
}
