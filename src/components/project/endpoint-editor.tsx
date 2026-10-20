"use client";

import { useMemo, useState } from "react";
import type {
  Endpoint,
  EndpointSettings,
  MetaResponse,
  Method,
  Schema,
} from "@/lib/types";
import {
  ApiError,
  deleteEndpoint,
  replaceEndpoint,
  replaceEndpointSchema,
} from "@/lib/api";
import {
  FALLBACK_META,
  limitsFromMeta,
  normalizeSettings,
} from "@/lib/defaults";
import {
  validatePath,
  validateSettings,
  validateSettingsAgainstSchema,
  type FieldErrors,
} from "@/lib/validation";
import { SettingsForm } from "@/components/builder/settings-form";
import { ErrorBanner } from "@/components/builder/error-banner";

export interface EndpointEditorProps {
  projectSlug: string;
  token: string;
  endpoint: Endpoint;
  meta: MetaResponse | null;
  onUpdated: (endpoint: Endpoint) => void;
  onDeleted: (endpointId: string) => void;
}

export function EndpointEditor({
  projectSlug,
  token,
  endpoint,
  meta,
  onUpdated,
  onDeleted,
}: EndpointEditorProps) {
  const [method, setMethod] = useState<Method>(endpoint.method);
  const [path, setPath] = useState(endpoint.path);
  const [settings, setSettings] = useState<EndpointSettings>(() =>
    normalizeSettings(endpoint.settings, endpoint.method),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError["problem"] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [schemaText, setSchemaText] = useState(() =>
    JSON.stringify(endpoint.schema, null, 2),
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [savingSchema, setSavingSchema] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  // The form is remounted per endpoint (the parent passes `key={endpoint.id}`),
  // so the initial state is always the endpoint that is being edited.

  const limits = limitsFromMeta(meta);
  const pathValidation = useMemo(
    () => validatePath(path, limits.maxPathLength),
    [path, limits.maxPathLength],
  );
  const settingsValidation = useMemo(
    () =>
      validateSettings(
        settings,
        method,
        limits,
        meta?.errorStatusRange ?? FALLBACK_META.errorStatusRange,
      ),
    [settings, method, limits, meta],
  );
  const schemaValidation = useMemo(
    () => validateSettingsAgainstSchema(settings, endpoint.schema),
    [settings, endpoint.schema],
  );

  const errors: FieldErrors = {
    ...settingsValidation.errors,
    ...schemaValidation.errors,
    ...(pathValidation.valid ? {} : { path: pathValidation.errors }),
  };
  const valid =
    settingsValidation.valid && schemaValidation.valid && pathValidation.valid;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const updated = await replaceEndpoint(projectSlug, token, endpoint.id, {
        method,
        path: pathValidation.value,
        schema: endpoint.schema,
        settings,
      });
      onUpdated(updated);
      setSaved(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.problem);
        setFieldErrors(caught.problem.errors ?? {});
      } else {
        setError({ title: "Could not save the endpoint." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSchema() {
    if (savingSchema) return;
    let parsed: Schema;
    try {
      parsed = JSON.parse(schemaText) as Schema;
    } catch {
      setSchemaError("The schema is not valid JSON.");
      return;
    }
    setSchemaError(null);
    setSavingSchema(true);
    try {
      const updated = await replaceEndpointSchema(
        projectSlug,
        token,
        endpoint.id,
        parsed,
      );
      onUpdated(updated);
      setSchemaText(JSON.stringify(updated.schema, null, 2));
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSchemaError(
          `${caught.problem.code ?? caught.status}: ${caught.problem.detail ?? caught.problem.title ?? "The schema was rejected."}`,
        );
      } else {
        setSchemaError("The schema could not be replaced.");
      }
    } finally {
      setSavingSchema(false);
    }
  }

  async function remove() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEndpoint(projectSlug, token, endpoint.id);
      onDeleted(endpoint.id);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.problem);
      } else {
        setError({ title: "Could not delete the endpoint." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">
          {method} {pathValidation.value}
        </h2>
        <button
          type="button"
          onClick={() => {
            void remove();
          }}
          disabled={saving}
          className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-400/10 disabled:opacity-50"
        >
          Delete endpoint
        </button>
      </div>

      <SettingsForm
        method={method}
        path={path}
        settings={settings}
        errors={errors}
        limits={limits}
        successStatuses={meta?.successStatuses ?? FALLBACK_META.successStatuses}
        errorRange={meta?.errorStatusRange ?? FALLBACK_META.errorStatusRange}
        onChange={(next) => {
          setMethod(next.method);
          setPath(next.path);
          setSettings(next.settings);
          setSaved(false);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={!valid || saving}
          aria-busy={saving}
          className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save endpoint"}
        </button>
        {saved ? (
          <p role="status" className="text-xs text-lime-300">
            Saved.
          </p>
        ) : null}
        {!valid ? (
          <p className="text-xs text-zinc-400">Fix the highlighted fields to save.</p>
        ) : null}
      </div>

      {error ? <ErrorBanner error={error} errors={fieldErrors} /> : null}

      <details
        className="rounded-lg border border-white/10 bg-black/20"
        open={schemaOpen}
        onToggle={(event) => setSchemaOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-200">
          Schema
        </summary>
        <div className="space-y-2 border-t border-white/10 p-3">
          <label htmlFor={`schema-${endpoint.id}`} className="block text-xs text-zinc-400">
            Schema JSON. Replacing it re-validates the current settings.
          </label>
          <textarea
            id={`schema-${endpoint.id}`}
            value={schemaText}
            onChange={(event) => setSchemaText(event.target.value)}
            spellCheck={false}
            className="h-56 w-full resize-y rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 text-zinc-100 outline-none"
          />
          {schemaError ? (
            <p role="alert" className="text-xs text-red-300">
              {schemaError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void saveSchema();
            }}
            disabled={savingSchema}
            aria-busy={savingSchema}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10 disabled:opacity-50"
          >
            {savingSchema ? "Replacing…" : "Replace schema"}
          </button>
        </div>
      </details>
    </section>
  );
}
