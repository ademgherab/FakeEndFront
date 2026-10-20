"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type {
  InferSuggestion,
  InferWarning,
  MetaResponse,
  ProjectEndpoint,
} from "@/lib/api/generated/schema";
import { inferSchema } from "@/lib/api/infer";
import { addEndpoint } from "@/lib/api/endpoints";
import {
  buildEndpointInput,
  isDuplicateEndpoint,
  type EndpointDraftLike,
} from "@/lib/api/projects";
import { AppError, isAppError } from "@/lib/errors";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { analyzeSample } from "@/lib/wizard/validation";
import { ensureSchemaIds, findNodeById } from "@/lib/schema/tree";
import { newEndpointState } from "@/stores/wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { SampleForm } from "@/components/wizard/sample-form";
import { SchemaTree } from "@/components/schema/schema-tree";
import { SchemaInspector } from "@/components/schema/schema-inspector";
import { RawSchemaEditor } from "@/components/schema/raw-schema-editor";
import { SettingsEditor } from "@/components/settings/settings-editor";
import { PreviewPanel } from "@/components/wizard/preview-panel";
import { cn } from "cn";

export interface AddEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  token: string;
  baseUrl: string;
  meta: MetaResponse;
  existingEndpoints: ReadonlyArray<{ method: ProjectEndpoint["method"]; path: string }>;
  onCreated: (endpoint: ProjectEndpoint) => void;
}

type LocalStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Array<{ id: LocalStep; label: string }> = [
  { id: 1, label: "Sample" },
  { id: 2, label: "Schema" },
  { id: 3, label: "Settings" },
  { id: 4, label: "Preview" },
];

export function AddEndpointDialog({
  open,
  onOpenChange,
  slug,
  token,
  baseUrl,
  meta,
  existingEndpoints,
  onCreated,
}: AddEndpointDialogProps) {
  const [draft, setDraft] = useState(() => newEndpointState());
  const [step, setStep] = useState<LocalStep>(1);
  const [selectedIdState, setSelectedId] = useState<string | null>(null);
  const [schemaMode, setSchemaMode] = useState<"visual" | "raw">("visual");
  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<AppError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<AppError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const atLimit = existingEndpoints.length >= meta.limits.maxEndpointsPerProject;
  const duplicate = isDuplicateEndpoint(draft.method, draft.path, existingEndpoints);
  const effectiveFieldErrors: Record<string, string[]> = {
    ...fieldErrors,
    ...(duplicate && !fieldErrors.path
      ? { path: ["Another endpoint uses the same method and normalized path."] }
      : {}),
  };

  useEffect(() => {
    if (!open) return;
    // Resetting the whole form when the dialog opens is intentional: each
    // open starts a fresh endpoint instead of resuming an abandoned draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(newEndpointState());
    setStep(1);
    setSelectedId(null);
    setSchemaMode("visual");
    setInferError(null);
    setSubmitError(null);
    setFieldErrors({});
    setDirty(false);
    setConfirmClose(false);
    setInferring(false);
    abortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const selectedId =
    draft.schema && selectedIdState && findNodeById(draft.schema, selectedIdState)
      ? selectedIdState
      : draft.schema?.root.id ?? null;

  const selectedNode =
    draft.schema && selectedId ? findNodeById(draft.schema, selectedId) : null;

  function updateDraft(patch: Partial<typeof draft>) {
    setDirty(true);
    setSubmitError(null);
    setFieldErrors({});
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateSample(sampleText: string) {
    abortRef.current?.abort();
    setInferring(false);
    setInferError(null);
    updateDraft({
      sampleText,
      schema: null,
      warnings: [],
      suggestions: [],
      settings: null,
      schemaDirty: false,
    });
    setStep(1);
  }

  async function infer() {
    const analysis = analyzeSample(draft.sampleText, meta.limits.maxSampleBytes);
    if (!analysis.valid || !analysis.parsed?.ok) {
      setInferError(
        new AppError({
          status: 0,
          code: "sample_invalid",
          detail:
            analysis.jsonError?.message ??
            analysis.rootError ??
            analysis.sizeError ??
            undefined,
        }),
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInferring(true);
    setInferError(null);

    try {
      const response = await inferSchema(
        { sample: analysis.parsed.value, options: { wrapInList: draft.wrapInList } },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const schema = ensureSchemaIds(response.schema);
      const warnings: InferWarning[] = response.warnings ?? [];
      const suggestions: InferSuggestion[] = response.suggestions ?? [];
      setDraft((current) => ({
        ...current,
        schema,
        warnings,
        suggestions,
        settings: current.settings ?? defaultEndpointSettings(current.method, meta),
        schemaDirty: false,
      }));
      setSelectedId(schema.root.id ?? null);
      setDirty(true);
      setStep(2);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (isAppError(caught) && caught.code === "aborted") return;
      setInferError(
        isAppError(caught)
          ? caught
          : new AppError({ status: 0, code: "unknown_error", cause: caught }),
      );
    } finally {
      if (!controller.signal.aborted) setInferring(false);
    }
  }

  async function submit() {
    if (atLimit || duplicate) return;
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const endpointDraft: EndpointDraftLike = {
        method: draft.method,
        path: draft.path,
        sampleText: draft.sampleText,
        wrapInList: draft.wrapInList,
        schema: draft.schema,
        settings: draft.settings,
      };
      const input = buildEndpointInput(endpointDraft, meta);
      const created = await addEndpoint(slug, input, { token, baseUrl });
      onCreated(created);
      setDirty(false);
      onOpenChange(false);
    } catch (caught) {
      if (isAppError(caught)) {
        setSubmitError(caught);
        if (caught.errors) {
          setFieldErrors(caught.errors);
          if (Object.keys(caught.errors).some((key) => key.includes("method") || key.includes("path"))) {
            setStep(1);
          }
        } else if (caught.code === "duplicate_endpoint") {
          setFieldErrors({
            method: ["A duplicate endpoint uses this method and normalized path."],
            path: ["Change the path or the template names and try again."],
          });
          setStep(1);
        }
      } else {
        setSubmitError(
          new AppError({ status: 0, code: "unknown_error", cause: caught }),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function requestOpenChange(next: boolean) {
    if (!next && dirty) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(next);
  }

  const canGoNext =
    step < 4 &&
    (step !== 1 || Boolean(draft.schema)) &&
    (step !== 2 || Boolean(draft.schema));

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add endpoint</DialogTitle>
            <DialogDescription>
              Reuses the same sample, schema, settings and preview as the builder.
              {existingEndpoints.length} of {meta.limits.maxEndpointsPerProject} endpoints used.
            </DialogDescription>
          </DialogHeader>

          {atLimit ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-200"
            >
              <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                This project already has {existingEndpoints.length} endpoints, which is the
                limit from <code>/meta</code>. Delete an endpoint before adding another.
              </span>
            </div>
          ) : null}

          <nav aria-label="Add endpoint steps" className="flex flex-wrap gap-1">
            {STEP_LABELS.map((entry) => {
              const accessible =
                entry.id === 1 || (entry.id >= 2 && Boolean(draft.schema));
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={step === entry.id ? "step" : undefined}
                  disabled={!accessible}
                  onClick={() => accessible && setStep(entry.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    step === entry.id
                      ? "bg-lime-300 text-zinc-950"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                    !accessible && "cursor-not-allowed opacity-40",
                  )}
                >
                  {entry.id}. {entry.label}
                </button>
              );
            })}
          </nav>

          {step === 1 ? (
            <SampleForm
              sampleText={draft.sampleText}
              method={draft.method}
              path={draft.path}
              wrapInList={draft.wrapInList}
              meta={meta}
              inferring={inferring}
              error={inferError}
              fieldErrors={effectiveFieldErrors}
              onSampleText={updateSample}
              onMethod={(method) => updateDraft({ method })}
              onPath={(path) => updateDraft({ path })}
              onWrapInList={(wrapInList) => updateDraft({ wrapInList })}
              onInfer={() => void infer()}
            />
          ) : null}

          {step === 2 && draft.schema ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  Edit fields, types and generators. Pointers resolve against this schema.
                </p>
                <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Schema editing mode">
                  <Button
                    type="button"
                    size="xs"
                    variant={schemaMode === "visual" ? "secondary" : "ghost"}
                    aria-pressed={schemaMode === "visual"}
                    onClick={() => setSchemaMode("visual")}
                  >
                    Visual
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={schemaMode === "raw" ? "secondary" : "ghost"}
                    aria-pressed={schemaMode === "raw"}
                    onClick={() => setSchemaMode("raw")}
                  >
                    Raw JSON
                  </Button>
                </div>
              </div>
              {draft.warnings.filter((warning) => warning.path === null).length > 0 ? (
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
                  {draft.warnings
                    .filter((warning) => warning.path === null)
                    .map((warning) => warning.message)
                    .join(" ")}
                </div>
              ) : null}
              {schemaMode === "raw" ? (
                <RawSchemaEditor
                  schema={draft.schema}
                  onApply={(schema) => {
                    updateDraft({ schema, schemaDirty: true });
                    setSelectedId(schema.root.id ?? null);
                  }}
                />
              ) : (
                <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <SchemaTree
                    schema={draft.schema}
                    meta={meta}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    warnings={draft.warnings.filter((warning) => warning.path !== null)}
                  />
                  {selectedNode ? (
                    <SchemaInspector
                      schema={draft.schema}
                      node={selectedNode}
                      meta={meta}
                      onChange={(schema) => updateDraft({ schema, schemaDirty: true })}
                      onSelect={setSelectedId}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <SettingsEditor
              settings={draft.settings ?? defaultEndpointSettings(draft.method, meta)}
              meta={meta}
              schema={draft.schema}
              onChange={(settings) => updateDraft({ settings })}
            />
          ) : null}

          {step === 4 ? (
            <PreviewPanel schema={draft.schema} settings={draft.settings} />
          ) : null}

          {submitError ? <ErrorAlert error={submitError} /> : null}

          <DialogFooter className="flex-wrap">
            <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((current) => Math.max(1, current - 1) as LocalStep)}
                disabled={step === 1 || submitting}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Back
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep((current) => Math.min(4, current + 1) as LocalStep)}
                  disabled={!canGoNext || submitting}
                >
                  Next
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={!draft.schema || submitting || atLimit || duplicate}
            >
              {submitting ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : (
                <PlusIcon aria-hidden="true" />
              )}
              {submitting ? "Adding…" : "Add endpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Discard this endpoint?"
        description="The sample, schema and settings in this dialog will be lost."
        confirmLabel="Discard endpoint"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
