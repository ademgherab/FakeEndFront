import type {
  HttpMethod,
  JsonValue,
  LogsResponse,
  ProjectLogEntry,
} from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";

export interface LogQuery {
  limit?: number;
  before?: string | null;
  after?: string | null;
  endpointId?: string | null;
  status?: number | null;
  injected?: boolean | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function method(value: unknown): HttpMethod {
  return value === "GET" || value === "POST" || value === "PUT" || value === "DELETE"
    ? value
    : "GET";
}

function normalizeBody(value: unknown): JsonValue | string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return value as JsonValue;
}

function normalizeQuery(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (isRecord(value)) {
    const search = new URLSearchParams();
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || entry === null) continue;
      search.set(key, String(entry));
    }
    const rendered = search.toString();
    return rendered || null;
  }
  return null;
}

function normalizeLogEntry(raw: unknown, index: number): ProjectLogEntry | null {
  if (!isRecord(raw)) return null;

  const endpointObject = isRecord(raw.endpoint) ? raw.endpoint : null;
  const endpointId =
    text(raw.endpointId) ??
    text(raw.endpoint_id) ??
    (endpointObject ? text(endpointObject.id) : null);
  const endpointPath =
    text(raw.endpointPath) ??
    text(raw.endpoint_path) ??
    (endpointObject ? text(endpointObject.path) : null);
  const path = text(raw.path) ?? endpointPath ?? "/";

  const requestId =
    text(raw.requestId) ??
    text(raw.request_id) ??
    text(raw.id);

  const injectedValue = raw.injected;
  const injectedError =
    text(raw.injectedError) ??
    text(raw.injected_error) ??
    (typeof raw.injected === "string" ? raw.injected : null);
  const injected =
    injectedValue === true ||
    (typeof injectedValue === "string" && injectedValue.toLowerCase() !== "false") ||
    Boolean(injectedError);

  const timestamp =
    text(raw.timestamp) ??
    text(raw.createdAt) ??
    text(raw.created_at) ??
    text(raw.at) ??
    new Date().toISOString();

  const id =
    text(raw.id) ??
    `${timestamp}-${method(raw.method)}-${path}-${number(raw.status) ?? 0}-${index}`;

  return {
    id,
    timestamp,
    method: method(raw.method),
    path,
    status: number(raw.status) ?? 0,
    endpointId,
    endpointPath,
    injected,
    injectedError,
    delayMs: number(raw.delayMs) ?? number(raw.delay_ms),
    latencyMs: number(raw.latencyMs) ?? number(raw.latency_ms),
    requestId,
    requestBody: normalizeBody(raw.requestBody ?? raw.request_body),
    query: normalizeQuery(raw.query ?? raw.queryString ?? raw.query_string),
    userAgent: text(raw.userAgent) ?? text(raw.user_agent),
    byteSize: number(raw.byteSize) ?? number(raw.byte_size),
  };
}

export function normalizeLogsResponse(raw: unknown): LogsResponse {
  const record = isRecord(raw) ? raw : {};
  const candidates = [record.items, record.logs, record.entries, record.data];
  const itemsRaw = candidates.find(Array.isArray) ?? [];

  const items = (itemsRaw as unknown[])
    .map((entry, index) => normalizeLogEntry(entry, index))
    .filter((entry): entry is ProjectLogEntry => entry !== null);

  return {
    items,
    nextCursor:
      text(record.nextCursor) ??
      text(record.next_cursor) ??
      text(record.next) ??
      null,
  };
}

/** GET /projects/{slug}/logs with cursor pagination. */
export async function listLogs(
  slug: string,
  token: string,
  query: LogQuery = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<LogsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 50));
  if (query.before) params.set("before", query.before);
  if (query.after) params.set("after", query.after);
  if (query.endpointId) params.set("endpointId", query.endpointId);
  if (typeof query.status === "number") params.set("status", String(query.status));
  if (typeof query.injected === "boolean") {
    params.set("injected", query.injected ? "true" : "false");
  }

  const response = await apiRequest<unknown>(
    `/projects/${encodeURIComponent(slug)}/logs?${params.toString()}`,
    { token, signal, retry: false },
  );

  const data = normalizeLogsResponse(response.data);
  if (!Array.isArray(response.data as unknown[]) && !isRecord(response.data)) {
    throw new AppError({
      status: 0,
      code: "invalid_response",
      title: "The log response is not usable",
      detail: "GET /projects/{slug}/logs did not return a JSON object.",
    });
  }
  return data;
}
