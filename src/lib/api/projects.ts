import type {
  CreateEndpointInput,
  CreateProjectRequest,
  CreateProjectResponse,
  CreatedEndpoint,
  EndpointSettings,
  HttpMethod,
  MetaResponse,
  ProjectEndpoint,
  ProjectResponse,
  ProjectUsage,
  Schema,
  SchemaNode,
} from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";
import { joinUrl } from "@/lib/config";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import {
  createMethodSchema,
  createPathSchema,
  createProjectNameSchema,
  createSampleTextSchema,
  validateEndpointSettings,
  validateSchemaShape,
  validateWith,
} from "@/lib/validation/schemas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Internal editor ids must never reach the API. */
export function stripSchemaIds(schema: Schema): Schema {
  return { version: 1, root: stripNodeIds(schema.root) };
}

function stripNodeIds(node: SchemaNode): SchemaNode {
  const clone: SchemaNode = { ...node };
  if (clone.fields) clone.fields = clone.fields.map(stripNodeIds);
  if (clone.items) clone.items = stripNodeIds(clone.items);
  delete clone.id;
  return clone;
}

export interface EndpointDraftLike {
  method: HttpMethod;
  path: string;
  sampleText: string;
  wrapInList: boolean;
  schema: Schema | null;
  settings: EndpointSettings | null;
}

export interface BuildCreateProjectInput {
  name: string;
  endpoint: EndpointDraftLike;
  meta: MetaResponse;
}

function prefixFieldErrors(
  error: AppError,
  prefix: string,
): AppError {
  return new AppError({
    status: error.status,
    code: error.code,
    title: error.title,
    detail: error.detail,
    errors: error.errors
      ? Object.fromEntries(
          Object.entries(error.errors).map(([key, value]) => [`${prefix}.${key}`, value]),
        )
      : undefined,
    traceId: error.traceId,
    retryAfter: error.retryAfter,
    requestId: error.requestId,
    cause: error.cause,
  });
}

/**
 * One endpoint's payload. The caller must send exactly one of `sample` or
 * `schema`; settings and options are copied from the draft, never spread from
 * form state.
 */
export function buildEndpointInput(
  endpoint: EndpointDraftLike,
  meta: MetaResponse,
): CreateEndpointInput {
  const pathCheck = validateWith(createPathSchema(), endpoint.path);
  if (!pathCheck.valid) {
    throw new AppError({
      status: 0,
      code: "validation_failed",
      title: "Path is not valid",
      errors: { path: pathCheck.issues.map((issue) => issue.message) },
    });
  }

  const methodCheck = validateWith(
    createMethodSchema(meta.methods),
    endpoint.method,
  );
  if (!methodCheck.valid) {
    throw new AppError({
      status: 0,
      code: "validation_failed",
      title: "Method is not allowed",
      errors: { method: methodCheck.issues.map((issue) => issue.message) },
    });
  }

  const settings =
    endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta);

  // One meta-driven settings schema for the wizard, the endpoint editor and
  // every write path. Components never duplicate these bounds.
  const settingsCheck = validateEndpointSettings(settings, meta);
  if (!settingsCheck.valid) {
    throw new AppError({
      status: 0,
      code: "validation_failed",
      title: "Some settings need attention",
      errors: { settings: settingsCheck.issues.map((issue) => issue.message) },
    });
  }

  const base: Omit<CreateEndpointInput, "sample" | "schema"> = {
    method: endpoint.method,
    path: endpoint.path,
    options: { wrapInList: endpoint.wrapInList },
    settings,
  };

  if (endpoint.schema) {
    const schemaCheck = validateSchemaShape(endpoint.schema, meta);
    if (!schemaCheck.valid) {
      throw new AppError({
        status: 0,
        code: "validation_failed",
        title: "The schema is not valid",
        errors: { schema: schemaCheck.issues.map((issue) => issue.message) },
      });
    }
    return { ...base, schema: stripSchemaIds(endpoint.schema) };
  }

  const sampleCheck = validateWith(
    createSampleTextSchema(meta.limits.maxSampleBytes),
    endpoint.sampleText,
  );
  if (!sampleCheck.valid || !sampleCheck.data) {
    const messages = sampleCheck.issues.map((issue) => issue.message);
    throw new AppError({
      status: 0,
      code: "sample_invalid",
      title: "The sample cannot be used",
      detail: messages[0],
      errors: { sample: messages },
    });
  }

  return {
    ...base,
    sample: JSON.parse(endpoint.sampleText) as CreateEndpointInput["sample"],
  };
}

export function buildCreateProjectRequest({
  name,
  endpoint,
  meta,
}: BuildCreateProjectInput): CreateProjectRequest {
  const trimmedName = name.trim();
  const nameCheck = validateWith(
    createProjectNameSchema(meta.limits.maxProjectNameLength),
    name,
  );
  if (!nameCheck.valid) {
    throw new AppError({
      status: 0,
      code: "validation_failed",
      title: "Some fields need attention",
      errors: { name: nameCheck.issues.map((issue) => issue.message) },
    });
  }

  let endpointInput: CreateEndpointInput;
  try {
    endpointInput = buildEndpointInput(endpoint, meta);
  } catch (error) {
    if (error instanceof AppError) {
      throw prefixFieldErrors(error, "endpoints[0]");
    }
    throw error;
  }

  return {
    ...(trimmedName ? { name: trimmedName } : {}),
    endpoints: [endpointInput],
  };
}

/**
 * Server-side duplicate detection compares normalized routes, so `/users/{id}`
 * and `/users/{userId}` collide.
 */
export function normalizeEndpointPath(path: string): string {
  const normalized = path.replace(/\{[^}/]+\}/g, "{}").replace(/\/+$/, "");
  return normalized || "/";
}

export function isDuplicateEndpoint(
  method: HttpMethod,
  path: string,
  existing: ReadonlyArray<{ method: HttpMethod; path: string }>,
): boolean {
  const normalized = normalizeEndpointPath(path);
  return existing.some(
    (endpoint) =>
      endpoint.method === method && normalizeEndpointPath(endpoint.path) === normalized,
  );
}

function normalizeEndpoint(raw: unknown, baseUrl: string, index: number): CreatedEndpoint {
  if (!isRecord(raw)) {
    throw invalidResponse(`endpoints[${index}] is not an object.`);
  }
  const id = text(raw.id);
  const path = text(raw.path);
  const method = raw.method;
  if (!id || !path) {
    throw invalidResponse(`endpoints[${index}] is missing id or path.`);
  }
  if (method !== "GET" && method !== "POST" && method !== "PUT" && method !== "DELETE") {
    throw invalidResponse(`endpoints[${index}] has an invalid method.`);
  }

  return {
    id,
    method,
    path,
    url: text(raw.url) ?? joinUrl(baseUrl, path),
  };
}

function invalidResponse(detail: string): AppError {
  return new AppError({
    status: 0,
    code: "invalid_response",
    title: "The project response is not usable",
    detail,
  });
}

export function normalizeCreateProjectResponse(raw: unknown): CreateProjectResponse {
  if (!isRecord(raw)) {
    throw invalidResponse("POST /api/v1/projects did not return a JSON object.");
  }

  const slug = text(raw.slug);
  const editToken = text(raw.editToken);
  const expiresAt = text(raw.expiresAt);
  const baseUrl = text(raw.baseUrl);
  const endpoints = raw.endpoints;

  if (!slug) throw invalidResponse("The response is missing a slug.");
  if (!editToken) throw invalidResponse("The response is missing an edit token.");
  if (!expiresAt) throw invalidResponse("The response is missing an expiry date.");
  if (!baseUrl) throw invalidResponse("The response is missing a base URL.");
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    throw invalidResponse("The response is missing endpoint URLs.");
  }

  return {
    slug,
    name: text(raw.name),
    baseUrl: baseUrl.replace(/\/+$/, ""),
    editToken,
    expiresAt,
    endpoints: endpoints.map((endpoint, index) =>
      normalizeEndpoint(endpoint, baseUrl.replace(/\/+$/, ""), index),
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

function isHttpMethod(value: unknown): value is HttpMethod {
  return value === "GET" || value === "POST" || value === "PUT" || value === "DELETE";
}

/** Validate only the shape the editor depends on; unknown props are ignored. */
export function normalizeSchema(raw: unknown): Schema | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.root)) return undefined;
  if (typeof raw.root.type !== "string") return undefined;
  return raw as unknown as Schema;
}

export function normalizeSettings(raw: unknown): EndpointSettings | undefined {
  if (!isRecord(raw)) return undefined;
  if (!isRecord(raw.delay) || !isRecord(raw.errorInjection) || !isRecord(raw.list)) {
    return undefined;
  }
  if (
    typeof raw.successStatus !== "number" ||
    typeof raw.delay.minMs !== "number" ||
    typeof raw.delay.maxMs !== "number" ||
    typeof raw.errorInjection.rate !== "number" ||
    !Array.isArray(raw.errorInjection.codes) ||
    typeof raw.list.minSize !== "number" ||
    typeof raw.list.maxSize !== "number"
  ) {
    return undefined;
  }
  return raw as unknown as EndpointSettings;
}

/** Normalise one endpoint as returned inside a project. */
export function normalizeProjectEndpoint(
  raw: unknown,
  baseUrl: string,
  index = 0,
): ProjectEndpoint {
  if (!isRecord(raw)) {
    throw invalidResponse(`endpoints[${index}] is not an object.`);
  }

  const id = text(raw.id);
  const path = text(raw.path);
  if (!id) throw invalidResponse(`endpoints[${index}] is missing an id.`);
  if (!path) throw invalidResponse(`endpoints[${index}] is missing a path.`);
  if (!isHttpMethod(raw.method)) {
    throw invalidResponse(`endpoints[${index}] has an invalid method.`);
  }

  const schema = normalizeSchema(raw.schema);
  const settings = normalizeSettings(raw.settings);

  return {
    id,
    method: raw.method,
    path,
    url: text(raw.url) ?? joinUrl(baseUrl, path),
    createdAt: text(raw.createdAt) ?? undefined,
    updatedAt: text(raw.updatedAt) ?? undefined,
    ...(schema ? { schema } : {}),
    ...(settings ? { settings } : {}),
    ...(isRecord(raw.options) && typeof raw.options.wrapInList === "boolean"
      ? { options: { wrapInList: raw.options.wrapInList } }
      : {}),
  };
}

function normalizeUsage(raw: unknown): ProjectUsage | undefined {
  if (!isRecord(raw)) return undefined;
  if (
    typeof raw.requestsToday !== "number" ||
    typeof raw.dailyLimit !== "number"
  ) {
    return undefined;
  }
  return {
    requestsToday: raw.requestsToday,
    dailyLimit: raw.dailyLimit,
    ...(text(raw.resetsAt) ? { resetsAt: text(raw.resetsAt) as string } : {}),
  };
}

export function normalizeProjectResponse(raw: unknown): ProjectResponse {
  if (!isRecord(raw)) {
    throw invalidResponse("GET /api/v1/projects/{slug} did not return an object.");
  }

  const slug = text(raw.slug);
  const baseUrl = text(raw.baseUrl);
  const expiresAt = text(raw.expiresAt);
  if (!slug) throw invalidResponse("The project response is missing a slug.");
  if (!baseUrl) throw invalidResponse("The project response is missing a base URL.");
  if (!expiresAt) {
    throw invalidResponse("The project response is missing an expiry date.");
  }
  if (!Array.isArray(raw.endpoints)) {
    throw invalidResponse("The project response is missing its endpoints.");
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const usage = normalizeUsage(raw.usage);
  const quota = isRecord(raw.quota)
    ? {
        limit: typeof raw.quota.limit === "number" ? raw.quota.limit : 0,
        remaining: typeof raw.quota.remaining === "number" ? raw.quota.remaining : 0,
        resetsAt: text(raw.quota.resetsAt) ?? undefined,
      }
    : undefined;

  return {
    slug,
    name: text(raw.name),
    baseUrl: normalizedBase,
    createdAt: text(raw.createdAt) ?? undefined,
    updatedAt: text(raw.updatedAt) ?? undefined,
    expiresAt,
    endpoints: raw.endpoints.map((endpoint, index) =>
      normalizeProjectEndpoint(endpoint, normalizedBase, index),
    ),
    ...(quota ? { quota } : {}),
    ...(usage ? { usage } : {}),
  };
}

/** GET /projects/{slug}. Requires the edit token; never called without one. */
export async function getProject(
  slug: string,
  token: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ProjectResponse> {
  const response = await apiRequest<unknown>(
    `/projects/${encodeURIComponent(slug)}`,
    { token, signal, retry: false },
  );
  return normalizeProjectResponse(response.data);
}

/**
 * POST /projects. Writes are never retried automatically; the caller offers an
 * explicit retry. The Location header is ignored in favour of the body.
 */
export async function createProject(
  request: CreateProjectRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CreateProjectResponse> {
  const response = await apiRequest<unknown>("/projects", {
    method: "POST",
    body: request,
    signal,
    retry: false,
    fallbackCode: "validation_failed",
  });

  return normalizeCreateProjectResponse(response.data);
}
