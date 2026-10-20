"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import type { RecentProject } from "@/lib/storage/token-store";
import {
  getProject,
} from "@/lib/api/projects";
import { AppError, isAppError } from "@/lib/errors";
import {
  hasToken,
  isTokenShaped,
  listRecentProjects,
  removeRecentProject,
  removeToken,
  saveToken,
} from "@/lib/storage/token-store";
import { evaluateExpiry } from "@/lib/project/expiry";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function subscribeToStorage(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function serverMountedSnapshot(): boolean {
  return false;
}

function clientMountedSnapshot(): boolean {
  return true;
}

function RecentRow({
  entry,
  now,
  onUseToken,
  onRemoved,
}: {
  entry: RecentProject;
  now: number | null;
  onUseToken: (slug: string) => void;
  onRemoved: () => void;
}) {
  const saved = hasToken(entry.slug);
  const expiry =
    now === null || !entry.expiresAt
      ? null
      : evaluateExpiry(entry.expiresAt, now);
  const expired = expiry?.isExpired ?? false;

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {entry.name?.trim() || "Untitled project"}
            </p>
            {expired ? (
              <Badge variant="outline" className="border-red-400/40 text-red-200">
                Expired
              </Badge>
            ) : saved ? (
              <Badge variant="outline" className="border-lime-300/30 text-lime-200">
                <KeyRoundIcon aria-hidden="true" />
                Token saved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-zinc-400">
                <LockKeyholeIcon aria-hidden="true" />
                Locked
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-zinc-400">{entry.slug}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {entry.expiresAt
              ? `Expires ${formatDateTime(entry.expiresAt)}`
              : "Expiry not recorded"}
            {now !== null && entry.expiresAt && expiry && !expired
              ? ` · ${expiry.label} left`
              : ""}
            {now !== null
              ? ` · last opened ${formatRelativeTime(entry.updatedAt, now)}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!expired && saved ? (
            <Button asChild size="sm">
              <Link href={`/p/${entry.slug}`}>
                Open
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          ) : !expired ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onUseToken(entry.slug)}
            >
              <KeyRoundIcon aria-hidden="true" />
              Restore access
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={`/expired?slug=${encodeURIComponent(entry.slug)}`}>
                Expired details
              </Link>
            </Button>
          )}

          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" size="sm">
                <Trash2Icon aria-hidden="true" />
                Remove
              </Button>
            }
            title="Remove this project from this device?"
            description="The remembered token and recent-project entry are deleted from this browser. The project itself keeps running on the server and is not deleted."
            confirmLabel="Remove from device"
            destructive
            onConfirm={() => {
              removeToken(entry.slug);
              removeRecentProject(entry.slug);
              onRemoved();
              toast.success("Project removed from this device");
            }}
          />
        </div>
      </div>
    </li>
  );
}

export function RecentProjects() {
  const router = useRouter();
  const now = useNow();
  const mounted = useSyncExternalStore(
    subscribeToStorage,
    clientMountedSnapshot,
    serverMountedSnapshot,
  );
  const [version, setVersion] = useState(0);
  const [slug, setSlug] = useState("");
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const tokenInput = useRef<HTMLInputElement>(null);

  const entries = useMemo(
    () => (mounted ? listRecentProjects() : []),
    // `version` is a manual invalidation counter for local-storage mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );

  const choose = useCallback((nextSlug: string) => {
    setSlug(nextSlug);
    setError(null);
    window.requestAnimationFrame(() => {
      tokenInput.current?.focus();
      tokenInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  async function restore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slug.trim();
    const normalizedToken = token.trim();

    if (!normalizedSlug) {
      setError(
        new AppError({
          status: 0,
          code: "validation_failed",
          title: "Enter the project slug",
        }),
      );
      return;
    }
    if (!isTokenShaped(normalizedToken)) {
      setError(
        new AppError({
          status: 0,
          code: "invalid_token",
          title: "That token does not look complete",
          detail:
            "Edit tokens start with et_ and contain the full value shown at creation.",
        }),
      );
      return;
    }

    setRestoring(true);
    setError(null);
    try {
      const project = await getProject(normalizedSlug, normalizedToken);
      saveToken(normalizedSlug, normalizedToken, {
        remember,
        name: project.name ?? null,
        baseUrl: project.baseUrl,
        expiresAt: project.expiresAt,
      });
      if (remember) setVersion((current) => current + 1);
      toast.success("Access restored");
      router.push(`/p/${encodeURIComponent(normalizedSlug)}`);
    } catch (caught) {
      setError(
        isAppError(caught)
          ? caught
          : new AppError({
              status: 0,
              code: "unknown_error",
              title: "Could not restore access",
              cause: caught,
            }),
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Recent projects"
        title="Projects on this device"
        description="Everything here comes from this browser's local storage. The service has no account system and cannot recover an edit token."
        actions={
          <Button asChild>
            <Link href="/new">
              New project
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {!mounted ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading projects">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<KeyRoundIcon aria-hidden="true" />}
          title="No recent projects on this device"
          description="Projects appear here after you open them. You can also restore one with its slug and edit token below."
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <RecentRow
              key={entry.slug}
              entry={entry}
              now={now}
              onUseToken={choose}
              onRemoved={() => setVersion((current) => current + 1)}
            />
          ))}
        </ul>
      )}

      <section
        id="restore-access"
        aria-labelledby="restore-heading"
        className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-lime-300/10 text-lime-300 ring-1 ring-inset ring-lime-300/20">
            <KeyRoundIcon aria-hidden="true" />
          </div>
          <div>
            <h2
              id="restore-heading"
              className="text-base font-semibold text-zinc-100"
            >
              Restore access with a slug and token
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              The pair is checked against the API before anything is stored.
              Tokens are shown only once at creation and cannot be recovered by
              the service.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={(event) => void restore(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restore-slug">Project slug</Label>
              <Input
                id="restore-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="k3j9x2m8qa"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restore-token">Edit token</Label>
              <Input
                ref={tokenInput}
                id="restore-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="et_…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono"
                aria-invalid={Boolean(error) || undefined}
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="restore-remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-lime-300"
            />
            <label htmlFor="restore-remember" className="text-xs leading-5 text-zinc-400">
              Remember the token on this device. Leave this off to keep it in
              this tab only.
            </label>
          </div>

          {error ? <ErrorAlert error={error} /> : null}

          <Button type="submit" disabled={restoring}>
            {restoring ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : (
              <KeyRoundIcon aria-hidden="true" />
            )}
            {restoring ? "Checking…" : "Restore access"}
          </Button>
        </form>

        <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-zinc-500">
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          Removing an entry never deletes the server project. It only forgets
          the token on this device.
        </p>
      </section>
    </div>
  );
}
