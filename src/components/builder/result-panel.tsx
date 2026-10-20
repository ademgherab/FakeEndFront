"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";
import { CopyButton } from "@/components/builder/copy-button";

export interface ResultPanelProps {
  project: Project;
}

export function ResultPanel({ project }: ResultPanelProps) {
  const endpoint = project.endpoints[0];

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Result</h2>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Base URL</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100">
            {project.baseUrl}
          </code>
          <CopyButton value={project.baseUrl} label="Copy base URL" />
        </div>
      </div>

      {endpoint ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Endpoint URL
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100">
              {endpoint.url}
            </code>
            <CopyButton value={endpoint.url} label="Copy endpoint URL" />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/p/${project.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
        >
          Open project workspace
        </Link>
        <span className="text-xs text-zinc-400">
          Slug: <code className="font-mono">{project.slug}</code>
        </span>
      </div>

      {project.editToken ? (
        <p className="text-xs text-zinc-400">
          An edit token was returned. It is kept in memory only and is lost on
          reload.
        </p>
      ) : null}

      <p className="text-xs text-zinc-400">Expires {project.expiresAt}</p>
    </section>
  );
}
