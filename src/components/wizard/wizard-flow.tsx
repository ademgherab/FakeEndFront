"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateProjectRequest,
  InferRequest,
  MetaResponse,
} from "@/lib/api/generated/schema";
import { inferSchema } from "@/lib/api/infer";
import {
  buildCreateProjectRequest,
  createProject,
} from "@/lib/api/projects";
import {
  AppError,
  explainError,
  fieldErrors,
  isAppError,
  isRetryable,
} from "@/lib/errors";
import { MetaProvider } from "@/components/providers/meta-provider";
import { MetaGate } from "@/components/common/meta-gate";
import { useMeta } from "@/hooks/use-meta";
import { SampleStep } from "@/components/wizard/sample-step";
import { ReviewStep } from "@/components/wizard/review-step";
import { Skeleton } from "@/components/ui/skeleton";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { useWizardHydration, useWizardStore } from "@/stores/wizard";

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError({
    status: 0,
    code: "unknown_error",
    title: "Something went wrong",
    detail: error instanceof Error ? error.message : undefined,
    cause: error,
  });
}

function canOfferRetry(error: AppError | null): boolean {
  if (!error) return false;
  return isRetryable(error) || error.code === "rate_limited";
}

function WizardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Restoring your draft…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-[360px] w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function WizardBody({ meta }: { meta: MetaResponse }) {
  const router = useRouter();
  const step = useWizardStore((state) => state.step);
  const sampleText = useWizardStore((state) => state.endpoint.sampleText);
  const wrapInList = useWizardStore((state) => state.endpoint.wrapInList);
  const setInference = useWizardStore((state) => state.setInference);
  const setStep = useWizardStore((state) => state.setStep);
  const setContextError = useWizardStore((state) => state.setContextError);
  const clearAfterCreate = useWizardStore((state) => state.clearAfterCreate);
  const backToSample = useWizardStore((state) => state.backToSample);

  const [isInferring, setIsInferring] = useState(false);
  const [inferError, setInferError] = useState<AppError | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<AppError | null>(null);

  const inferringRef = useRef(false);
  const creatingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestCounter = useRef(0);
  const lastInferRequest = useRef<InferRequest | null>(null);

  const currentInferenceKey = useCallback(() => {
    const endpoint = useWizardStore.getState().endpoint;
    return JSON.stringify({
      sampleText: endpoint.sampleText,
      wrapInList: endpoint.wrapInList,
    });
  }, []);

  const handleInfer = useCallback(
    async (request: InferRequest) => {
      if (inferringRef.current) return;

      lastInferRequest.current = request;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const requestId = ++requestCounter.current;
      const inferenceKey = currentInferenceKey();

      inferringRef.current = true;
      setIsInferring(true);
      setInferError(null);
      setServerFieldErrors({});
      setCreateError(null);
      setContextError(null);

      try {
        const result = await inferSchema(request, { signal: controller.signal });
        if (requestId !== requestCounter.current) return;
        if (currentInferenceKey() !== inferenceKey) return;

        const endpoint = useWizardStore.getState().endpoint;
        setInference({
          schema: result.schema,
          warnings: result.warnings ?? [],
          suggestions: result.suggestions ?? [],
          settings: defaultEndpointSettings(endpoint.method, meta),
        });
      } catch (caught) {
        if (requestId !== requestCounter.current) return;
        const appError = toAppError(caught);
        if (appError.code === "aborted") return;
        setInferError(appError);
        setServerFieldErrors(fieldErrors(appError));
      } finally {
        if (requestId === requestCounter.current) {
          inferringRef.current = false;
          setIsInferring(false);
        }
      }
    },
    [currentInferenceKey, meta, setContextError, setInference],
  );

  // A sample or wrap change makes an in-flight inference stale immediately.
  useEffect(() => {
    if (!inferringRef.current) return;
    requestCounter.current += 1;
    inferringRef.current = false;
    abortRef.current?.abort();
    setIsInferring(false);
  }, [sampleText, wrapInList]);

  useEffect(() => {
    return () => {
      requestCounter.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  const handleCreate = useCallback(async () => {
    if (creatingRef.current) return;

    creatingRef.current = true;
    setIsCreating(true);
    setCreateError(null);

    let request: CreateProjectRequest;
    try {
      const state = useWizardStore.getState();
      request = buildCreateProjectRequest({
        name: state.projectName,
        endpoint: state.endpoint,
        meta,
      });
    } catch (caught) {
      const appError = toAppError(caught);
      creatingRef.current = false;
      setIsCreating(false);
      setCreateError(appError);

      if (appError.code === "sample_invalid") {
        setStep(1);
        setContextError(`${explainError(appError).message} ${explainError(appError).action ?? ""}`.trim());
      }
      return;
    }

    try {
      const result = await createProject(request);
      clearAfterCreate(result);
      setIsCreating(false);
      creatingRef.current = false;
      router.push("/new/success");
    } catch (caught) {
      const appError = toAppError(caught);
      creatingRef.current = false;
      setIsCreating(false);

      if (
        appError.code === "sample_invalid" ||
        appError.code === "sample_too_complex" ||
        appError.code === "payload_too_large"
      ) {
        const copy = explainError(appError);
        setStep(1);
        setContextError(`${copy.message} ${copy.action ?? ""}`.trim());
        setCreateError(null);
        return;
      }

      if (appError.code === "response_too_large") {
        const copy = explainError(appError);
        setContextError(`${copy.message} ${copy.action ?? ""}`.trim());
      }

      setCreateError(appError);
    }
  }, [clearAfterCreate, meta, router, setContextError, setStep]);

  const handleRetryInfer = useCallback(() => {
    if (lastInferRequest.current) {
      void handleInfer(lastInferRequest.current);
    }
  }, [handleInfer]);

  if (step === 2) {
    return (
      <ReviewStep
        meta={meta}
        isCreating={isCreating}
        createError={createError}
        onCreate={() => {
          void handleCreate();
        }}
        onRetry={
          canOfferRetry(createError)
            ? () => {
                void handleCreate();
              }
            : undefined
        }
        onBack={backToSample}
      />
    );
  }

  return (
    <SampleStep
      meta={meta}
      isInferring={isInferring}
      inferError={inferError}
      serverFieldErrors={serverFieldErrors}
      onInfer={(request) => {
        void handleInfer(request);
      }}
      onRetry={
        canOfferRetry(inferError)
          ? () => {
              handleRetryInfer();
            }
          : undefined
      }
    />
  );
}

function WizardContent() {
  const { data } = useMeta();
  if (!data) return null;
  return <WizardBody meta={data} />;
}

/**
 * Wizard shell for the tasks implemented so far: sample → infer → review →
 * create. Schema editing, settings and preview slot in between in later tasks.
 */
export function WizardFlow() {
  const hydrated = useWizardHydration();

  if (!hydrated) return <WizardSkeleton />;

  return (
    <MetaProvider>
      <MetaGate>
        <WizardContent />
      </MetaGate>
    </MetaProvider>
  );
}
