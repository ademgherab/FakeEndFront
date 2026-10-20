"use client";

import { useMemo } from "react";
import type {
  EndpointSettings,
  HttpMethod,
  MetaResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { SettingsEditor } from "@/components/settings/settings-editor";
import { Input } from "@/components/ui/input";
import { validatePath } from "@/lib/wizard/validation";

export interface EndpointSettingsTabProps {
  method: HttpMethod;
  path: string;
  schema: Schema;
  settings: EndpointSettings;
  meta: MetaResponse;
  pathServerErrors: string[];
  onMethodChange: (method: HttpMethod) => void;
  onPathChange: (path: string) => void;
  onSettingsChange: (settings: EndpointSettings) => void;
}

export function EndpointSettingsTab({
  method,
  path,
  schema,
  settings,
  meta,
  pathServerErrors,
  onMethodChange,
  onPathChange,
  onSettingsChange,
}: EndpointSettingsTabProps) {
  const pathValidation = useMemo(() => validatePath(path), [path]);
  const pathErrors = [...pathValidation.errors, ...pathServerErrors];

  return (
    <div className="space-y-6">
      <section
        className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
        aria-labelledby="endpoint-route-heading"
      >
        <div>
          <h3
            id="endpoint-route-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Route
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Changing the method or path saves the whole endpoint and keeps the
            current schema and settings.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-300">Method</span>
            <select
              value={method}
              onChange={(event) =>
                onMethodChange(event.target.value as HttpMethod)
              }
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {meta.methods.map((allowed) => (
                <option key={allowed} value={allowed} className="bg-zinc-900">
                  {allowed}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-zinc-300">Path</span>
            <Input
              value={path}
              onChange={(event) => onPathChange(event.target.value)}
              className="font-mono"
              placeholder="/items/{id}"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={pathErrors.length > 0 || undefined}
            />
            {pathErrors.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-red-300">
                {pathErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              <span className="block text-xs text-zinc-500">
                Templates such as {"{id}"} become URL inputs in Try it.
              </span>
            )}
          </label>
        </div>
      </section>

      <SettingsEditor
        settings={settings}
        meta={meta}
        schema={schema}
        onChange={onSettingsChange}
      />
    </div>
  );
}
