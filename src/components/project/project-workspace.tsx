"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Endpoint, MetaResponse, Project } from "@/lib/types";
import {
  ApiError,
  deleteProject,
  getMeta,
  getProject,
  renameProject,
} from "@/lib/api";
import { forgetToken, rememberToken } from "@/lib/credentials";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { useEditToken } from "@/hooks/use-edit-token";
import { CopyButton } from "@/components/builder/copy-button";
import { ErrorBanner } from "@/components/builder/error-banner";
import { TestPanel } from "@/components/builder/test-panel";
import { LogsViewer } from "@/components/logs/logs-viewer";
import { TokenGate } from "@/components/project/token-gate";
import { EndpointEditor } from "@/components/project/endpoint-editor";
import { AddEndpointForm } from "@/components/project/add-endpoint-form";

export interface ProjectWorkspaceProps {
  slug: string;
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ProjectWorkspace({ slug }: ProjectWorkspaceProps) {
  // The token is read from the in-memory store: a reload lands on the gate.
  const token = useEditToken(slug);
  const [project, setProject] = useState<Project | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError["problem"] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const health = useBackendHealth();

  // The token is read from the in-memory store: a reload lands on the gate.
  useEffect(() => {
    let active = true;
    void getMeta().then((payload) => {
      if (active && payload) setMeta(payload);
    });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(
    async (editToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getProject(slug, editToken);
        setProject(result);
        setSelectedId((current) =>
          current && result.endpoints.some((entry) => entry.id === current)
            ? current
            : (result.endpoints[0]?.id ?? null),
        );
      } catch (caught) {
        if (caught instanceof ApiError) {
          setError(caught.problem);
          if (caught.status === 401 || caught.status === 403) {
            forgetToken(slug);
          }
        } else {
          setError({ title: "Could not load the project." });
        }
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void load(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token, load]);

  const selected = useMemo<Endpoint | null>(
    () =>
      project?.endpoints.find((entry) => entry.id === selectedId) ??
      project?.endpoints[0] ??
      null,
    [project, selectedId],
  );

  function handleUnlock(unlocked: Project, unlockedToken: string) {
    setProject(unlocked);
    rememberToken(slug, unlockedToken);
    setSelectedId(unlocked.endpoints[0]?.id ?? null);
    setError(null);
  }

  async function saveName() {
    if (!project || !token) return;
    const trimmed = nameDraft.trim();
    setBusy(true);
    setError(null);
    try {
      const updated = await renameProject(
        project.slug,
        token,
        trimmed === "" ? null : trimmed,
      );
      setProject(updated);
      setRenaming(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem
          : { title: "The name could not be changed." },
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeProject() {
    if (!project || !token) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProject(project.slug, token);
      forgetToken(project.slug);
      setProject(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem
          : { title: "The project could not be deleted." },
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Project workspace
          </h1>
          <Link
            href="/"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            Back to the builder
          </Link>
        </header>
        <TokenGate slug={slug} onUnlock={handleUnlock} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Project workspace
          </h1>
          <Link
            href="/"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            Back to the builder
          </Link>
        </header>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading the project…</p>
        ) : null}
        {error ? <ErrorBanner error={error} errors={error.errors} /> : null}
        {!loading && !error ? (
          <p className="text-sm text-zinc-400">The project is not available.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {project.name ?? "Untitled project"}
          </h1>
          <p className="text-xs text-zinc-400">
            Slug <code className="font-mono text-zinc-200">{project.slug}</code>
            {" · "}
            Expires {formatExpiry(project.expiresAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            Builder
          </Link>
          <button
            type="button"
            onClick={() => {
              void load(token);
            }}
            disabled={loading}
            aria-busy={loading}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Delete this project? This cannot be undone.")) {
                return;
              }
              void removeProject();
            }}
            disabled={busy}
            className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-400/10 disabled:opacity-50"
          >
            Delete project
          </button>
        </div>
      </header>

      {health.state === "offline" ? (
        <p
          role="status"
          className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-100"
        >
          The API is not answering. Project actions will fail until it is
          running.
        </p>
      ) : null}

      {error ? <ErrorBanner error={error} errors={error.errors} /> : null}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Base URL
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100">
              {project.baseUrl}
            </code>
            <CopyButton value={project.baseUrl} label="Copy base URL" />
          </div>
        </div>

        {project.usage ? (
          <p className="text-xs text-zinc-400">
            Requests today:{" "}
            <span className="font-mono text-zinc-200">
              {project.usage.requestsToday}
            </span>{" "}
            / {project.usage.dailyLimit}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {renaming ? (
            <>
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                aria-label="Project name"
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-zinc-100 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  void saveName();
                }}
                disabled={busy}
                className="rounded-lg bg-lime-300 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-200 disabled:opacity-50"
              >
                Save name
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(project.name ?? "");
                setRenaming(true);
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Rename project
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">
            Endpoints ({project.endpoints.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowAdd((value) => !value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
          >
            {showAdd ? "Close" : "Add endpoint"}
          </button>
        </div>

        {project.endpoints.length === 0 ? (
          <p className="text-sm text-zinc-400">
            This project has no endpoints yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {project.endpoints.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  aria-pressed={selected?.id === entry.id}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                    selected?.id === entry.id
                      ? "border-lime-300/60 bg-lime-300/10 text-lime-200"
                      : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  {entry.method} {entry.path}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAdd ? (
          <AddEndpointForm
            projectSlug={project.slug}
            token={token}
            onCreated={(endpoint) => {
              setProject((current) =>
                current
                  ? {
                      ...current,
                      endpoints: [...current.endpoints, endpoint],
                    }
                  : current,
              );
              setSelectedId(endpoint.id);
              setShowAdd(false);
            }}
          />
        ) : null}
      </section>

      {selected ? (
        <EndpointEditor
          key={selected.id}
          projectSlug={project.slug}
          token={token}
          endpoint={selected}
          meta={meta}
          onUpdated={(updated) => {
            setProject((current) =>
              current
                ? {
                    ...current,
                    endpoints: current.endpoints.map((entry) =>
                      entry.id === updated.id ? updated : entry,
                    ),
                  }
                : current,
            );
          }}
          onDeleted={(endpointId) => {
            setProject((current) => {
              if (!current) return current;
              const endpoints = current.endpoints.filter(
                (entry) => entry.id !== endpointId,
              );
              if (selectedId === endpointId) {
                setSelectedId(endpoints[0]?.id ?? null);
              }
              return { ...current, endpoints };
            });
          }}
        />
      ) : null}

      <TestPanel project={project} endpoint={selected} />

      <LogsViewer project={project} token={token} />
    </div>
  );
}
