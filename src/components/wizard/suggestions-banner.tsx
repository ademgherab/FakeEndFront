"use client";

import { useMemo, useState } from "react";
import { LightbulbIcon, XIcon } from "lucide-react";
import type {
  EndpointSettings,
  InferSuggestion,
  MetaResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { defaultPaginationSettings } from "@/lib/settings/defaults";
import {
  applySuggestionPlan,
  buildSuggestionPlan,
  suggestionConflicts,
  type PaginationBindingKey,
  type SuggestionPlan,
} from "@/lib/wizard/suggestions";

export interface SuggestionsBannerProps {
  schema: Schema;
  settings: EndpointSettings | null;
  suggestions: InferSuggestion[];
  dismissedKeys: string[];
  meta: MetaResponse;
  onSettingsChange: (settings: EndpointSettings) => void;
  onDismiss: (keys: string[]) => void;
}

interface PendingApply {
  plan: SuggestionPlan;
  applyListPath: boolean;
  applyBindings: boolean;
  dismissKeys: string[];
}

export function SuggestionsBanner({
  schema,
  settings,
  suggestions,
  dismissedKeys,
  meta,
  onSettingsChange,
  onDismiss,
}: SuggestionsBannerProps) {
  const plan = useMemo(
    () => buildSuggestionPlan(schema, suggestions),
    [schema, suggestions],
  );
  const dismissed = useMemo(() => new Set(dismissedKeys), [dismissedKeys]);
  const items = plan.items.filter((item) => !dismissed.has(item.id));
  const [pending, setPending] = useState<PendingApply | null>(null);

  if (!settings || items.length === 0) return null;

  const visibleList = items.some((item) => item.kind === "list");
  const visibleBindings = items.filter((item) => item.kind === "binding");
  const dismissedItemKeys = items.map((item) => item.id);

  function apply(target: PendingApply) {
    const next = applySuggestionPlan(settings as EndpointSettings, target.plan, {
      applyListPath: target.applyListPath,
      applyBindings: target.applyBindings,
      paginationDefaults: defaultPaginationSettings(meta),
    });
    onSettingsChange(next);
    onDismiss(target.dismissKeys);
    setPending(null);
  }

  function requestApply(target: PendingApply) {
    if (suggestionConflicts(settings as EndpointSettings, target.plan)) {
      setPending(target);
      return;
    }
    apply(target);
  }

  return (
    <section
      aria-labelledby="suggestions-title"
      className="rounded-xl border border-lime-300/25 bg-lime-300/[0.06] p-4"
    >
      <div className="flex items-start gap-3">
        <LightbulbIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-lime-300" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 id="suggestions-title" className="text-sm font-semibold text-lime-100">
              Inference suggestions
            </h2>
            <p className="text-xs text-lime-100/70">
              These pointers resolve in the current schema. Apply them to skip manual
              pagination setup.
            </p>
          </div>

          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-lime-300/15 bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{item.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      if (item.kind === "list") {
                        requestApply({
                          plan,
                          applyListPath: true,
                          applyBindings: false,
                          dismissKeys: [item.id],
                        });
                      } else if (item.binding) {
                        const binding = item.binding as PaginationBindingKey;
                        requestApply({
                          plan: {
                            ...plan,
                            bindings: { [binding]: plan.bindings[binding] },
                          },
                          applyListPath: false,
                          applyBindings: true,
                          dismissKeys: [item.id],
                        });
                      }
                    }}
                  >
                    Use
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() => onDismiss([item.id])}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-1.5">
            {visibleList && visibleBindings.length > 0 ? (
              <Button
                type="button"
                size="xs"
                onClick={() =>
                  requestApply({
                    plan,
                    applyListPath: true,
                    applyBindings: true,
                    dismissKeys: dismissedItemKeys,
                  })
                }
              >
                Use all suggestions
              </Button>
            ) : null}
            {visibleBindings.length > 0 ? (
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() =>
                  requestApply({
                    plan,
                    applyListPath: false,
                    applyBindings: true,
                    dismissKeys: visibleBindings.map((item) => item.id),
                  })
                }
              >
                Use pagination bindings
              </Button>
            ) : null}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => onDismiss(dismissedItemKeys)}
            >
              Dismiss all
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Replace your current pointer settings?"
        description="You already set a different list path or pagination binding. Applying this suggestion will overwrite it."
        confirmLabel="Replace values"
        onConfirm={() => {
          if (pending) apply(pending);
        }}
      />
    </section>
  );
}
