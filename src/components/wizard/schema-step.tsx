"use client";

import { useEffect, useMemo, useState } from "react";
import { BracesIcon, Redo2Icon, TriangleAlertIcon, Undo2Icon } from "lucide-react";
import type {
  EndpointSettings,
  InferSuggestion,
  InferWarning,
  MetaResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { SchemaTree } from "@/components/schema/schema-tree";
import { SchemaInspector } from "@/components/schema/schema-inspector";
import { RawSchemaEditor } from "@/components/schema/raw-schema-editor";
import { SuggestionsBanner } from "@/components/wizard/suggestions-banner";
import { findNodeById, schemaLimitProblems, summarizeSchema } from "@/lib/schema/tree";

export interface SchemaStepProps {
  schema: Schema | null;
  meta: MetaResponse;
  warnings: InferWarning[];
  suggestions: InferSuggestion[];
  settings: EndpointSettings | null;
  dismissedSuggestionKeys: string[];
  schemaDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSchemaChange: (schema: Schema) => void;
  onSettingsChange: (settings: EndpointSettings) => void;
  onDismissSuggestions: (keys: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onBackToSample: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function SchemaStep({
  schema,
  meta,
  warnings,
  suggestions,
  settings,
  dismissedSuggestionKeys,
  schemaDirty,
  canUndo,
  canRedo,
  onSchemaChange,
  onSettingsChange,
  onDismissSuggestions,
  onUndo,
  onRedo,
  onBackToSample,
}: SchemaStepProps) {
  const [mode, setMode] = useState<"visual" | "raw">("visual");
  const [selectedIdState, setSelectedId] = useState<string | null>(schema?.root.id ?? null);

  const selectedId =
    schema && selectedIdState && findNodeById(schema, selectedIdState)
      ? selectedIdState
      : schema?.root.id ?? null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) onRedo();
      else onUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRedo, onUndo]);

  const selectedNode = schema ? findNodeById(schema, selectedId) : null;
  const summary = useMemo(() => summarizeSchema(schema), [schema]);
  const limitProblems = useMemo(
    () => schemaLimitProblems(schema, meta.limits),
    [schema, meta.limits],
  );
  const bannerWarnings = warnings.filter((warning) => warning.path === null);
  const nodeWarnings = warnings.filter((warning) => warning.path !== null);

  if (!schema) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center">
        <BracesIcon aria-hidden="true" className="mx-auto size-6 text-zinc-500" />
        <h2 className="mt-3 text-sm font-semibold text-zinc-100">No schema yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">
          Go back to the sample step and infer a schema before editing it.
        </p>
        <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onBackToSample}>
          Back to sample
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            {summary.nodes.toLocaleString("en-US")} / {meta.limits.maxSchemaNodes.toLocaleString("en-US")} nodes
          </span>
          <span aria-hidden="true">·</span>
          <span>
            depth {summary.depth} / {meta.limits.maxSchemaDepth}
          </span>
          {schemaDirty ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">
              Edited
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo schema edit"
          >
            <Undo2Icon aria-hidden="true" />
            Undo
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo schema edit"
          >
            <Redo2Icon aria-hidden="true" />
            Redo
          </Button>
          <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Schema editing mode">
            <Button
              type="button"
              size="xs"
              variant={mode === "visual" ? "secondary" : "ghost"}
              aria-pressed={mode === "visual"}
              onClick={() => setMode("visual")}
            >
              Visual
            </Button>
            <Button
              type="button"
              size="xs"
              variant={mode === "raw" ? "secondary" : "ghost"}
              aria-pressed={mode === "raw"}
              onClick={() => setMode("raw")}
            >
              Raw JSON
            </Button>
          </div>
        </div>
      </div>

      {limitProblems.length > 0 ? (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-xs text-red-200">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlertIcon aria-hidden="true" className="size-4" />
            This schema exceeds the server limits
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {limitProblems.map((problem) => (
              <li key={problem.field}>{problem.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {bannerWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
          <p className="font-semibold">Inference warnings (advisory)</p>
          <ul className="mt-1 space-y-0.5">
            {bannerWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <SuggestionsBanner
        schema={schema}
        settings={settings}
        suggestions={suggestions}
        dismissedKeys={dismissedSuggestionKeys}
        meta={meta}
        onSettingsChange={onSettingsChange}
        onDismiss={onDismissSuggestions}
      />

      {mode === "raw" ? (
        <RawSchemaEditor schema={schema} onApply={onSchemaChange} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SchemaTree
            schema={schema}
            meta={meta}
            selectedId={selectedId}
            onSelect={setSelectedId}
            warnings={nodeWarnings}
          />
          {selectedNode ? (
            <div className="lg:sticky lg:top-4">
              <SchemaInspector
                schema={schema}
                node={selectedNode}
                meta={meta}
                onChange={onSchemaChange}
                onSelect={setSelectedId}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-400">
              Select a field in the tree to edit it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
