"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { CreateProjectResponse } from "@/lib/api/generated/schema";
import { useWizardStore } from "@/stores/wizard";
import { saveToken } from "@/lib/storage/token-store";
import {
  hasSuccessBeenShown,
  markSuccessShown,
} from "@/lib/storage/success-session";
import { formatDateTime, formatUtcDateTime, maskToken } from "@/lib/format";
import {
  buildCredentialsJson,
  buildCredentialsText,
  credentialsFileBase,
} from "@/lib/credentials";
import { downloadTextFile } from "@/lib/download";
import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function CodeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative">
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0b0e] p-3 pr-24 font-mono text-xs leading-6 text-zinc-300"
      >
        <code>{value}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton
          value={value}
          label={`Copy ${label}`}
          toastMessage={`${label} copied.`}
          variant="ghost"
          size="xs"
        />
      </div>
    </div>
  );
}

function MissingResult() {
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-6">
      <div className="flex items-start gap-3">
        <ShieldAlertIcon
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-amber-200"
        />
        <div>
          <h2 className="text-lg font-semibold text-amber-50">
            This token cannot be shown again
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            For security, the edit token is displayed once, immediately after a
            project is created. Reloading this page or navigating back does not
            restore it.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            If you saved the token, open the project and enter it. If you did
            not, you can create a new project.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/new">Create another project</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Recent projects</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SuccessPanel({ result }: { result: CreateProjectResponse }) {
  const router = useRouter();
  const setCreateResult = useWizardStore((state) => state.setCreateResult);
  const resetDraft = useWizardStore((state) => state.resetDraft);

  const [isFirstView] = useState(() => !hasSuccessBeenShown(result.slug));
  const [revealed, setRevealed] = useState(isFirstView);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    markSuccessShown(result.slug);
  }, [result.slug]);

  useEffect(() => {
    if (savedConfirmed) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [savedConfirmed]);

  // Client-side links bypass beforeunload, so warn on anchor navigation too.
  useEffect(() => {
    if (savedConfirmed) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.getAttribute("target") === "_blank") {
        return;
      }
      const confirmed = window.confirm(
        "This edit token cannot be recovered. Confirm you saved it before leaving this page.",
      );
      if (!confirmed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [savedConfirmed]);

  const firstEndpoint = result.endpoints[0];
  const runtimeUrl = firstEndpoint?.url ?? result.baseUrl;

  function persistToken(rememberOnDevice: boolean) {
    saveToken(result.slug, result.editToken, {
      remember: rememberOnDevice,
      name: result.name,
      baseUrl: result.baseUrl,
      expiresAt: result.expiresAt,
    });
  }

  function handleRemember(next: boolean) {
    setRemember(next);
    persistToken(next);
    if (next) {
      toast.success("Token saved on this device.");
    } else {
      toast.info("The token will be forgotten when this tab closes.");
    }
  }

  function handleOpenProject() {
    if (!savedConfirmed) return;
    persistToken(remember);
    setCreateResult(null);
    router.push(`/p/${result.slug}`);
  }

  function handleCreateAnother() {
    if (!savedConfirmed) return;
    persistToken(remember);
    setCreateResult(null);
    resetDraft();
    router.push("/new");
  }

  function handleDownload(format: "txt" | "json") {
    const base = credentialsFileBase(result);
    if (format === "txt") {
      downloadTextFile(`${base}.txt`, buildCredentialsText(result));
    } else {
      downloadTextFile(
        `${base}.json`,
        buildCredentialsJson(result),
        "application/json;charset=utf-8",
      );
    }
    toast.success(`Downloaded ${base}.${format}`);
  }

  const tokenValue = isFirstView && revealed ? result.editToken : maskToken(result.editToken);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-300/10 text-lime-300">
          <CheckCircle2Icon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
            Project created
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Your mock API is live
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Save the edit token now. It is shown once and cannot be recovered.
          </p>
        </div>
      </div>

      <section
        aria-labelledby="project-details-heading"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <h3 id="project-details-heading" className="text-base font-semibold text-zinc-100">
          Project
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs text-zinc-500">Name</dt>
            <dd className="text-zinc-200">{result.name || "Untitled project"}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs text-zinc-500">Slug</dt>
            <dd>
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
                {result.slug}
              </code>
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs text-zinc-500">Base URL</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <code className="truncate font-mono text-xs text-zinc-200">
                {result.baseUrl}
              </code>
              <CopyButton
                value={result.baseUrl}
                label="Copy base URL"
                toastMessage="Base URL copied."
                variant="ghost"
                size="xs"
              />
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs text-zinc-500">Expires</dt>
            <dd className="text-right text-xs text-zinc-300">
              {formatDateTime(result.expiresAt)}
              <span className="block text-zinc-500">
                {formatUtcDateTime(result.expiresAt)}
              </span>
            </dd>
          </div>
        </dl>

        <h4 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Endpoints
        </h4>
        <ul className="mt-2 space-y-2">
          {result.endpoints.map((endpoint) => (
            <li
              key={endpoint.id}
              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {endpoint.method}
                </Badge>
                <code className="truncate font-mono text-xs text-zinc-200">
                  {endpoint.url}
                </code>
              </div>
              <CopyButton
                value={endpoint.url}
                label={`Copy ${endpoint.method} ${endpoint.path} URL`}
                toastMessage="Endpoint URL copied."
                variant="ghost"
                size="xs"
              />
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="token-heading"
        className="rounded-xl border border-amber-300/30 bg-amber-300/[0.05] p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <ShieldAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-amber-200"
          />
          <div className="min-w-0 flex-1">
            <h3 id="token-heading" className="text-base font-semibold text-amber-50">
              Edit token
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-100/80">
              This token is shown once. It cannot be recovered if you lose it.
              Store it in a password manager or download the credentials file.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code
                data-testid="token-value"
                className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-300/20 bg-black/30 px-3 py-2 font-mono text-sm text-amber-50"
              >
                {tokenValue}
              </code>
              <div className="flex flex-wrap items-center gap-2">
                {isFirstView ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed((value) => !value)}
                    aria-label={revealed ? "Hide token" : "Reveal token"}
                  >
                    {revealed ? (
                      <EyeOffIcon aria-hidden="true" />
                    ) : (
                      <EyeIcon aria-hidden="true" />
                    )}
                    {revealed ? "Hide" : "Reveal"}
                  </Button>
                ) : null}
                <CopyButton
                  value={result.editToken}
                  label="Copy edit token"
                  toastMessage="Edit token copied. Store it somewhere safe."
                  variant="outline"
                  size="sm"
                  disabled={!isFirstView}
                />
              </div>
            </div>

            {!isFirstView ? (
              <p className="mt-2 text-xs text-amber-100/70">
                This token was already shown in this tab. Use the copy you saved
                earlier; it cannot be displayed again.
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownload("txt")}
                disabled={!isFirstView}
              >
                <DownloadIcon aria-hidden="true" />
                Download .txt
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownload("json")}
                disabled={!isFirstView}
              >
                <DownloadIcon aria-hidden="true" />
                Download .json
              </Button>
            </div>

            <div className="mt-4 flex items-start gap-2">
              <Checkbox
                id="remember-token"
                checked={remember}
                onCheckedChange={(value) => handleRemember(value === true)}
              />
              <div>
                <Label htmlFor="remember-token">Remember this token on this device</Label>
                <p className="mt-1 text-xs leading-5 text-amber-100/70">
                  {remember
                    ? "It is stored in this browser's local storage. Anyone using this browser profile can open the project."
                    : "Without this, the token is kept in memory for this tab only and is lost on reload."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="snippets-heading"
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      >
        <h3 id="snippets-heading" className="text-base font-semibold text-zinc-100">
          Try it now
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          The runtime needs no token. Copy a ready-to-paste request.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">curl</p>
            <CodeBlock value={`curl "${runtimeUrl}"`} label="curl snippet" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">fetch</p>
            <CodeBlock
              label="fetch snippet"
              value={`const response = await fetch("${runtimeUrl}");\nconst data = await response.json();\nconsole.log(data);`}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-start gap-2">
          <Checkbox
            id="saved-token-confirmation"
            checked={savedConfirmed}
            onCheckedChange={(value) => setSavedConfirmed(value === true)}
          />
          <div>
            <Label htmlFor="saved-token-confirmation">
              I saved this token somewhere safe
            </Label>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              You must confirm this before opening the project or creating
              another one.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCreateAnother}
            disabled={!savedConfirmed}
          >
            <PlusIcon aria-hidden="true" />
            Create another
          </Button>
          <Button type="button" onClick={handleOpenProject} disabled={!savedConfirmed}>
            Open project
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}

export function CreateSuccess() {
  const result = useWizardStore((state) => state.createResult);

  if (!result) return <MissingResult />;

  return <SuccessPanel key={result.slug} result={result} />;
}
