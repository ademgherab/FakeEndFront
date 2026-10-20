"use client";

import { useMemo } from "react";
import type {
  EndpointSettings,
  MetaResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultEndpointSettings, defaultPaginationSettings } from "@/lib/settings/defaults";
import { compatibleBindings, listArrayPointers, summarizeSchema } from "@/lib/schema/tree";
import { cn } from "cn";

export interface SettingsEditorProps {
  settings: EndpointSettings;
  meta: MetaResponse;
  schema: Schema | null;
  onChange: (settings: EndpointSettings) => void;
  className?: string;
}

function uniqNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseCodes(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((part) => Number(part.trim()))
        .filter((code) => Number.isInteger(code) && code >= 400 && code <= 599),
    ),
  ).sort((a, b) => a - b);
}

export function SettingsEditor({
  settings,
  meta,
  schema,
  onChange,
  className,
}: SettingsEditorProps) {
  const paginationDefaults = useMemo(() => defaultPaginationSettings(meta), [meta]);
  const arrayOptions = useMemo(
    () => (schema ? listArrayPointers(schema) : []),
    [schema],
  );
  const numericBindings = useMemo(
    () => (schema ? compatibleBindings(schema, ["integer", "number"]) : []),
    [schema],
  );
  const booleanBindings = useMemo(
    () => (schema ? compatibleBindings(schema, ["boolean"]) : []),
    [schema],
  );
  const summary = useMemo(() => summarizeSchema(schema), [schema]);

  const statusOptions = uniqNumbers(Object.values(meta.successStatuses));
  const maxErrorCodes = meta.limits.maxErrorCodes ?? 10;
  const maxDelay = meta.limits.maxDelayMs ?? meta.delay.maxMs;
  const maxList = meta.limits.maxListSize ?? meta.listSize.max;

  const delayInvalid = settings.delay.minMs > settings.delay.maxMs;
  const listInvalid = settings.list.minSize > settings.list.maxSize;
  const pagination = settings.pagination;
  const paginationInvalid =
    pagination !== null && pagination.defaultLimit > pagination.maxLimit;
  const paginationNeedsList =
    pagination !== null && settings.list.path === null && schema?.root.type !== "array";

  function update(patch: Partial<EndpointSettings>) {
    onChange({ ...settings, ...patch });
  }

  function updatePagination(patch: Partial<NonNullable<EndpointSettings["pagination"]>>) {
    const base = settings.pagination ?? paginationDefaults;
    onChange({ ...settings, pagination: { ...base, ...patch } });
  }

  return (
    <div className={cn("space-y-6", className)}>
      <section className="space-y-3" aria-labelledby="settings-response">
        <div>
          <h3 id="settings-response" className="text-sm font-semibold text-zinc-100">
            Response
          </h3>
          <p className="text-xs text-zinc-500">
            Status codes come from <code>/meta</code>.
          </p>
        </div>
        <label className="block max-w-xs space-y-1.5 text-sm">
          <span className="text-zinc-300">Success status</span>
          <select
            value={settings.successStatus}
            onChange={(event) => update({ successStatus: Number(event.target.value) })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status} className="bg-zinc-900">
                {status}
              </option>
            ))}
          </select>
          {settings.successStatus === 204 ? (
            <span className="block text-xs text-amber-300">
              204 means no response body. Request logs still record the call.
            </span>
          ) : null}
        </label>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="settings-delay">
        <div>
          <h3 id="settings-delay" className="text-sm font-semibold text-zinc-100">
            Delay
          </h3>
          <p className="text-xs text-zinc-500">
            Random delay between the minimum and maximum. Max {maxDelay.toLocaleString("en-US")} ms.
          </p>
        </div>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Minimum (ms)</span>
            <Input
              type="number"
              min={0}
              max={maxDelay}
              value={settings.delay.minMs}
              onChange={(event) =>
                update({
                  delay: {
                    ...settings.delay,
                    minMs: Math.max(0, Math.min(maxDelay, Number(event.target.value || 0))),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Maximum (ms)</span>
            <Input
              type="number"
              min={0}
              max={maxDelay}
              value={settings.delay.maxMs}
              onChange={(event) =>
                update({
                  delay: {
                    ...settings.delay,
                    maxMs: Math.max(0, Math.min(maxDelay, Number(event.target.value || 0))),
                  },
                })
              }
            />
          </label>
        </div>
        {delayInvalid ? (
          <p className="text-xs text-red-300">Minimum delay must not exceed the maximum.</p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="settings-errors">
        <div>
          <h3 id="settings-errors" className="text-sm font-semibold text-zinc-100">
            Random errors
          </h3>
          <p className="text-xs text-zinc-500">
            Rate is a percentage from {meta.errorRate.min} to {meta.errorRate.max}. Codes must be
            400–599; up to {maxErrorCodes}.
          </p>
        </div>
        <div className="grid max-w-md gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Error rate (%)</span>
            <Input
              type="number"
              min={meta.errorRate.min}
              max={meta.errorRate.max}
              step={meta.errorRate.maxDecimals ? 10 ** -meta.errorRate.maxDecimals : 1}
              value={settings.errorInjection.rate}
              onChange={(event) =>
                update({
                  errorInjection: {
                    ...settings.errorInjection,
                    rate: Math.max(
                      meta.errorRate.min,
                      Math.min(meta.errorRate.max, Number(event.target.value || 0)),
                    ),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Status codes</span>
            <Input
              value={settings.errorInjection.codes.join(", ")}
              onChange={(event) =>
                update({
                  errorInjection: {
                    ...settings.errorInjection,
                    codes: parseCodes(event.target.value).slice(0, maxErrorCodes),
                  },
                })
              }
              placeholder="500, 503"
              disabled={settings.errorInjection.rate <= 0}
            />
          </label>
        </div>
        {settings.errorInjection.rate > 0 && settings.errorInjection.codes.length === 0 ? (
          <p className="text-xs text-red-300">Add at least one error status code.</p>
        ) : null}
        {settings.errorInjection.rate <= 0 ? (
          <p className="text-xs text-zinc-500">Error injection is off while the rate is 0%.</p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="settings-list">
        <div>
          <h3 id="settings-list" className="text-sm font-semibold text-zinc-100">
            List
          </h3>
          <p className="text-xs text-zinc-500">
            Choose the array inside the response. The root is only offered when the root is an array.
          </p>
        </div>
        <label className="block space-y-1 text-xs">
          <span className="text-zinc-300">Array path</span>
          <select
            value={settings.list.path ?? ""}
            onChange={(event) =>
              update({
                list: { ...settings.list, path: event.target.value ? event.target.value : null },
              })
            }
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="" className="bg-zinc-900">
              No list path
            </option>
            {arrayOptions.map((option) => (
              <option key={option.pointer || "root"} value={option.pointer} className="bg-zinc-900">
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Minimum size</span>
            <Input
              type="number"
              min={0}
              max={maxList}
              value={settings.list.minSize}
              disabled={pagination !== null}
              onChange={(event) =>
                update({
                  list: {
                    ...settings.list,
                    minSize: Math.max(0, Math.min(maxList, Number(event.target.value || 0))),
                  },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-zinc-300">Maximum size</span>
            <Input
              type="number"
              min={0}
              max={maxList}
              value={settings.list.maxSize}
              disabled={pagination !== null}
              onChange={(event) =>
                update({
                  list: {
                    ...settings.list,
                    maxSize: Math.max(0, Math.min(maxList, Number(event.target.value || 0))),
                  },
                })
              }
            />
          </label>
        </div>
        {pagination !== null ? (
          <p className="text-xs text-zinc-500">
            Pagination is on: list size is ignored because <code>limit</code> controls page size.
          </p>
        ) : null}
        {listInvalid ? (
          <p className="text-xs text-red-300">Minimum list size must not exceed the maximum.</p>
        ) : null}
        <p className="text-xs text-zinc-500">
          The schema has {summary.leaves} leaf{summary.leaves === 1 ? "" : "s"} and{" "}
          {summary.nodes} node{summary.nodes === 1 ? "" : "s"}.
        </p>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="settings-pagination">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="settings-pagination" className="text-sm font-semibold text-zinc-100">
              Pagination
            </h3>
            <p className="text-xs text-zinc-500">
              Bind response fields to page, limit and totals.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={pagination !== null}
              onChange={(event) =>
                update({
                  pagination: event.target.checked ? paginationDefaults : null,
                })
              }
              className="size-4 rounded border-white/20 bg-transparent accent-lime-300"
            />
            Enable pagination
          </label>
        </div>

        {pagination ? (
          <>
            <div className="grid max-w-md grid-cols-3 gap-3">
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-300">Total items</span>
                <Input
                  type="number"
                  min={0}
                  max={meta.pagination.maxTotalItems}
                  value={pagination.totalItems}
                  onChange={(event) =>
                    updatePagination({
                      totalItems: Math.max(
                        0,
                        Math.min(meta.pagination.maxTotalItems, Number(event.target.value || 0)),
                      ),
                    })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-300">Default limit</span>
                <Input
                  type="number"
                  min={1}
                  max={meta.pagination.maxLimit}
                  value={pagination.defaultLimit}
                  onChange={(event) =>
                    updatePagination({
                      defaultLimit: Math.max(
                        1,
                        Math.min(meta.pagination.maxLimit, Number(event.target.value || 1)),
                      ),
                    })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-300">Max limit</span>
                <Input
                  type="number"
                  min={1}
                  max={meta.pagination.maxLimit}
                  value={pagination.maxLimit}
                  onChange={(event) =>
                    updatePagination({
                      maxLimit: Math.max(
                        1,
                        Math.min(meta.pagination.maxLimit, Number(event.target.value || 1)),
                      ),
                    })
                  }
                />
              </label>
            </div>
            {paginationInvalid ? (
              <p className="text-xs text-red-300">Default limit must not exceed the max limit.</p>
            ) : null}
            {paginationNeedsList ? (
              <p className="text-xs text-red-300">
                Pagination needs an array: choose a list path above or use an array root.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "pageBinding", label: "Page", options: numericBindings },
                { key: "limitBinding", label: "Limit", options: numericBindings },
                { key: "totalBinding", label: "Total", options: numericBindings },
                { key: "totalPagesBinding", label: "Total pages", options: numericBindings },
                { key: "hasNextBinding", label: "Has next", options: booleanBindings },
                { key: "hasPrevBinding", label: "Has previous", options: booleanBindings },
              ].map((binding) => (
                <label key={binding.key} className="block space-y-1 text-xs">
                  <span className="text-zinc-300">{binding.label} binding</span>
                  <select
                    value={pagination[binding.key as keyof typeof pagination] as string | null ?? ""}
                    onChange={(event) =>
                      updatePagination({
                        [binding.key]: event.target.value || null,
                      })
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="" className="bg-zinc-900">
                      Not bound
                    </option>
                    {binding.options.map((option) => (
                      <option key={option.pointer} value={option.pointer} className="bg-zinc-900">
                        {option.label} — {option.pointer}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="settings-seed">
        <div>
          <h3 id="settings-seed" className="text-sm font-semibold text-zinc-100">
            Seed
          </h3>
          <p className="text-xs text-zinc-500">
            Optional. The same seed produces repeatable output for this endpoint.
          </p>
        </div>
        <label className="block max-w-xs space-y-1 text-xs">
          <span className="text-zinc-300">Seed (integer)</span>
          <Input
            type="number"
            step={1}
            value={settings.seed ?? ""}
            onChange={(event) =>
              update({
                seed: event.target.value === "" ? null : Math.trunc(Number(event.target.value)),
              })
            }
            placeholder="Random each request"
          />
        </label>
      </section>

      <div className="flex justify-end border-t border-white/10 pt-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(defaultEndpointSettings("GET", meta))}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
