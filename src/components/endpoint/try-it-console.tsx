"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BanIcon,
  CircleStopIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  WifiOffIcon,
} from "lucide-react";
import type { ProjectEndpoint } from "@/lib/api/generated/schema";
import { CopyButton } from "@/components/common/copy-button";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeta } from "@/hooks/use-meta";
import { formatBytes, formatDuration, formatUtcDateTime } from "@/lib/format";
import {
  buildRuntimeUrl,
  injectedErrorFromHeaders,
  readRuntimeHeaders,
  requiredPathParams,
  statusCategory,
  validateRequestBody,
  type KeyValueRow,
  type RuntimeHeader,
} from "@/lib/runtime/request";

const HEADER_LABELS: Record<string, string> = {
  "x-request-id": "Request ID",
  "x-mock-delay-ms": "Mock delay",
  "x-mock-injected-error": "Injected error",
  "x-total-count": "Total count",
  "x-page": "Page",
  "x-limit": "Limit",
  "x-total-pages": "Total pages",
  "x-has-next": "Has next",
  "x-has-prev": "Has previous",
  "retry-after": "Retry after",
};

function newRow(): KeyValueRow {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    key: "",
    value: "",
  };
}

type Outcome =
  | {
      kind: "response";
      status: number;
      statusText: string;
      headers: RuntimeHeader[];
      text: string;
      latencyMs: number;
      injected: string | null;
      contentType: string | null;
      requestUrl: string;
      requestMethod: string;
      requestBody: string | null;
      receivedAt: string;
    }
  | {
      kind: "network";
      message: string;
      requestUrl: string;
      requestMethod: string;
      startedAt: string;
    };

function viewStyle(kind: Outcome["kind"], status?: number, injected?: boolean) {
  if (kind === "network") {
    return "border-red-400/30 bg-red-400/[0.05]";
  }
  if (injected) return "border-amber-300/35 bg-amber-300/[0.06]";
  if ((status ?? 0) >= 400) return "border-red-400/30 bg-red-400/[0.05]";
  return "border-lime-300/25 bg-lime-300/[0.04]";
}

export interface TryItConsoleProps {
  endpoint: ProjectEndpoint;
  baseUrl: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * RUN-01: a direct browser fetch against the mock runtime. The edit token is
 * deliberately absent: this is the same call an external API consumer makes.
 */
export function TryItConsole({
  endpoint,
  baseUrl,
  disabled = false,
  disabledReason,
}: TryItConsoleProps) {
  const { data: meta } = useMeta();
  const pathNames = useMemo(
    () => requiredPathParams(endpoint.path),
    [endpoint.path],
  );

  const [pathParams, setPathParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(pathNames.map((name) => [name, ""])),
  );
  const [queryRows, setQueryRows] = useState<KeyValueRow[]>([]);
  const [bodyText, setBodyText] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bodyView, setBodyView] = useState<"pretty" | "raw">("pretty");

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  const built = useMemo(
    () =>
      buildRuntimeUrl({
        endpointUrl: endpoint.url,
        baseUrl,
        path: endpoint.path,
        pathParams,
        queryParams: queryRows,
      }),
    [baseUrl, endpoint.path, endpoint.url, pathParams, queryRows],
  );

  const bodyValidation = validateRequestBody(bodyText, endpoint.method);
  const bodyAllowed = endpoint.method === "POST" || endpoint.method === "PUT";
  const maxBodyBytes = meta?.limits.maxRequestBodyBytes;
  const bodyBytes = useMemo(
    () => (bodyAllowed ? new TextEncoder().encode(bodyText).length : 0),
    [bodyAllowed, bodyText],
  );
  const bodyTooLarge =
    bodyAllowed &&
    typeof maxBodyBytes === "number" &&
    bodyBytes > maxBodyBytes;

  const prettyBody = useMemo(() => {
    if (!outcome || outcome.kind !== "response" || !outcome.text) return null;
    try {
      return JSON.stringify(JSON.parse(outcome.text) as unknown, null, 2);
    } catch {
      return null;
    }
  }, [outcome]);

  const canSend =
    !disabled &&
    !loading &&
    built.missing.length === 0 &&
    built.invalidQueryKeys.length === 0 &&
    bodyValidation.valid &&
    !bodyTooLarge;

  const blockedReason = disabled
    ? (disabledReason ?? "This project is read-only.")
    : built.missing.length > 0
      ? `Fill in path parameter${built.missing.length === 1 ? "" : "s"}: ${built.missing.map((name) => `{${name}}`).join(", ")}.`
      : built.invalidQueryKeys.length > 0
        ? "Every query value needs a key."
        : !bodyValidation.valid
          ? "The request body is not valid JSON."
          : bodyTooLarge
            ? `The body is ${formatBytes(bodyBytes)}; the limit is ${formatBytes(maxBodyBytes ?? 0)}.`
            : null;

  function updateRow(id: string, patch: Partial<KeyValueRow>) {
    setQueryRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function resetRequest() {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setLoading(false);
    setNotice(null);
    setOutcome(null);
    setPathParams(Object.fromEntries(pathNames.map((name) => [name, ""])));
    setQueryRows([]);
    setBodyText("");
    setBodyView("pretty");
  }

  function cancelRequest() {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setLoading(false);
    setNotice("Request cancelled. The response was ignored.");
  }

  async function send() {
    if (!canSend || !built.url) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setNotice(null);
    setOutcome(null);

    const requestBody = bodyValidation.hasBody ? bodyText : null;
    const started = performance.now();
    const startedAt = new Date().toISOString();

    try {
      const headers = new Headers({ Accept: "application/json" });
      if (requestBody !== null) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(built.url, {
        method: endpoint.method,
        headers,
        body: requestBody ?? undefined,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
      });

      const text = response.status === 204 ? "" : await response.text();
      const latencyMs = performance.now() - started;
      if (requestIdRef.current !== requestId) return;

      setOutcome({
        kind: "response",
        status: response.status,
        statusText: response.statusText || statusCategory(response.status),
        headers: readRuntimeHeaders(response.headers),
        text,
        latencyMs,
        injected: injectedErrorFromHeaders(response.headers),
        contentType: response.headers.get("content-type"),
        requestUrl: built.url,
        requestMethod: endpoint.method,
        requestBody,
        receivedAt: new Date().toISOString(),
      });
    } catch (caught) {
      if (requestIdRef.current !== requestId) return;
      if (controller.signal.aborted) return;

      setOutcome({
        kind: "network",
        message:
          caught instanceof TypeError
            ? "The browser could not read the response. This is usually a network failure or a CORS problem, not an injected mock error."
            : caught instanceof Error
              ? caught.message
              : "The request failed before a response arrived.",
        requestUrl: built.url,
        requestMethod: endpoint.method,
        startedAt,
      });
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">
              Request preview
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              This call goes straight to the mock runtime. No edit token is sent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {endpoint.method}
            </Badge>
            <CopyButton
              value={built.url ?? ""}
              label="Copy runtime URL"
              toastMessage="Runtime URL copied."
              variant="outline"
              size="sm"
              disabled={!built.url}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetRequest}
              disabled={loading}
            >
              <RotateCcwIcon aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <code className="block break-all font-mono text-xs text-zinc-300">
            {built.url ?? "URL unavailable"}
          </code>
        </div>
      </div>

      {pathNames.length > 0 ? (
        <section aria-labelledby="try-path-params" className="space-y-2">
          <h3
            id="try-path-params"
            className="text-sm font-semibold text-zinc-100"
          >
            Path parameters
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {pathNames.map((name) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`path-param-${name}`} className="font-mono">
                  {"{"}
                  {name}
                  {"}"}
                </Label>
                <Input
                  id={`path-param-${name}`}
                  value={pathParams[name] ?? ""}
                  onChange={(event) =>
                    setPathParams((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                  placeholder={`Value for ${name}`}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={
                    !(pathParams[name] ?? "").trim() || undefined
                  }
                />
              </div>
            ))}
          </div>
          {built.missing.length > 0 ? (
            <p className="text-xs text-amber-300">
              Fill in every path parameter before sending.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="try-query" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3
              id="try-query"
              className="text-sm font-semibold text-zinc-100"
            >
              Query parameters
            </h3>
            <p className="text-xs text-zinc-500">
              Keys and values are URL-encoded. Duplicate keys are preserved.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQueryRows((current) => [...current, newRow()])}
          >
            <PlusIcon aria-hidden="true" />
            Add parameter
          </Button>
        </div>

        {queryRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-zinc-500">
            No query parameters. Add one to test pagination or filters.
          </p>
        ) : (
          <div className="space-y-2">
            {queryRows.map((row, index) => (
              <div
                key={row.id}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <Input
                  value={row.key}
                  onChange={(event) =>
                    updateRow(row.id, { key: event.target.value })
                  }
                  placeholder="key"
                  aria-label={`Query key ${index + 1}`}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-invalid={!row.key.trim() && Boolean(row.value) || undefined}
                />
                <Input
                  value={row.value}
                  onChange={(event) =>
                    updateRow(row.id, { value: event.target.value })
                  }
                  placeholder="value"
                  aria-label={`Query value ${index + 1}`}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove query parameter ${index + 1}`}
                  onClick={() =>
                    setQueryRows((current) =>
                      current.filter((entry) => entry.id !== row.id),
                    )
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {built.invalidQueryKeys.length > 0 ? (
          <p className="text-xs text-amber-300">
            A query value is set without a key. Add a key or clear the value.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="try-body" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="try-body" className="text-sm font-semibold text-zinc-100">
              Request body
            </h3>
            <p className="text-xs text-zinc-500">
              {bodyAllowed
                ? "Sent as JSON with Content-Type: application/json."
                : `${endpoint.method} does not send a request body.`}
            </p>
          </div>
          {bodyAllowed ? (
            <span className="text-xs text-zinc-500">
              {formatBytes(bodyBytes)}
              {typeof maxBodyBytes === "number"
                ? ` / ${formatBytes(maxBodyBytes)}`
                : ""}
            </span>
          ) : null}
        </div>

        {bodyAllowed ? (
          <>
            <Textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={8}
              spellCheck={false}
              className="font-mono text-xs leading-6"
              placeholder={'{\n  "name": "Example"\n}'}
              aria-label="JSON request body"
              aria-invalid={!bodyValidation.valid || bodyTooLarge || undefined}
            />
            {!bodyValidation.valid ? (
              <p role="alert" className="text-xs text-red-300">
                {bodyValidation.error}
              </p>
            ) : null}
            {bodyTooLarge ? (
              <p role="alert" className="text-xs text-red-300">
                The body exceeds the limit from /meta.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500">
            No body is sent for {endpoint.method}. Any response body still
            appears below.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={!canSend}
          title={blockedReason ?? undefined}
        >
          <PlayIcon aria-hidden="true" />
          {loading ? "Sending…" : "Send request"}
        </Button>
        {loading ? (
          <Button type="button" variant="outline" onClick={cancelRequest}>
            <CircleStopIcon aria-hidden="true" />
            Cancel
          </Button>
        ) : null}
        {blockedReason ? (
          <p className="text-xs text-zinc-500">{blockedReason}</p>
        ) : null}
      </div>

      <div aria-live="polite" className="space-y-3">
        {notice ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">
            {notice}
          </p>
        ) : null}

        {!outcome && !loading ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
            Send a request to see the real status, headers and body. Simulated
            errors arrive as a normal HTTP response with a badge.
          </p>
        ) : null}

        {loading ? (
          <div
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6"
            aria-busy="true"
          >
            <p className="text-sm text-zinc-300">Waiting for the runtime…</p>
            <p className="mt-1 text-xs text-zinc-500">
              You can cancel; a late response will be ignored.
            </p>
          </div>
        ) : null}

        {outcome?.kind === "network" ? (
          <div
            className={`rounded-xl border p-4 ${viewStyle("network")}`}
            role="alert"
          >
            <div className="flex flex-wrap items-center gap-2">
              <WifiOffIcon aria-hidden="true" className="size-4 text-red-300" />
              <h3 className="text-sm font-semibold text-zinc-100">
                No response from the runtime
              </h3>
              <Badge variant="outline" className="border-red-400/40 text-red-200">
                Network / CORS
              </Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-300">{outcome.message}</p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Attempted</dt>
                <dd className="break-all font-mono text-zinc-300">
                  {outcome.requestMethod} {outcome.requestUrl}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Started</dt>
                <dd>
                  <time dateTime={outcome.startedAt} title={formatUtcDateTime(outcome.startedAt)}>
                    {new Date(outcome.startedAt).toLocaleTimeString()}
                  </time>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-500">
              This is distinct from a simulated error: a simulated error is a
              real HTTP response, often with an injected-error badge.
            </p>
          </div>
        ) : null}

        {outcome?.kind === "response" ? (
          <div
            className={`rounded-xl border p-4 ${viewStyle("response", outcome.status, Boolean(outcome.injected))}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                status={outcome.status}
                injected={Boolean(outcome.injected)}
              />
              <span className="text-sm font-semibold text-zinc-100">
                {outcome.statusText}
              </span>
              {outcome.injected ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/40 bg-amber-300/10 text-amber-200"
                >
                  Simulated by mock — {outcome.injected}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-400">
                  Real response
                </Badge>
              )}
              <span className="ml-auto font-mono text-xs text-zinc-400">
                {formatDuration(outcome.latencyMs)}
              </span>
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              {outcome.requestMethod}{" "}
              <span className="break-all font-mono">{outcome.requestUrl}</span>
              {" · "}
              <time
                dateTime={outcome.receivedAt}
                title={formatUtcDateTime(outcome.receivedAt)}
              >
                {new Date(outcome.receivedAt).toLocaleTimeString()}
              </time>
            </p>

            {outcome.headers.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Runtime headers
                </h4>
                <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                  {outcome.headers.map((header) => (
                    <div
                      key={header.name}
                      className="flex items-baseline justify-between gap-3 rounded border border-white/10 bg-black/20 px-2 py-1.5"
                    >
                      <dt className="text-zinc-500">
                        {HEADER_LABELS[header.name] ?? header.name}
                      </dt>
                      <dd className="break-all text-right font-mono text-zinc-200">
                        {header.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                No exposed runtime headers were present on this response.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={bodyView === "pretty" ? "default" : "ghost"}
                  onClick={() => setBodyView("pretty")}
                  disabled={prettyBody === null}
                >
                  Pretty
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={bodyView === "raw" ? "default" : "ghost"}
                  onClick={() => setBodyView("raw")}
                >
                  Raw
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {formatBytes(new TextEncoder().encode(outcome.text).length)}
                  {outcome.contentType ? ` · ${outcome.contentType}` : ""}
                </span>
                <CopyButton
                  value={outcome.text}
                  label="Copy response body"
                  toastMessage="Response body copied."
                  variant="ghost"
                  size="xs"
                  disabled={!outcome.text}
                />
              </div>
            </div>

            {outcome.text ? (
              <pre className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-6 text-zinc-200">
                <code>
                  {bodyView === "pretty"
                    ? (prettyBody ?? outcome.text)
                    : outcome.text}
                </code>
              </pre>
            ) : (
              <p className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-4 text-xs text-zinc-500">
                {outcome.status === 204
                  ? "204 No Content — the response has no body."
                  : "The response body is empty."}
              </p>
            )}

            {!outcome.text && outcome.status >= 500 && !outcome.injected ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-red-300">
                <BanIcon aria-hidden="true" className="size-3.5" />
                This is a real server error, not an injected mock error.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
