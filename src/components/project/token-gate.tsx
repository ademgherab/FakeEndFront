"use client";

import { useState } from "react";
import { ApiError, getProject } from "@/lib/api";
import { looksLikeEditToken, rememberToken } from "@/lib/credentials";
import type { Project } from "@/lib/types";

export interface TokenGateProps {
  slug: string;
  onUnlock: (project: Project, token: string) => void;
}

/** Distinct, actionable copy for every auth failure in the contract. */
function describeAuthError(error: ApiError): { title: string; detail: string } {
  switch (error.problem.code) {
    case "missing_token":
      return {
        title: "No token",
        detail: "The request needs an edit token. Paste the token to continue.",
      };
    case "invalid_token":
      return {
        title: "Token does not match",
        detail:
          "This token is not the edit token of this project. Check the token and try again.",
      };
    case "project_not_found":
      return {
        title: "Project not found",
        detail: "No project has this slug. It may never have existed or it may have been deleted.",
      };
    case "project_expired":
      return {
        title: "Project expired",
        detail: "This project has expired and can no longer be edited.",
      };
    default:
      return {
        title: error.problem.title ?? "Cannot unlock the project",
        detail:
          error.problem.detail ??
          `The API answered with status ${error.status}.`,
      };
  }
}

export function TokenGate({ slug, onUnlock }: TokenGateProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  async function unlock() {
    const trimmed = token.trim();
    if (!trimmed) {
      setError({ title: "Token required", detail: "Paste the edit token of the project." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const project = await getProject(slug, trimmed);
      // The token is kept in memory only. It is never written to storage.
      rememberToken(slug, trimmed);
      setToken("");
      onUnlock(project, trimmed);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(describeAuthError(caught));
      } else {
        setError({
          title: "Cannot reach API",
          detail: "The API did not answer. Is the backend running?",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-50">Unlock this project</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Project <code className="font-mono text-zinc-200">{slug}</code> is
          protected by an edit token. The token is returned once, when the
          project is created, and is kept in memory only.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="edit-token" className="block text-sm font-medium text-zinc-100">
          Edit token
        </label>
        <input
          id="edit-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void unlock();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "edit-token-error" : "edit-token-hint"}
          placeholder="et_…"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none"
        />
        <p id="edit-token-hint" className="text-xs text-zinc-400">
          {looksLikeEditToken(token)
            ? "Looks like a valid edit token."
            : "The token starts with `et_` and is 46 characters long."}
        </p>
        {error ? (
          <p
            id="edit-token-error"
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-400/[0.06] p-3 text-sm text-red-100"
          >
            <span className="font-semibold">{error.title}. </span>
            {error.detail}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          void unlock();
        }}
        disabled={loading}
        aria-busy={loading}
        className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Checking…" : "Unlock project"}
      </button>
    </section>
  );
}
