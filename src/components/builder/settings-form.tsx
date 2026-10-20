"use client";

import type { EndpointSettings, MetaLimits, Method } from "@/lib/types";
import {
  DEFAULT_SUCCESS_STATUS,
  FALLBACK_META,
  LIMITS,
  METHODS,
  SETTINGS_PRESETS,
  cloneSettings,
} from "@/lib/defaults";
import type { FieldErrors } from "@/lib/validation";
import { normalizePath } from "@/lib/validation";

export interface SettingsFormProps {
  method: Method;
  path: string;
  settings: EndpointSettings;
  errors: FieldErrors;
  /** Limits from `GET /api/v1/meta`, with the fallback defaults when absent. */
  limits?: MetaLimits;
  /** Allowed success statuses from meta, with the fallback defaults when absent. */
  successStatuses?: number[];
  errorRange?: { min: number; max: number };
  /** Hides the path field when the path is fixed (endpoint editor). */
  hidePath?: boolean;
  onChange: (next: {
    method: Method;
    path: string;
    settings: EndpointSettings;
  }) => void;
}

function fieldId(key: string): string {
  return `settings-${key.replace(/\./g, "-")}`;
}

/** Error text lives in its own id so it can be referenced by aria-describedby. */
function errorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function describeIds(keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;
  return keys.map(errorId).join(" ");
}

type DelaySettings = NonNullable<EndpointSettings["delay"]>;
type ErrorSettings = NonNullable<EndpointSettings["errors"]>;
type ListSettings = NonNullable<EndpointSettings["list"]>;
type ListSize = NonNullable<ListSettings["size"]>;
type PaginationSettings = NonNullable<EndpointSettings["pagination"]>;
type PaginationBindings = NonNullable<PaginationSettings["bindings"]>;

const BINDING_FIELDS: Array<{ name: keyof PaginationBindings; label: string }> = [
  { name: "page", label: "page" },
  { name: "limit", label: "limit" },
  { name: "total", label: "total" },
  { name: "totalPages", label: "totalPages" },
  { name: "hasNext", label: "hasNext" },
  { name: "hasPrev", label: "hasPrev" },
];

export function SettingsForm({
  method,
  path,
  settings,
  errors,
  limits = FALLBACK_META.limits,
  successStatuses = FALLBACK_META.successStatuses,
  errorRange = FALLBACK_META.errorStatusRange,
  hidePath = false,
  onChange,
}: SettingsFormProps) {
  const setSettings = (patch: Partial<EndpointSettings>) =>
    onChange({ method, path, settings: { ...settings, ...patch } });

  // The sub-objects of `EndpointSettings` are optional, so a plain spread
  // (`{ ...settings.delay, ...patch }`) widens their required keys to optional
  // ones. The merge is spelled out to keep every key required.
  const setDelay = (patch: Partial<DelaySettings>) => {
    const base = settings.delay ?? { minMs: 0, maxMs: 0 };
    setSettings({
      delay: {
        minMs: patch.minMs ?? base.minMs,
        maxMs: patch.maxMs ?? base.maxMs,
      },
    });
  };

  const setErrors = (patch: Partial<ErrorSettings>) => {
    const base = settings.errors ?? { ratePercent: 0, statusCodes: [500] };
    setSettings({
      errors: {
        ratePercent: patch.ratePercent ?? base.ratePercent,
        statusCodes: patch.statusCodes ?? base.statusCodes,
      },
    });
  };

  const setList = (patch: Partial<ListSettings>) => {
    const base = settings.list ?? { path: null, size: { min: 10, max: 10 } };
    setSettings({
      list: {
        path: patch.path !== undefined ? patch.path : (base.path ?? null),
        size: patch.size
          ? {
              min: patch.size.min ?? base.size?.min ?? 10,
              max: patch.size.max ?? base.size?.max ?? 10,
            }
          : base.size
            ? { ...base.size }
            : undefined,
      },
    });
  };

  const setPagination = (patch: Partial<PaginationSettings>) => {
    const base = settings.pagination ?? {};
    setSettings({
      pagination: {
        enabled: patch.enabled ?? base.enabled ?? false,
        totalItems: patch.totalItems ?? base.totalItems ?? 100,
        defaultLimit: patch.defaultLimit ?? base.defaultLimit ?? 10,
        maxLimit: patch.maxLimit ?? base.maxLimit ?? 100,
        bindings: patch.bindings ?? base.bindings ?? {},
      },
    });
  };

  const setBinding = (name: keyof PaginationBindings, value: string | null) => {
    const base = settings.pagination?.bindings ?? {};
    setPagination({ bindings: { ...base, [name]: value === "" ? null : value } });
  };

  const pathErrors = errors.path ?? [];
  const methodErrors = errors.method ?? [];

  function applyPreset(id: string) {
    const preset = SETTINGS_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    onChange({
      method,
      path,
      settings: {
        ...cloneSettings(preset.settings),
        successStatus: DEFAULT_SUCCESS_STATUS[method],
        list: {
          path: settings.list?.path ?? null,
          size: { ...(preset.settings.list?.size ?? { min: 10, max: 10 }) },
        },
        pagination: settings.pagination
          ? { ...settings.pagination }
          : undefined,
      },
    });
  }

  const pagination = settings.pagination ?? {};
  const paginationEnabled = pagination.enabled === true;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-100">Presets</span>
        {SETTINGS_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={fieldId("method")} className="block text-sm font-medium text-zinc-100">
            Method
          </label>
          <select
            id={fieldId("method")}
            value={method}
            onChange={(event) => onChange({
              method: event.target.value as Method,
              path,
              settings: { ...settings, successStatus: DEFAULT_SUCCESS_STATUS[event.target.value as Method] },
            })}
            aria-invalid={methodErrors.length > 0 || undefined}
            aria-describedby={describeIds(methodErrors.length > 0 ? ["method"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            {METHODS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          {methodErrors.map((message) => (
            <p key={message} id={errorId("method")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>

        {!hidePath ? (
          <div className="space-y-1.5">
            <label htmlFor={fieldId("path")} className="block text-sm font-medium text-zinc-100">
              Path
            </label>
            <input
              id={fieldId("path")}
              value={path}
              onChange={(event) => onChange({ method, path: event.target.value, settings })}
              aria-invalid={pathErrors.length > 0 || undefined}
              aria-describedby={describeIds(pathErrors.length > 0 ? ["path"] : [])}
              placeholder="/users"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none"
            />
            {pathErrors.map((message) => (
              <p key={message} id={errorId("path")} className="text-xs text-red-300">
                {message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor={fieldId("successStatus")} className="block text-sm font-medium text-zinc-100">
            Success status
          </label>
          <select
            id={fieldId("successStatus")}
            value={String(settings.successStatus ?? DEFAULT_SUCCESS_STATUS[method])}
            onChange={(event) => setSettings({ successStatus: Number(event.target.value) as 200 | 201 | 202 | 204 })}
            aria-invalid={(errors.successStatus?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors.successStatus?.length ?? 0) > 0 ? ["successStatus"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            {successStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {(errors.successStatus ?? []).map((message) => (
            <p key={message} id={errorId("successStatus")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={fieldId("list.path")} className="block text-sm font-medium text-zinc-100">
            List path
          </label>
          <input
            id={fieldId("list.path")}
            value={settings.list?.path ?? ""}
            onChange={(event) => setList({ path: event.target.value === "" ? null : event.target.value })}
            aria-invalid={(errors["list.path"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["list.path"]?.length ?? 0) > 0 ? ["list.path"] : [])}
            placeholder="/items or empty for the root array"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none"
          />
          <p className="text-xs text-zinc-400">
            RFC 6901 pointer to the array inside the response. Leave empty when
            the root itself is the array.
          </p>
          {(errors["list.path"] ?? []).map((message) => (
            <p key={message} id={errorId("list.path")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={fieldId("delay.minMs")} className="block text-sm font-medium text-zinc-100">
            Delay min (ms)
          </label>
          <input
            id={fieldId("delay.minMs")}
            type="number"
            inputMode="numeric"
            min={LIMITS.delay.minMs}
            max={limits.maxDelayMs}
            value={settings.delay?.minMs ?? 0}
            onChange={(event) => setDelay({ minMs: Number(event.target.value) })}
            aria-invalid={(errors["delay.minMs"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["delay.minMs"]?.length ?? 0) > 0 ? ["delay.minMs"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          {(errors["delay.minMs"] ?? []).map((message) => (
            <p key={message} id={errorId("delay.minMs")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={fieldId("delay.maxMs")} className="block text-sm font-medium text-zinc-100">
            Delay max (ms)
          </label>
          <input
            id={fieldId("delay.maxMs")}
            type="number"
            inputMode="numeric"
            min={LIMITS.delay.minMs}
            max={limits.maxDelayMs}
            value={settings.delay?.maxMs ?? 0}
            onChange={(event) => setDelay({ maxMs: Number(event.target.value) })}
            aria-invalid={(errors["delay.maxMs"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["delay.maxMs"]?.length ?? 0) > 0 ? ["delay.maxMs"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          {(errors["delay.maxMs"] ?? []).map((message) => (
            <p key={message} id={errorId("delay.maxMs")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={fieldId("errors.ratePercent")} className="block text-sm font-medium text-zinc-100">
            Error rate (%)
          </label>
          <input
            id={fieldId("errors.ratePercent")}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={LIMITS.errorRate.min}
            max={LIMITS.errorRate.max}
            value={settings.errors?.ratePercent ?? 0}
            onChange={(event) => setErrors({ ratePercent: Number(event.target.value) })}
            aria-invalid={(errors["errors.ratePercent"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["errors.ratePercent"]?.length ?? 0) > 0 ? ["errors.ratePercent"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          {(errors["errors.ratePercent"] ?? []).map((message) => (
            <p key={message} id={errorId("errors.ratePercent")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={fieldId("errors.statusCodes")} className="block text-sm font-medium text-zinc-100">
            Error status codes
          </label>
          <input
            id={fieldId("errors.statusCodes")}
            value={(settings.errors?.statusCodes ?? []).join(", ")}
            onChange={(event) => {
              const codes = event.target.value
                .split(",")
                .map((part) => part.trim())
                .filter((part) => part.length > 0)
                .map((part) => Number(part))
                .filter((code) => Number.isInteger(code));
              setErrors({ statusCodes: codes });
            }}
            aria-invalid={(errors["errors.statusCodes"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["errors.statusCodes"]?.length ?? 0) > 0 ? ["errors.statusCodes"] : [])}
            placeholder="500, 503"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          <p className="text-xs text-zinc-400">
            Comma-separated, {LIMITS.errorCodes.minCount}–{limits.maxErrorStatusCodes} unique codes between {errorRange.min} and {errorRange.max}.
          </p>
          {(errors["errors.statusCodes"] ?? []).map((message) => (
            <p key={message} id={errorId("errors.statusCodes")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={fieldId("list.size.min")} className="block text-sm font-medium text-zinc-100">
            List size min
          </label>
          <input
            id={fieldId("list.size.min")}
            type="number"
            inputMode="numeric"
            min={0}
            max={limits.maxListSize}
            value={settings.list?.size?.min ?? 10}
            onChange={(event) => setList({ size: { min: Number(event.target.value) } as ListSize })}
            aria-invalid={(errors["list.size.min"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["list.size.min"]?.length ?? 0) > 0 ? ["list.size.min"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          {(errors["list.size.min"] ?? []).map((message) => (
            <p key={message} id={errorId("list.size.min")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={fieldId("list.size.max")} className="block text-sm font-medium text-zinc-100">
            List size max
          </label>
          <input
            id={fieldId("list.size.max")}
            type="number"
            inputMode="numeric"
            min={0}
            max={limits.maxListSize}
            value={settings.list?.size?.max ?? 10}
            onChange={(event) => setList({ size: { max: Number(event.target.value) } as ListSize })}
            aria-invalid={(errors["list.size.max"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["list.size.max"]?.length ?? 0) > 0 ? ["list.size.max"] : [])}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          {(errors["list.size.max"] ?? []).map((message) => (
            <p key={message} id={errorId("list.size.max")} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <label className="flex items-center gap-3 text-sm text-zinc-100">
          <input
            id={fieldId("pagination.enabled")}
            type="checkbox"
            checked={paginationEnabled}
            onChange={(event) => setPagination({ enabled: event.target.checked })}
            aria-invalid={(errors["pagination.enabled"]?.length ?? 0) > 0 || undefined}
            aria-describedby={describeIds((errors["pagination.enabled"]?.length ?? 0) > 0 ? ["pagination.enabled"] : [])}
            className="size-4 rounded border-white/20 bg-transparent accent-lime-300"
          />
          <span>Enable pagination</span>
        </label>
        {(errors["pagination.enabled"] ?? []).map((message) => (
          <p key={message} id={errorId("pagination.enabled")} className="text-xs text-red-300">
            {message}
          </p>
        ))}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor={fieldId("pagination.totalItems")} className="block text-sm font-medium text-zinc-100">
              Total items
            </label>
            <input
              id={fieldId("pagination.totalItems")}
              type="number"
              inputMode="numeric"
              min={LIMITS.pagination.totalItems.min}
              max={limits.maxPaginationTotalItems}
              value={pagination.totalItems ?? 100}
              onChange={(event) => setPagination({ totalItems: Number(event.target.value) })}
              aria-invalid={(errors["pagination.totalItems"]?.length ?? 0) > 0 || undefined}
              aria-describedby={describeIds((errors["pagination.totalItems"]?.length ?? 0) > 0 ? ["pagination.totalItems"] : [])}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            {(errors["pagination.totalItems"] ?? []).map((message) => (
              <p key={message} id={errorId("pagination.totalItems")} className="text-xs text-red-300">
                {message}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={fieldId("pagination.defaultLimit")} className="block text-sm font-medium text-zinc-100">
              Default limit
            </label>
            <input
              id={fieldId("pagination.defaultLimit")}
              type="number"
              inputMode="numeric"
              min={LIMITS.pagination.limit.min}
              max={limits.maxPaginationLimit}
              value={pagination.defaultLimit ?? 10}
              onChange={(event) => setPagination({ defaultLimit: Number(event.target.value) })}
              aria-invalid={(errors["pagination.defaultLimit"]?.length ?? 0) > 0 || undefined}
              aria-describedby={describeIds((errors["pagination.defaultLimit"]?.length ?? 0) > 0 ? ["pagination.defaultLimit"] : [])}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            {(errors["pagination.defaultLimit"] ?? []).map((message) => (
              <p key={message} id={errorId("pagination.defaultLimit")} className="text-xs text-red-300">
                {message}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={fieldId("pagination.maxLimit")} className="block text-sm font-medium text-zinc-100">
              Max limit
            </label>
            <input
              id={fieldId("pagination.maxLimit")}
              type="number"
              inputMode="numeric"
              min={LIMITS.pagination.limit.min}
              max={limits.maxPaginationLimit}
              value={pagination.maxLimit ?? 100}
              onChange={(event) => setPagination({ maxLimit: Number(event.target.value) })}
              aria-invalid={(errors["pagination.maxLimit"]?.length ?? 0) > 0 || undefined}
              aria-describedby={describeIds((errors["pagination.maxLimit"]?.length ?? 0) > 0 ? ["pagination.maxLimit"] : [])}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            {(errors["pagination.maxLimit"] ?? []).map((message) => (
              <p key={message} id={errorId("pagination.maxLimit")} className="text-xs text-red-300">
                {message}
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Pagination bindings
          </p>
          <p className="text-xs text-zinc-400">
            Pointers to the fields that receive the real page values. Leave
            empty to keep the generated values.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BINDING_FIELDS.map((binding) => {
              const key = `pagination.bindings.${binding.name}`;
              return (
                <div key={binding.name} className="space-y-1.5">
                  <label
                    htmlFor={fieldId(key)}
                    className="block text-sm font-medium text-zinc-100"
                  >
                    {binding.label}
                  </label>
                  <input
                    id={fieldId(key)}
                    value={pagination.bindings?.[binding.name] ?? ""}
                    onChange={(event) => setBinding(binding.name, event.target.value)}
                    aria-invalid={(errors[key]?.length ?? 0) > 0 || undefined}
                    aria-describedby={describeIds((errors[key]?.length ?? 0) > 0 ? [key] : [])}
                    placeholder="/page"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none"
                  />
                  {(errors[key] ?? []).map((message) => (
                    <p key={message} id={errorId(key)} className="text-xs text-red-300">
                      {message}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Convenience wrapper so the builder can read the normalized path. */
export function normalizedPath(path: string): string {
  return normalizePath(path);
}
