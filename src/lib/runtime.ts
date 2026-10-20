import type { Method, RuntimeErrorBody } from "@/lib/types";

/**
 * Runtime calls (`/m/{slug}/...`) are public: they never carry the edit
 * token and they never throw on `4xx`/`5xx`. The panel shows the status, the
 * runtime headers and the body, so a failing mock is data, not an exception.
 */

export type LinkRelations = {
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
};

export type RuntimePagination = {
  totalCount: number | null;
  page: number | null;
  limit: number | null;
  totalPages: number | null;
};

export type RuntimeCall = {
  status: number;
  statusText: string;
  ok: boolean;
  latencyMs: number;
  headers: Record<string, string>;
  requestId: string | null;
  delayMs: string | null;
  injected: boolean;
  contentType: string | null;
  body: string;
  json: unknown;
  isJson: boolean;
  runtimeError: RuntimeErrorBody["error"] | null;
  pagination: RuntimePagination | null;
  link: LinkRelations | null;
  retryAfter: string | null;
};

export interface RuntimeCallOptions {
  url: string;
  method: Method;
  /** `POST`/`PUT` send `{}`; `DELETE` sends no body. */
  sendBody?: boolean;
  signal?: AbortSignal;
}

/**
 * Parses an RFC 8288 `Link` header into its relations.
 *
 * ```text
 * <https://host/x?page=1>; rel="first", <https://host/x?page=3>; rel="next"
 * ```
 */
export function parseLinkHeader(header: string | null): LinkRelations | null {
  if (!header) return null;
  const relations: LinkRelations = {};

  for (const part of header.split(",")) {
    const match = /<([^>]+)>\s*;\s*(.+)/.exec(part.trim());
    const rawUrl = match?.[1];
    const params = match?.[2];
    if (!rawUrl || !params) continue;
    const url = rawUrl.trim();
    const relMatch = /rel\s*=\s*"?([^";]+)"?/.exec(params);
    const relValue = relMatch?.[1];
    if (!relValue) continue;
    for (const rel of relValue.trim().split(/\s+/)) {
      switch (rel) {
        case "first":
          relations.first = url;
          break;
        case "prev":
          relations.prev = url;
          break;
        case "next":
          relations.next = url;
          break;
        case "last":
          relations.last = url;
          break;
        default:
          break;
      }
    }
  }

  return Object.keys(relations).length > 0 ? relations : null;
}

function readNumber(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Reads `X-Total-Count`, `X-Page`, `X-Limit` and `X-Total-Pages`. */
export function parsePaginationHeaders(
  headers: Headers,
): RuntimePagination | null {
  const pagination: RuntimePagination = {
    totalCount: readNumber(headers, "X-Total-Count"),
    page: readNumber(headers, "X-Page"),
    limit: readNumber(headers, "X-Limit"),
    totalPages: readNumber(headers, "X-Total-Pages"),
  };
  const hasAny = Object.values(pagination).some((value) => value !== null);
  return hasAny ? pagination : null;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function extractRuntimeError(json: unknown): RuntimeErrorBody["error"] | null {
  if (!json || typeof json !== "object" || !("error" in json)) return null;
  const candidate = (json as RuntimeErrorBody).error;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate;
}

/**
 * Calls the mock runtime and normalises the answer. Network failures reject;
 * HTTP failures resolve with the status and body so the panel can render
 * them.
 */
export async function callRuntime(
  options: RuntimeCallOptions,
): Promise<RuntimeCall> {
  const { url, method, sendBody = method === "POST" || method === "PUT" } =
    options;

  const init: RequestInit = {
    method,
    cache: "no-store",
    headers: { Accept: "application/json, text/plain, */*" },
  };
  if (sendBody) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = "{}";
  }
  if (options.signal) init.signal = options.signal;

  const startedAt = performance.now();
  const response = await fetch(url, init);
  const latencyMs = performance.now() - startedAt;

  const contentType = response.headers.get("content-type");
  const isJson = (contentType ?? "").includes("application/json");
  const text = await response.text();

  let json: unknown = null;
  if (isJson && text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  const injectedHeader = response.headers.get("X-Mock-Injected-Error");
  const runtimeError = extractRuntimeError(json);

  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    latencyMs,
    headers: headersToRecord(response.headers),
    requestId: response.headers.get("X-Request-Id"),
    delayMs: response.headers.get("X-Mock-Delay-Ms"),
    injected: injectedHeader === "true" || runtimeError?.injected === true,
    contentType,
    body: text,
    json,
    isJson,
    runtimeError,
    pagination: parsePaginationHeaders(response.headers),
    link: parseLinkHeader(response.headers.get("Link")),
    retryAfter: response.headers.get("Retry-After"),
  };
}
