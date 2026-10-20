import type {
  CreateEndpointInput,
  EndpointSettings,
  HttpMethod,
  ProjectEndpoint,
  ProjectResponse,
  Schema,
  UpdateEndpointInput,
} from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";
import { joinUrl } from "@/lib/config";
import { stripSchemaIds } from "@/lib/api/projects";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function method(value: unknown): HttpMethod | null {
  return value === "GET" || value === "POST" || value === "PUT" || value === "DELETE"
    ? value
    : null;
}

function invalid(detail: string): AppError {
  return new AppError({
    status: 0,
    code: "invalid_response",
    title: "The endpoint response is not usable",
    detail,
  });
}

function normalizeEndpoint(
  raw: unknown,
  baseUrl: string,
  index: number,
): ProjectEndpoint {
  if (!isRecord(raw)) throw invalid(`endpoints[${index}] is not an object.`);
  const id = text(raw.id);
  const path = text(raw.path);
  const endpointMethod = method(raw.method);
  if (!id || !path || !endpointMethod) {
    throw invalid(`endpoints[${index}] is missing id, method or path.`);
  }

  const schema =
    isRecord(raw.schema) && raw.schema.version === 1 && isRecord(raw.schema.root)
      ? (raw.schema as unknown as Schema)
      : undefined;

  return {
    id,
    method: endpointMethod,
    path,
    url: text(raw.url) ?? joinUrl(baseUrl, path),
    ...(text(raw.createdAt) ? { createdAt: text(raw.createdAt) as string } : {}),
    ...(text(raw.updatedAt) ? { updatedAt: text(raw.updatedAt) as string } : {}),
    ...(schema ? { schema } : {}),
    ...(isRecord(raw.settings)
      ? { settings: raw.settings as unknown as EndpointSettings }
      : {}),
  };
}

export function normalizeProjectResponse(raw: unknown): ProjectResponse {
  if (!isRecord(raw)) {
    throw new AppError({
      status: 0,
      code: "invalid_response",
      title: "The project response is not usable",
      detail: "GET /api/v1/projects/{slug} did not return a JSON object.",
    });
  }

  const slug = text(raw.slug);
  const baseUrl = text(raw.baseUrl);
  const expiresAt = text(raw.expiresAt);
  const endpoints = raw.endpoints;

  if (!slug) throw invalid("The response is missing a slug.");
  if (!baseUrl) throw invalid("The response is missing a base URL.");
  if (!expiresAt) throw invalid("The response is missing an expiry date.");
  if (!Array.isArray(endpoints)) throw invalid("The response is missing endpoints.");

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return {
    slug,
    name: text(raw.name),
    baseUrl: normalizedBaseUrl,
    expiresAt,
    ...(text(raw.createdAt) ? { createdAt: text(raw.createdAt) as string } : {}),
    ...(text(raw.updatedAt) ? { updatedAt: text(raw.updatedAt) as string } : {}),
    endpoints: endpoints.map((endpoint, index) =>
      normalizeEndpoint(endpoint, normalizedBaseUrl, index),
    ),
    ...(isRecord(raw.quota)
      ? {
          quota: {
            limit: typeof raw.quota.limit === "number" ? raw.quota.limit : 0,
            remaining:
              typeof raw.quota.remaining === "number" ? raw.quota.remaining : 0,
            resetsAt: text(raw.quota.resetsAt) ?? undefined,
          },
        }
      : {}),
  };
}

export async function getProject(
  slug: string,
  token: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ProjectResponse> {
  const response = await apiRequest<unknown>(
    `/projects/${encodeURIComponent(slug)}`,
    { token, signal, fallbackCode: "project_not_found" },
  );
  return normalizeProjectResponse(response.data);
}

export function normalizeAddedEndpoint(
  raw: unknown,
  baseUrl: string,
): ProjectEndpoint {
  const candidate = isRecord(raw) && isRecord(raw.endpoint) ? raw.endpoint : raw;
  return normalizeEndpoint(candidate, baseUrl.replace(/\/+$/, ""), 0);
}

export async function addEndpoint(
  slug: string,
  input: CreateEndpointInput,
  options: { token: string; baseUrl: string; signal?: AbortSignal },
): Promise<ProjectEndpoint> {
  const response = await apiRequest<unknown>(
    `/projects/${encodeURIComponent(slug)}/endpoints`,
    {
      method: "POST",
      body: input,
      token: options.token,
      signal: options.signal,
      retry: false,
      fallbackCode: "validation_failed",
    },
  );
  return normalizeAddedEndpoint(response.data, options.baseUrl);
}

function endpointPath(slug: string, endpointId: string, suffix = ""): string {
  return `/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}${suffix}`;
}

function unwrapEndpoint(raw: unknown): unknown {
  return isRecord(raw) && isRecord(raw.endpoint) ? raw.endpoint : raw;
}

/** Some write endpoints answer 204; that is a valid save with no body. */
function normalizeSavedEndpoint(
  raw: unknown,
  baseUrl: string,
): ProjectEndpoint | null {
  const value = unwrapEndpoint(raw);
  if (value === undefined || value === null) return null;
  return normalizeEndpoint(value, baseUrl.replace(/\/+$/, ""), 0);
}

export interface EndpointWriteOptions {
  baseUrl: string;
  signal?: AbortSignal;
}

export async function getEndpoint(
  slug: string,
  endpointId: string,
  token: string,
  { baseUrl, signal }: EndpointWriteOptions,
): Promise<ProjectEndpoint> {
  const response = await apiRequest<unknown>(endpointPath(slug, endpointId), {
    token,
    signal,
    retry: false,
    fallbackCode: "endpoint_not_found",
  });
  return normalizeEndpoint(
    unwrapEndpoint(response.data),
    baseUrl.replace(/\/+$/, ""),
    0,
  );
}

/**
 * Full replace for method/path changes. The complete current schema and
 * settings are always included, so a route edit cannot erase either half.
 */
export async function updateEndpoint(
  slug: string,
  endpointId: string,
  token: string,
  input: UpdateEndpointInput,
  { baseUrl, signal }: EndpointWriteOptions,
): Promise<ProjectEndpoint | null> {
  const response = await apiRequest<unknown>(endpointPath(slug, endpointId), {
    method: "PUT",
    token,
    body: {
      method: input.method,
      path: input.path,
      schema: stripSchemaIds(input.schema),
      settings: input.settings,
      ...(input.options ? { options: input.options } : {}),
    },
    signal,
    retry: false,
    fallbackCode: "validation_failed",
  });
  return normalizeSavedEndpoint(response.data, baseUrl);
}

/** Schema-only save: the body is the schema itself, never partial settings. */
export async function updateEndpointSchema(
  slug: string,
  endpointId: string,
  token: string,
  schema: Schema,
  { baseUrl, signal }: EndpointWriteOptions,
): Promise<ProjectEndpoint | null> {
  const response = await apiRequest<unknown>(
    endpointPath(slug, endpointId, "/schema"),
    {
      method: "PUT",
      token,
      body: stripSchemaIds(schema),
      signal,
      retry: false,
      fallbackCode: "validation_failed",
    },
  );
  return normalizeSavedEndpoint(response.data, baseUrl);
}

/** Settings-only save; settings are always replaced in full. */
export async function updateEndpointSettings(
  slug: string,
  endpointId: string,
  token: string,
  settings: EndpointSettings,
  { baseUrl, signal }: EndpointWriteOptions,
): Promise<ProjectEndpoint | null> {
  const response = await apiRequest<unknown>(
    endpointPath(slug, endpointId, "/settings"),
    {
      method: "PUT",
      token,
      body: settings,
      signal,
      retry: false,
      fallbackCode: "validation_failed",
    },
  );
  return normalizeSavedEndpoint(response.data, baseUrl);
}

export async function deleteEndpoint(
  slug: string,
  endpointId: string,
  token: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<void> {
  await apiRequest<unknown>(
    `/projects/${encodeURIComponent(slug)}/endpoints/${encodeURIComponent(endpointId)}`,
    {
      method: "DELETE",
      token,
      signal,
      retry: false,
      fallbackCode: "endpoint_not_found",
    },
  );
}
