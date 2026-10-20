import type {
  Endpoint,
  EndpointInput,
  EndpointSettings,
  HealthResponse,
  InferResponse,
  LogsQuery,
  LogsResponse,
  MetaResponse,
  Method,
  PreviewResponse,
  Project,
  ProjectInput,
  ProblemPayload,
  Schema,
} from "@/lib/types";

/**
 * The management API is called directly from the browser. `BASE` is the API
 * origin only: the client appends `/api/v1` itself. There is no BFF.
 */
export const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:5031";

export const API_PREFIX = "/api/v1";

/** Every management error carries a stable `code`; switch on that, not `title`. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemPayload;
  /** Seconds from a `Retry-After` header, when the API sent one. */
  readonly retryAfter: number | null;

  constructor(
    status: number,
    problem: ProblemPayload,
    retryAfter: number | null = null,
  ) {
    super(problem.detail || problem.title || `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.retryAfter = retryAfter;
  }

  /** The stable machine-readable code, when the API sent one. */
  get code(): string | undefined {
    return this.problem.code;
  }
}

/** Kept for the components that imported the old name. */
export const ApiProblemError = ApiError;

/** `Retry-After` is either seconds or an HTTP date. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export interface RequestOptions {
  /** Edit token for project-scoped routes. Never persisted by this app. */
  editToken?: string;
  /** Query string values; `null` and `undefined` are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Single entry point for the management API.
 *
 * - Sends `Accept: application/json` and, only when there is a body,
 *   `Content-Type: application/json`.
 * - Attaches `Authorization: Bearer <token>` when an edit token is given.
 * - A `204` resolves to `undefined`.
 * - Every non-2xx answer throws an {@link ApiError} carrying the RFC 7807
 *   problem payload.
 */
export async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, options.query);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.editToken) {
    headers.set("Authorization", `Bearer ${options.editToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ApiError(0, {
      code: "network_error",
      title: "Cannot reach API",
      detail: `Cannot reach API at ${BASE}. Is the backend running? (${reason})`,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  // A failing API may answer with HTML or plain text; that must not turn into
  // a JSON parse error that hides the real status code.
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const problem: ProblemPayload =
      body && typeof body === "object"
        ? (body as ProblemPayload)
        : {
            title: `Request failed (${response.status})`,
            detail: text ? text.slice(0, 300) : undefined,
          };
    throw new ApiError(
      response.status,
      problem,
      parseRetryAfter(response.headers.get("Retry-After")),
    );
  }

  return body as T;
}

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
): string {
  if (!query) return `${BASE}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${BASE}${path}?${search}` : `${BASE}${path}`;
}

/* ------------------------------------------------------------------ */
/* Health                                                               */
/* ------------------------------------------------------------------ */

/** Public liveness probe. */
export async function getLiveness(): Promise<HealthResponse> {
  return request<HealthResponse>(`/health/live`);
}

/** Public readiness probe. Answers `503` when PostgreSQL is unreachable. */
export async function getReadiness(): Promise<HealthResponse> {
  return request<HealthResponse>(`/health/ready`);
}

/* ------------------------------------------------------------------ */
/* Public routes                                                        */
/* ------------------------------------------------------------------ */

export interface InferRequest {
  sample: unknown;
  options?: { wrapInList?: boolean };
}

export async function infer(payload: InferRequest): Promise<InferResponse> {
  return request<InferResponse>(`${API_PREFIX}/infer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PreviewRequest {
  schema: Schema;
  settings?: EndpointSettings;
  page?: number;
  limit?: number;
}

export async function preview(payload: PreviewRequest): Promise<PreviewResponse> {
  return request<PreviewResponse>(`${API_PREFIX}/preview`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PreviewResult extends PreviewResponse {
  /** The `X-Total-*` and `Link` headers of a paginated preview. */
  headers: Headers;
}

/**
 * Preview with the response headers. Paginated previews carry
 * `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages` and `Link`.
 */
export async function previewWithHeaders(
  payload: PreviewRequest,
): Promise<PreviewResult> {
  const headers = new Headers({ Accept: "application/json" });
  headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${BASE}${API_PREFIX}/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ApiError(0, {
      code: "network_error",
      title: "Cannot reach API",
      detail: `Cannot reach API at ${BASE}. Is the backend running? (${reason})`,
    });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const problem: ProblemPayload =
      body && typeof body === "object"
        ? (body as ProblemPayload)
        : {
            title: `Request failed (${response.status})`,
            detail: text ? text.slice(0, 300) : undefined,
          };
    throw new ApiError(
      response.status,
      problem,
      parseRetryAfter(response.headers.get("Retry-After")),
    );
  }

  const previewBody = (body ?? {}) as PreviewResponse;
  return {
    data: previewBody.data ?? null,
    pagination: previewBody.pagination ?? null,
    headers: response.headers,
  };
}

/**
 * Optional bootstrap. A failure is not an error: the UI falls back to the
 * constants in `defaults.ts` and never blocks on meta.
 */
export async function getMeta(): Promise<MetaResponse | null> {
  try {
    const response = await request<MetaResponse>(`${API_PREFIX}/meta`);
    if (!response || !Array.isArray(response.successStatuses) || !response.limits) {
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Projects                                                             */
/* ------------------------------------------------------------------ */

/** Creates a project. The only place an `editToken` is ever returned. */
export async function createProject(
  payload: ProjectInput,
): Promise<Project> {
  return request<Project>(`${API_PREFIX}/projects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProject(
  slug: string,
  editToken: string,
): Promise<Project> {
  return request<Project>(`${API_PREFIX}/projects/${encodeURIComponent(slug)}`, {}, {
    editToken,
  });
}

/** `name: null` clears the project name. */
export async function renameProject(
  slug: string,
  editToken: string,
  name: string | null,
): Promise<Project> {
  return request<Project>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
    { editToken },
  );
}

export async function deleteProject(
  slug: string,
  editToken: string,
): Promise<void> {
  return request<void>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
    { editToken },
  );
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                            */
/* ------------------------------------------------------------------ */

/** Exactly one of `sample` or `schema` may be sent. */
export type EndpointPayload = Omit<EndpointInput, "options"> & {
  options?: { wrapInList?: boolean };
};

export async function createEndpoint(
  slug: string,
  editToken: string,
  payload: EndpointPayload,
): Promise<Endpoint> {
  return request<Endpoint>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { editToken },
  );
}

export async function getEndpoint(
  slug: string,
  editToken: string,
  endpointId: string,
): Promise<Endpoint> {
  return request<Endpoint>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}`,
    {},
    { editToken },
  );
}

/** Full replace. `schema` and `settings` are required. */
export async function replaceEndpoint(
  slug: string,
  editToken: string,
  endpointId: string,
  payload: { method: Method; path: string; schema: Schema; settings: EndpointSettings },
): Promise<Endpoint> {
  return request<Endpoint>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { editToken },
  );
}

/** Replaces only the schema. The server re-validates the settings. */
export async function replaceEndpointSchema(
  slug: string,
  editToken: string,
  endpointId: string,
  schema: Schema,
): Promise<Endpoint> {
  return request<Endpoint>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}/schema`,
    {
      method: "PUT",
      body: JSON.stringify(schema),
    },
    { editToken },
  );
}

/** Replaces only the settings. */
export async function replaceEndpointSettings(
  slug: string,
  editToken: string,
  endpointId: string,
  settings: EndpointSettings,
): Promise<Endpoint> {
  return request<Endpoint>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}/settings`,
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
    { editToken },
  );
}

export async function deleteEndpoint(
  slug: string,
  editToken: string,
  endpointId: string,
): Promise<void> {
  return request<void>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}`,
    { method: "DELETE" },
    { editToken },
  );
}

/* ------------------------------------------------------------------ */
/* Logs                                                                 */
/* ------------------------------------------------------------------ */

export async function getLogs(
  slug: string,
  editToken: string,
  query: LogsQuery = {},
): Promise<LogsResponse> {
  return request<LogsResponse>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/logs`,
    {},
    {
      editToken,
      query: {
        limit: query.limit ?? 50,
        before: query.before ?? null,
        after: query.after ?? null,
        endpointId: query.endpointId ?? null,
        status: query.status ?? null,
        injected: query.injected ?? null,
      },
    },
  );
}

export async function deleteLogs(
  slug: string,
  editToken: string,
): Promise<void> {
  return request<void>(
    `${API_PREFIX}/projects/${encodeURIComponent(slug)}/logs`,
    { method: "DELETE" },
    { editToken },
  );
}
