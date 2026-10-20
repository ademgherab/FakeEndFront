"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SaveIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type {
  MetaResponse,
  ProjectEndpoint,
} from "@/lib/api/generated/schema";
import {
  getEndpoint,
  updateEndpoint,
  updateEndpointSchema,
  updateEndpointSettings,
} from "@/lib/api/endpoints";
import { AppError, fieldErrors, isAppError } from "@/lib/errors";
import { joinUrl } from "@/lib/config";
import {
  chooseSaveOperation,
  isDirty,
  valuesEqual,
} from "@/lib/endpoint/save";
import {
  cloneSnapshot,
  createEndpointSnapshot,
  validateEndpointDraft,
  type EndpointSnapshot,
} from "@/lib/endpoint/draft";
import { evaluateExpiry } from "@/lib/project/expiry";
import { useNow } from "@/hooks/use-now";
import { useProject } from "@/hooks/use-project";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { CopyButton } from "@/components/common/copy-button";
import { ErrorAlert } from "@/components/common/error-alert";
import { ExpiryCountdown } from "@/components/common/expiry-countdown";
import { MethodBadge } from "@/components/common/method-badge";
import { EndpointSchemaTab } from "@/components/endpoint/endpoint-schema-tab";
import { EndpointSettingsTab } from "@/components/endpoint/endpoint-settings-tab";
import { TryItConsole } from "@/components/endpoint/try-it-console";
import { LogsView } from "@/components/logs/logs-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const TABS = ["schema", "settings", "try-it", "logs"] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

function toAppError(caught: unknown): AppError {
  return isAppError(caught)
    ? caught
    : new AppError({
        status: 0,
        code: "unknown_error",
        title: "The endpoint was not saved",
        cause: caught,
      });
}

function serverProblemsFor(
  error: AppError | null,
  matcher?: RegExp,
): string[] {
  if (!error) return [];
  const errors = fieldErrors(error);
  const entries = Object.entries(errors);
  const filtered = matcher
    ? entries.filter(([field]) => matcher.test(field))
    : entries;
  return filtered.flatMap(([field, messages]) =>
    messages.map((message) => `${field}: ${message}`),
  );
}

export interface EndpointWorkspaceProps {
  endpoint: ProjectEndpoint;
  meta: MetaResponse;
}

export function EndpointWorkspace({ endpoint, meta }: EndpointWorkspaceProps) {
  const { slug, token, project, refresh } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = useNow();

  const [state, setState] = useState<{
    baseline: EndpointSnapshot;
    draft: EndpointSnapshot;
  }>(() => {
    const initial = createEndpointSnapshot(endpoint, meta);
    return { baseline: initial, draft: cloneSnapshot(initial) };
  });
  const [savedEndpoint, setSavedEndpoint] = useState(endpoint);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<AppError | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const requestedTab = searchParams.get("tab");
  const activeTab: Tab = isTab(requestedTab) ? requestedTab : "schema";
  const [openedTabs, setOpenedTabs] = useState<ReadonlySet<Tab>>(
    () => new Set([activeTab]),
  );

  const { baseline, draft } = state;
  const dirtyState = {
    metaDirty:
      draft.method !== baseline.method || draft.path !== baseline.path,
    schemaDirty: !valuesEqual(draft.schema, baseline.schema),
    settingsDirty: !valuesEqual(draft.settings, baseline.settings),
  };
  const dirty = isDirty(dirtyState);
  const operation = chooseSaveOperation(dirtyState);
  const draftProblems = useMemo(
    () => validateEndpointDraft(draft, meta),
    [draft, meta],
  );
  const problemsByField = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of draftProblems) {
      const current = map.get(problem.field) ?? [];
      current.push(problem.message);
      map.set(problem.field, current);
    }
    return map;
  }, [draftProblems]);

  const expiry =
    now === null || !project
      ? null
      : evaluateExpiry(project.expiresAt, now);
  const readOnly = expiry?.isExpired ?? false;
  const canSave =
    dirty && !saving && !readOnly && draftProblems.length === 0 && Boolean(token);

  useUnsavedChanges(dirty && !saving);

  const baseUrl = project?.baseUrl ?? "";
  const endpointUrl = joinUrl(baseUrl, draft.path);
  const allServerProblems = serverProblemsFor(saveError);
  const schemaServerProblems = serverProblemsFor(
    saveError,
    /schema|root|fields|items|pointer|\//i,
  );
  const pathServerProblems = serverProblemsFor(saveError, /^(path|method)\b/i);

  function updateDraft(patch: Partial<EndpointSnapshot>) {
    setState((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  }

  function revert() {
    setState((current) => ({
      baseline: current.baseline,
      draft: cloneSnapshot(current.baseline),
    }));
    setSaveError(null);
    setSaveNotice("Reverted to the last saved version.");
  }

  function changeTab(next: Tab) {
    if (next === activeTab) return;
    setOpenedTabs((current) => {
      const opened = new Set(current);
      opened.add(activeTab);
      opened.add(next);
      return opened;
    });
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  }

  async function save() {
    if (!canSave || !token || operation === "none") return;

    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      let written: ProjectEndpoint | null = null;
      if (operation === "schema") {
        written = await updateEndpointSchema(
          slug,
          savedEndpoint.id,
          token,
          draft.schema,
          { baseUrl },
        );
      } else if (operation === "settings") {
        written = await updateEndpointSettings(
          slug,
          savedEndpoint.id,
          token,
          draft.settings,
          { baseUrl },
        );
      } else {
        written = await updateEndpoint(
          slug,
          savedEndpoint.id,
          token,
          {
            method: draft.method,
            path: draft.path,
            schema: draft.schema,
            settings: draft.settings,
            ...(savedEndpoint.options
              ? { options: savedEndpoint.options }
              : {}),
          },
          { baseUrl },
        );
      }

      // Always read the complete endpoint back. A 204 or a schema-only
      // response must not become the source for the other half of the editor.
      let fresh: ProjectEndpoint | null = written;
      try {
        fresh = await getEndpoint(slug, savedEndpoint.id, token, { baseUrl });
      } catch {
        // The write succeeded; use what we have and keep the draft values.
      }

      const nextSnapshot = createEndpointSnapshot(
        fresh ?? {
          ...savedEndpoint,
          method: draft.method,
          path: draft.path,
          schema: draft.schema,
          settings: draft.settings,
        },
        meta,
      );

      if (fresh) setSavedEndpoint(fresh);
      setState({
        baseline: nextSnapshot,
        draft: cloneSnapshot(nextSnapshot),
      });
      setSaveNotice("Saved. The endpoint now serves this version.");
      toast.success("Endpoint saved");

      // Keep the overview, usage and URL in sync without blocking the editor.
      void refresh();
    } catch (caught) {
      setSaveError(toAppError(caught));
      setSaveNotice(null);
    } finally {
      setSaving(false);
    }
  }

  const saveDisabledReason = readOnly
    ? "This project has expired and is read-only."
    : !token
      ? "The edit token is missing."
      : saving
        ? "Saving…"
        : draftProblems.length > 0
          ? "Fix the highlighted problems before saving."
          : !dirty
            ? "Nothing has changed."
            : null;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="xs" className="-ml-2">
                <Link href={`/p/${slug}`}>
                  <ArrowLeftIcon aria-hidden="true" />
                  Overview
                </Link>
              </Button>
              {project ? <ExpiryCountdown expiresAt={project.expiresAt} /> : null}
              {readOnly ? (
                <Badge variant="outline" className="border-red-400/40 text-red-200">
                  Read-only
                </Badge>
              ) : (
                <Badge variant="outline" className="border-lime-300/30 text-lime-200">
                  Live
                </Badge>
              )}
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <MethodBadge method={draft.method} />
              <code className="min-w-0 break-all font-mono text-lg font-medium text-zinc-100">
                {draft.path || "/"}
              </code>
            </div>

            <div className="mt-3 flex items-center gap-1.5 overflow-hidden rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">
                {endpointUrl}
              </code>
              <CopyButton
                value={endpointUrl}
                label="Copy endpoint URL"
                toastMessage="Endpoint URL copied."
                variant="ghost"
                size="xs"
                className="shrink-0"
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                dirty
                  ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
                  : "border-white/10 text-zinc-400"
              }
            >
              {dirty ? "Unsaved changes" : "All changes saved"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={revert}
              disabled={!dirty || saving}
            >
              <RotateCcwIcon aria-hidden="true" />
              Revert
            </Button>
            <Button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={!canSave}
              title={saveDisabledReason ?? undefined}
            >
              {saving ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : (
                <SaveIcon aria-hidden="true" />
              )}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {dirty ? (
          <p className="mt-3 text-xs text-zinc-500">
            Saving uses{" "}
            {operation === "schema"
              ? "the schema-only endpoint"
              : operation === "settings"
                ? "the settings-only endpoint"
                : "a full endpoint replace"}
            . Try it uses the last saved route until you save.
          </p>
        ) : null}
      </header>

      {readOnly ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-100"
        >
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">This project has expired.</p>
            <p className="mt-1 text-red-100/80">
              You can inspect the endpoint, but saves are disabled.
            </p>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <ErrorAlert
          error={saveError}
          title={
            saveError.code === "response_too_large"
              ? "The settings produce too much data"
              : saveError.code === "duplicate_endpoint"
                ? "That method and path already exist"
                : undefined
          }
        />
      ) : null}

      {allServerProblems.length > 0 ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-400/[0.05] p-4 text-sm"
          role="alert"
        >
          <p className="flex items-center gap-2 font-semibold text-red-100">
            <CircleAlertIcon aria-hidden="true" className="size-4" />
            Server validation details
          </p>
          <ul className="mt-2 space-y-1 text-xs text-red-100/80">
            {allServerProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveNotice ? (
        <p
          role="status"
          className="rounded-lg border border-lime-300/25 bg-lime-300/[0.05] px-3 py-2 text-xs text-lime-200"
        >
          {saveNotice}
        </p>
      ) : null}

      {draftProblems.length > 0 ? (
        <div
          className="rounded-xl border border-amber-300/30 bg-amber-300/[0.05] p-4 text-sm"
          role="alert"
        >
          <p className="font-semibold text-amber-100">
            Fix these before saving
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
            {draftProblems.map((problem) => (
              <li key={`${problem.field}:${problem.message}`}>
                {problem.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isTab(value)) changeTab(value);
        }}
      >
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="schema">
            Schema
            {dirtyState.schemaDirty ? (
              <span
                aria-label="(unsaved)"
                className="size-1.5 rounded-full bg-amber-300"
              />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings
            {dirtyState.settingsDirty || dirtyState.metaDirty ? (
              <span
                aria-label="(unsaved)"
                className="size-1.5 rounded-full bg-amber-300"
              />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="try-it">Try it</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <div className="mt-4 min-w-0">
          {activeTab === "schema" || openedTabs.has("schema") ? (
            <TabsContent
              value="schema"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <EndpointSchemaTab
                schema={draft.schema}
                meta={meta}
                onChange={(schema) => updateDraft({ schema })}
                serverProblems={schemaServerProblems}
              />
            </TabsContent>
          ) : null}

          {activeTab === "settings" || openedTabs.has("settings") ? (
            <TabsContent
              value="settings"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <EndpointSettingsTab
                method={draft.method}
                path={draft.path}
                schema={draft.schema}
                settings={draft.settings}
                meta={meta}
                pathServerErrors={[
                  ...(problemsByField.get("path") ?? []),
                  ...pathServerProblems,
                ]}
                onMethodChange={(method) => updateDraft({ method })}
                onPathChange={(path) => updateDraft({ path })}
                onSettingsChange={(settings) => updateDraft({ settings })}
              />
            </TabsContent>
          ) : null}

          {activeTab === "try-it" || openedTabs.has("try-it") ? (
            <TabsContent
              value="try-it"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              {savedEndpoint ? (
                <TryItConsole
                  key={`${savedEndpoint.method}:${savedEndpoint.path}`}
                  endpoint={savedEndpoint}
                  baseUrl={baseUrl}
                  disabled={readOnly}
                  disabledReason={
                    readOnly
                      ? "This project has expired and no longer answers."
                      : undefined
                  }
                />
              ) : null}
            </TabsContent>
          ) : null}

          {activeTab === "logs" || openedTabs.has("logs") ? (
            <TabsContent
              value="logs"
              forceMount
              className="data-[state=inactive]:hidden"
            >
              <LogsView
                endpointId={savedEndpoint.id}
                endpointPath={savedEndpoint.path}
                heading="Calls to this endpoint"
                pollingEnabled={activeTab === "logs"}
              />
            </TabsContent>
          ) : null}
        </div>
      </Tabs>

      {savedEndpoint.schema && savedEndpoint.settings ? null : (
        <p className="text-xs text-zinc-500">
          This endpoint did not include a schema or settings in the project
          response. The editor starts with safe defaults.
        </p>
      )}
    </div>
  );
}
