"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ProjectResponse } from "@/lib/api/generated/schema";
import { getProject } from "@/lib/api/projects";
import { AppError, isAppError } from "@/lib/errors";
import {
  getToken,
  isTokenPersisted,
  removeToken,
  saveToken,
  subscribeToTokenRemoval,
  touchRecentProject,
} from "@/lib/storage/token-store";
import type { ProjectGateStatus } from "@/hooks/use-project";
import { ProjectContext } from "@/hooks/use-project";
import { MetaProvider } from "@/components/providers/meta-provider";
import { ErrorAlert } from "@/components/common/error-alert";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ProjectNav } from "@/components/project/project-nav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError({
    status: 0,
    code: "unknown_error",
    title: "Could not open this project",
    detail: error instanceof Error ? error.message : undefined,
    cause: error,
  });
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

function GateSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <span className="sr-only">Opening project…</span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Shell>
  );
}

interface TokenGateProps {
  slug: string;
  error: AppError | null;
  onSubmit: (token: string, remember: boolean) => void;
  onClear: () => void;
  showClear: boolean;
}

function TokenGate({ slug, error, onSubmit, onClear, showClear }: TokenGateProps) {
  const [token, setTokenInput] = useState("");
  const [remember, setRemember] = useState(false);

  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <div className="grid size-11 place-items-center rounded-xl bg-lime-300/10 text-lime-300 ring-1 ring-inset ring-lime-300/20">
            <KeyRoundIcon aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            Enter the edit token
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This project is protected by the token shown once when it was
            created. It is never sent in the URL.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(token, remember);
            }}
          >
            <div>
              <Label htmlFor="project-slug">Project slug</Label>
              <Input
                id="project-slug"
                value={slug}
                readOnly
                className="mt-2 font-mono text-zinc-400"
                aria-describedby="project-slug-help"
              />
              <p id="project-slug-help" className="mt-1.5 text-xs text-zinc-500">
                Taken from the address bar and cannot be changed here.
              </p>
            </div>

            <div>
              <Label htmlFor="edit-token">Edit token</Label>
              <Input
                id="edit-token"
                type="password"
                value={token}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="et_…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="mt-2 font-mono"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby="edit-token-help"
              />
              <p id="edit-token-help" className="mt-1.5 text-xs text-zinc-500">
                Starts with <code className="font-mono">et_</code>. Only the
                token holder can open or edit this project.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="remember-token"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <div>
                <Label htmlFor="remember-token" className="text-zinc-300">
                  Remember on this device
                </Label>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Stored in this browser&apos;s localStorage. Leave it off to
                  keep the token in this tab only.
                </p>
              </div>
            </div>

            {error ? (
              <ErrorAlert
                error={error}
                title={
                  error.code === "invalid_token"
                    ? "That token does not match this project"
                    : undefined
                }
              />
            ) : null}

            <Button type="submit" size="lg" className="w-full sm:w-auto">
              <LockKeyholeIcon aria-hidden="true" />
              Unlock project
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-xs">
            <Link
              href="/help#tokens"
              className="text-lime-300 underline-offset-4 hover:underline"
            >
              Where do I find the token?
            </Link>
            {showClear ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onClear}
              >
                Clear saved token
              </Button>
            ) : null}
            <Link
              href="/projects"
              className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              Recent projects
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export interface ProjectGateProps {
  slug: string;
  children: ReactNode;
}

/**
 * PRJ-01: a client-only gate. Nothing about the project is rendered until the
 * token has been validated with GET /projects/{slug}. Server pages below this
 * layout never fetch or receive project data.
 */
export function ProjectGate({ slug, children }: ProjectGateProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [project, setProjectState] = useState<ProjectResponse | null>(null);
  const [status, setStatus] = useState<ProjectGateStatus>("checking");
  const [error, setError] = useState<AppError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const hasProjectRef = useRef(false);
  const requestCounter = useRef(0);

  const handleFailure = useCallback(
    (caught: unknown) => {
      const appError = toAppError(caught);
      if (appError.code === "aborted") return;

      setError(appError);
      setProjectState(null);
      hasProjectRef.current = false;

      switch (appError.code) {
        case "project_not_found":
          setStatus("not_found");
          break;
        case "project_expired":
          setStatus("expired");
          router.replace(`/expired?slug=${encodeURIComponent(slug)}`);
          break;
        case "missing_token":
        case "invalid_token":
          setStatus("invalid");
          break;
        case "network_error":
        case "timeout":
        case "internal_error":
        case "invalid_response":
          setStatus("error");
          break;
        default:
          setStatus("error");
      }
    },
    [router, slug],
  );

  const loadProject = useCallback(
    async (candidate: string, { initial = false }: { initial?: boolean } = {}) => {
      const requestId = ++requestCounter.current;
      if (initial || !hasProjectRef.current) {
        setStatus("loading");
      } else {
        setIsRefreshing(true);
      }

      try {
        const data = await getProject(slug, candidate);
        if (requestId !== requestCounter.current) return;

        tokenRef.current = candidate;
        setToken(candidate);
        setProjectState(data);
        hasProjectRef.current = true;
        setStatus("ready");
        setError(null);
        touchRecentProject(slug, {
          name: data.name ?? null,
          baseUrl: data.baseUrl,
          expiresAt: data.expiresAt,
        });
      } catch (caught) {
        if (requestId !== requestCounter.current) return;
        tokenRef.current = candidate;
        setToken(candidate);
        handleFailure(caught);
      } finally {
        if (requestId === requestCounter.current) setIsRefreshing(false);
      }
    },
    [handleFailure, slug],
  );

  // Read the token on the client only; the server never sees it.
  useEffect(() => {
    let cancelled = false;

    async function resolveStoredToken() {
      const stored = getToken(slug);
      if (cancelled) return;
      if (!stored) {
        setStatus("missing");
        return;
      }
      tokenRef.current = stored;
      setToken(stored);
      await loadProject(stored, { initial: true });
    }

    void resolveStoredToken();
    return () => {
      cancelled = true;
      requestCounter.current += 1;
    };
  }, [loadProject, slug]);

  // Refresh after a window focus, as the overview and logs expect.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!hasProjectRef.current || !tokenRef.current) return;
      void loadProject(tokenRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadProject]);

  // A forgotten token immediately hides project data.
  useEffect(() => {
    return subscribeToTokenRemoval((removedSlug) => {
      if (removedSlug !== slug) return;
      requestCounter.current += 1;
      tokenRef.current = null;
      hasProjectRef.current = false;
      setToken(null);
      setProjectState(null);
      setError(null);
      setStatus("missing");
    });
  }, [slug]);

  const submitToken = useCallback(
    async (raw: string, remember: boolean) => {
      const candidate = raw.trim();
      if (!candidate) {
        setError(
          new AppError({
            status: 0,
            code: "missing_token",
            title: "Enter the edit token",
            detail: "Paste the token shown when this project was created.",
          }),
        );
        setStatus("invalid");
        return { ok: false };
      }

      setStatus("loading");
      setError(null);
      const requestId = ++requestCounter.current;

      try {
        const data = await getProject(slug, candidate);
        if (requestId !== requestCounter.current) return { ok: false };

        saveToken(slug, candidate, {
          remember,
          name: data.name ?? null,
          baseUrl: data.baseUrl,
          expiresAt: data.expiresAt,
        });

        tokenRef.current = candidate;
        setToken(candidate);
        setProjectState(data);
        hasProjectRef.current = true;
        setStatus("ready");
        return { ok: true };
      } catch (caught) {
        if (requestId !== requestCounter.current) return { ok: false };
        handleFailure(caught);
        return { ok: false };
      }
    },
    [handleFailure, slug],
  );

  const clearToken = useCallback(() => {
    removeToken(slug);
    requestCounter.current += 1;
    tokenRef.current = null;
    hasProjectRef.current = false;
    setToken(null);
    setProjectState(null);
    setError(null);
    setStatus("missing");
  }, [slug]);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    await loadProject(tokenRef.current);
  }, [loadProject]);

  const setProject = useCallback((next: ProjectResponse) => {
    setProjectState(next);
    hasProjectRef.current = true;
  }, []);

  if (status === "checking" || status === "loading") {
    return <GateSkeleton />;
  }

  if (status === "missing" || status === "invalid") {
    return (
      <TokenGate
        slug={slug}
        error={error}
        showClear={Boolean(token) && isTokenPersisted(slug)}
        onSubmit={(nextToken, remember) => {
          void submitToken(nextToken, remember);
        }}
        onClear={clearToken}
      />
    );
  }

  if (status === "not_found") {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <EmptyState
            icon={<TriangleAlertIcon aria-hidden="true" />}
            title="Project not found"
            description="This project does not exist or has been deleted. Tokens cannot recover a deleted project."
            action={
              <>
                <Button asChild>
                  <Link href="/new">
                    Create a new project
                    <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/projects">Recent projects</Link>
                </Button>
              </>
            }
          />
        </div>
      </Shell>
    );
  }

  if (status === "expired") {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <EmptyState
            icon={<TriangleAlertIcon aria-hidden="true" />}
            title="This project has expired"
            description="Expired projects are read-only for a short grace period, then permanently deleted. Create a new project to keep testing."
            action={
              <Button asChild>
                <Link href="/new">
                  Create a new project
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </div>
      </Shell>
    );
  }

  if (status === "error" || !project) {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl space-y-4">
          <PageHeader
            eyebrow="Project"
            title="Could not open this project"
            description="The project was not loaded. Your stored token was kept."
          />
          <ErrorAlert
            error={
              error ??
              new AppError({
                status: 0,
                code: "unknown_error",
                title: "Could not open this project",
              })
            }
            onRetry={() => {
              void refresh();
            }}
          />
          <Button type="button" variant="outline" onClick={clearToken}>
            Forget token and re-enter
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <ProjectContext.Provider
      value={{
        slug,
        token,
        project,
        status,
        error,
        isLoading: false,
        isRefreshing,
        refresh,
        submitToken,
        clearToken,
        setProject,
      }}
    >
      <MetaProvider>
        <SiteHeader />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10"
        >
          <ProjectNav />
          {children}
        </main>
        <SiteFooter />
      </MetaProvider>
    </ProjectContext.Provider>
  );
}
