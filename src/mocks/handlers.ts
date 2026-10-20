import { HttpResponse, http, delay } from "msw";
import type {
  CreateEndpointRequest,
  CreateProjectRequest,
  EndpointSettings,
  HttpMethod,
  JsonValue,
  LogsResponse,
  MetaResponse,
  PreviewRequest,
  ProjectLogEntry,
  Schema,
} from "@/lib/api/generated/schema";
import { config } from "@/lib/config";
import { validateEndpointSettings, validateSchemaShape, normalizePathForComparison } from "@/lib/validation/schemas";
import { validatePath } from "@/lib/wizard/validation";
import { generatePreview, inferSample } from "./inference";
import {
  appendLog,
  createDemoEndpoint,
  deleteProject,
  DEMO_SLUG,
  getProjectBySlug,
  listProjects,
  makeEditToken,
  makeId,
  makeSlug,
  MOCK_META_LIMITS,
  mockBaseUrl,
  nextLogId,
  putProject,
  resetMockData,
  toProjectResponse,
  type MockEndpoint,
  type MockProject,
} from "./data";

const API = `${config.apiBaseUrl}/api/v1`;
const MOCK = mockBaseUrl();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
  "Access-Control-Expose-Headers":
    "X-Request-Id,X-Mock-Delay-Ms,X-Mock-Injected-Error,X-Total-Count,X-Page,X-Limit,X-Total-Pages,X-Has-Next,X-Has-Prev,Retry-After",
};

const GENERATORS: MetaResponse["generators"] = [
  {
    id: "string.email",
    label: "Email address",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.uuid",
    label: "UUID",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.firstName",
    label: "First name",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.lastName",
    label: "Last name",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.fullName",
    label: "Full name",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.url",
    label: "URL",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.date",
    label: "Date",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.dateTime",
    label: "Date and time",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "string.paragraph",
    label: "Paragraph",
    appliesTo: ["string"],
    params: [],
  },
  {
    id: "integer.sequence",
    label: "Sequence",
    appliesTo: ["integer"],
    params: [{ name: "start", type: "integer", required: false, default: 1 }],
  },
  {
    id: "number.price",
    label: "Price",
    appliesTo: ["number"],
    params: [],
  },
];

const META: MetaResponse = {
  version: "mock-1",
  mockBaseUrl: MOCK,
  methods: ["GET", "POST", "PUT", "DELETE"],
  successStatuses: { GET: 200, POST: 201, PUT: 200, DELETE: 204 },
  limits: MOCK_META_LIMITS,
  delay: { minMs: 0, maxMs: 10_000 },
  errorRate: { min: 0, max: 100, maxDecimals: 1 },
  listSize: { min: 0, max: 1_000 },
  pagination: { maxTotalItems: 10_000, maxLimit: 100 },
  generators: GENERATORS,
  errorRange: { min: 400, max: 599 },
};

function requestId(): string {
  return makeId("req");
}

function problem(
  status: number,
  code: string,
  title: string,
  detail?: string,
  extra: Record<string, unknown> = {},
) {
  const id = requestId();
  return HttpResponse.json(
    {
      type: `https://mockapi.dev/problems/${code}`,
      title,
      status,
      code,
      detail,
      traceId: id,
      ...extra,
    },
    {
      status,
      headers: { "Content-Type": "application/problem+json", "X-Request-Id": id, ...CORS },
    },
  );
}

function runtimeError(status: number, code: string, message: string) {
  const id = requestId();
  return HttpResponse.json(
    {
      error: {
        status,
        code,
        title: code.replace(/_/g, " "),
        message,
        injected: code === "injected_error",
        requestId: id,
      },
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": id,
        "X-Mock-Injected-Error": code === "injected_error" ? code : "",
        ...CORS,
      },
    },
  );
}

function requiresProject(request: Request, slug: string): MockProject | Response {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return problem(401, "missing_token", "Edit token required", "Send Authorization: Bearer <editToken>.");
  }

  const project = getProjectBySlug(slug);
  if (!project) {
    return problem(404, "project_not_found", "Project not found", `No project with slug "${slug}".`);
  }
  if (project.editToken !== token) {
    return problem(403, "invalid_token", "Invalid token", "The token does not match this project.");
  }
  if (new Date(project.expiresAt).getTime() < Date.now()) {
    return problem(410, "project_expired", "Project expired", "Create a new project to keep testing.");
  }
  return project;
}

function isResponse(value: MockProject | Response): value is Response {
  return value instanceof Response;
}

function readJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

async function latency(ms = 90): Promise<void> {
  await delay(ms);
}

function projectBase(slug: string): string {
  return `${MOCK}/${slug}`;
}

function normalizeEndpointInput(
  input: CreateEndpointRequest,
  method: HttpMethod,
): MockEndpoint {
  const pathCheck = validatePath(input.path);
  if (!pathCheck.valid) {
    throw new Error(pathCheck.errors[0] ?? "Invalid path.");
  }
  const schema =
    input.schema ??
    (input.sample !== undefined
      ? inferSample(input.sample, input.options?.wrapInList).schema
      : { version: 1 as const, root: { name: "root", type: "object" as const, fields: [] } });

  return createDemoEndpoint(method, input.path, schema, input.settings);
}

function sampleBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export const handlers = [
  http.options(`${API}/*`, () => new HttpResponse(null, { status: 204, headers: CORS })),
  http.options(`${MOCK}/:slug/*`, () => new HttpResponse(null, { status: 204, headers: CORS })),
  http.options(`${MOCK}/:slug`, () => new HttpResponse(null, { status: 204, headers: CORS })),

  /* ---------------------------------------------------------------- */
  /* Meta, infer, preview                                             */
  /* ---------------------------------------------------------------- */

  http.get(`${API}/meta`, async ({ request }) => {
    await latency(40);
    const url = new URL(request.url);
    if (url.searchParams.get("inject") === "503") {
      return problem(503, "internal_error", "Injected outage", "The mock server was asked to fail.");
    }
    return HttpResponse.json(META, { headers: CORS });
  }),

  http.post(`${API}/infer`, async ({ request }) => {
    await latency();
    let body: { sample?: JsonValue; options?: { wrapInList?: boolean } };
    try {
      body = await readJson(request);
    } catch {
      return problem(400, "sample_invalid", "Invalid JSON", "The request body is not valid JSON.");
    }
    if (body.sample === null || typeof body.sample !== "object") {
      return problem(422, "sample_invalid", "Invalid sample", "The sample root must be an object or array.");
    }
    if (sampleBytes(body.sample) > MOCK_META_LIMITS.maxSampleBytes) {
      return problem(
        413,
        "payload_too_large",
        "Sample too large",
        `The sample exceeds ${MOCK_META_LIMITS.maxSampleBytes} bytes.`,
      );
    }

    const inferred = inferSample(body.sample, body.options?.wrapInList === true);
    return HttpResponse.json(inferred, { headers: CORS });
  }),

  http.post(`${API}/preview`, async ({ request }) => {
    await latency(60);
    const body = await readJson<PreviewRequest>(request);
    const schemaIssues = validateSchemaShape(body.schema, META);
    if (!schemaIssues.valid) {
      return problem(422, "validation_failed", "Invalid schema", schemaIssues.issues[0]?.message, {
        errors: { schema: schemaIssues.issues.map((issue) => issue.message) },
      });
    }
    const settingsIssues = validateEndpointSettings(body.settings, META);
    if (!settingsIssues.valid) {
      return problem(422, "validation_failed", "Invalid settings", settingsIssues.issues[0]?.message, {
        errors: settingsIssues.fieldErrors,
      });
    }
    return HttpResponse.json(
      generatePreview(body.schema, body.settings as EndpointSettings, {
        page: body.page,
        limit: body.limit,
      }),
      { headers: CORS },
    );
  }),

  /* ---------------------------------------------------------------- */
  /* Projects                                                         */
  /* ---------------------------------------------------------------- */

  http.post(`${API}/projects`, async ({ request }) => {
    await latency(140);
    let body: CreateProjectRequest;
    try {
      body = await readJson(request);
    } catch {
      return problem(400, "validation_failed", "Invalid JSON", "The request body is not valid JSON.");
    }
    if (!Array.isArray(body.endpoints) || body.endpoints.length === 0) {
      return problem(422, "validation_failed", "Endpoints required", "Add at least one endpoint.", {
        errors: { endpoints: ["Add at least one endpoint."] },
      });
    }
    if (body.endpoints.length > MOCK_META_LIMITS.maxEndpointsPerProject) {
      return problem(
        422,
        "endpoint_limit_reached",
        "Endpoint limit reached",
        `A project can have at most ${MOCK_META_LIMITS.maxEndpointsPerProject} endpoints.`,
      );
    }
    if (body.name !== undefined && [...body.name].length > MOCK_META_LIMITS.maxProjectNameLength) {
      return problem(400, "validation_failed", "Name too long", "Shorten the project name.", {
        errors: { name: [`Project name must be ${MOCK_META_LIMITS.maxProjectNameLength} characters or fewer.`] },
      });
    }

    const seen = new Set<string>();
    const endpoints: MockEndpoint[] = [];
    for (const [index, input] of body.endpoints.entries()) {
      const pathCheck = validatePath(input.path);
      if (!pathCheck.valid) {
        return problem(422, "validation_failed", "Invalid path", pathCheck.errors[0], {
          errors: { [`endpoints[${index}].path`]: pathCheck.errors },
        });
      }
      const key = `${input.method} ${normalizePathForComparison(input.path)}`;
      if (seen.has(key)) {
        return problem(409, "duplicate_endpoint", "Duplicate endpoint", "Two endpoints share a method and path.", {
          errors: { [`endpoints[${index}].path`]: ["Another endpoint uses the same method and path."] },
        });
      }
      seen.add(key);
      if (input.schema) {
        const schemaIssues = validateSchemaShape(input.schema, META);
        if (!schemaIssues.valid) {
          return problem(422, "validation_failed", "Invalid schema", schemaIssues.issues[0]?.message, {
            errors: { [`endpoints[${index}].schema`]: schemaIssues.issues.map((issue) => issue.message) },
          });
        }
      }
      if (input.settings) {
        const settingsIssues = validateEndpointSettings(input.settings, META);
        if (!settingsIssues.valid) {
          return problem(422, "validation_failed", "Invalid settings", settingsIssues.issues[0]?.message, {
            errors: settingsIssues.fieldErrors,
          });
        }
      }
      try {
        endpoints.push(normalizeEndpointInput(input, input.method));
      } catch (error) {
        return problem(422, "sample_invalid", "Invalid sample", error instanceof Error ? error.message : undefined);
      }
    }

    const slug = makeSlug();
    const timestamp = new Date().toISOString();
    const project: MockProject = {
      slug,
      name: body.name?.trim() || null,
      baseUrl: projectBase(slug),
      editToken: makeEditToken(),
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endpoints,
      logs: [],
      usage: { requestsToday: 0, dailyLimit: 10_000, resetsAt: new Date(Date.now() + 86_400_000).toISOString() },
    };
    putProject(project);

    return HttpResponse.json(
      {
        slug: project.slug,
        name: project.name,
        baseUrl: project.baseUrl,
        editToken: project.editToken,
        expiresAt: project.expiresAt,
        endpoints: project.endpoints.map((endpoint) => ({
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
          url: `${project.baseUrl}${endpoint.path}`,
        })),
        quota: project.usage,
      },
      { status: 201, headers: CORS },
    );
  }),

  http.get(`${API}/projects`, async () => {
    await latency(40);
    return HttpResponse.json(
      { items: listProjects().map((project) => ({ slug: project.slug, name: project.name, expiresAt: project.expiresAt })) },
      { headers: CORS },
    );
  }),

  http.get(`${API}/projects/:slug`, async ({ request, params }) => {
    await latency(50);
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    return HttpResponse.json(toProjectResponse(auth), { headers: CORS });
  }),

  http.patch(`${API}/projects/:slug`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const body = await readJson<{ name?: string }>(request);
    if (body.name !== undefined) {
      if ([...body.name].length > MOCK_META_LIMITS.maxProjectNameLength) {
        return problem(400, "validation_failed", "Name too long", "Shorten the project name.");
      }
      auth.name = body.name.trim() || null;
      auth.updatedAt = new Date().toISOString();
      putProject(auth);
    }
    return HttpResponse.json(toProjectResponse(auth), { headers: CORS });
  }),

  http.delete(`${API}/projects/:slug`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    deleteProject(auth.slug);
    return new HttpResponse(null, { status: 204, headers: CORS });
  }),

  /* ---------------------------------------------------------------- */
  /* Endpoints                                                        */
  /* ---------------------------------------------------------------- */

  http.post(`${API}/projects/:slug/endpoints`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    if (auth.endpoints.length >= MOCK_META_LIMITS.maxEndpointsPerProject) {
      return problem(422, "endpoint_limit_reached", "Endpoint limit reached", "Delete an endpoint first.");
    }
    const body = await readJson<CreateEndpointRequest>(request);
    const key = `${body.method} ${normalizePathForComparison(body.path)}`;
    if (auth.endpoints.some((endpoint) => `${endpoint.method} ${normalizePathForComparison(endpoint.path)}` === key)) {
      return problem(409, "duplicate_endpoint", "Duplicate endpoint", "Another endpoint uses the same method and path.");
    }
    try {
      const created = normalizeEndpointInput(body, body.method);
      auth.endpoints = [...auth.endpoints, created];
      auth.updatedAt = new Date().toISOString();
      putProject(auth);
      return HttpResponse.json(
        {
          ...created,
          url: `${auth.baseUrl}${created.path}`,
        },
        { status: 201, headers: CORS },
      );
    } catch (error) {
      return problem(422, "validation_failed", "Invalid endpoint", error instanceof Error ? error.message : undefined);
    }
  }),

  http.get(`${API}/projects/:slug/endpoints/:id`, async ({ request, params }) => {
    await latency(40);
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const endpoint = auth.endpoints.find((entry) => entry.id === String(params.id));
    if (!endpoint) return problem(404, "endpoint_not_found", "Endpoint not found");
    return HttpResponse.json({ ...endpoint, url: `${auth.baseUrl}${endpoint.path}` }, { headers: CORS });
  }),

  http.put(`${API}/projects/:slug/endpoints/:id`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const index = auth.endpoints.findIndex((entry) => entry.id === String(params.id));
    if (index === -1) return problem(404, "endpoint_not_found", "Endpoint not found");
    const body = await readJson<Partial<MockEndpoint>>(request);
    const current = auth.endpoints[index] as MockEndpoint;
    const patch = body.schema || body.settings || body.method || body.path;
    const next: MockEndpoint = {
      ...current,
      ...(body.method ? { method: body.method } : {}),
      ...(body.path ? { path: body.path } : {}),
      ...(body.schema ? { schema: body.schema } : {}),
      ...(body.settings ? { settings: body.settings } : {}),
      updatedAt: new Date().toISOString(),
    };
    auth.endpoints[index] = patch ? next : current;
    putProject(auth);
    return HttpResponse.json({ ...auth.endpoints[index], url: `${auth.baseUrl}${auth.endpoints[index]?.path}` }, { headers: CORS });
  }),

  http.put(`${API}/projects/:slug/endpoints/:id/schema`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const endpoint = auth.endpoints.find((entry) => entry.id === String(params.id));
    if (!endpoint) return problem(404, "endpoint_not_found", "Endpoint not found");
    const schema = await readJson<Schema>(request);
    const issues = validateSchemaShape(schema, META);
    if (!issues.valid) {
      return problem(422, "validation_failed", "Invalid schema", issues.issues[0]?.message, {
        errors: { schema: issues.issues.map((issue) => issue.message) },
      });
    }
    endpoint.schema = schema;
    endpoint.updatedAt = new Date().toISOString();
    putProject(auth);
    return HttpResponse.json({ ...endpoint, url: `${auth.baseUrl}${endpoint.path}` }, { headers: CORS });
  }),

  http.put(`${API}/projects/:slug/endpoints/:id/settings`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const endpoint = auth.endpoints.find((entry) => entry.id === String(params.id));
    if (!endpoint) return problem(404, "endpoint_not_found", "Endpoint not found");
    const settings = await readJson<EndpointSettings>(request);
    const issues = validateEndpointSettings(settings, META);
    if (!issues.valid) {
      return problem(422, "validation_failed", "Invalid settings", issues.issues[0]?.message, {
        errors: issues.fieldErrors,
      });
    }
    endpoint.settings = settings;
    endpoint.updatedAt = new Date().toISOString();
    putProject(auth);
    return HttpResponse.json({ ...endpoint, url: `${auth.baseUrl}${endpoint.path}` }, { headers: CORS });
  }),

  http.delete(`${API}/projects/:slug/endpoints/:id`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const before = auth.endpoints.length;
    auth.endpoints = auth.endpoints.filter((entry) => entry.id !== String(params.id));
    if (auth.endpoints.length === before) return problem(404, "endpoint_not_found", "Endpoint not found");
    putProject(auth);
    return new HttpResponse(null, { status: 204, headers: CORS });
  }),

  /* ---------------------------------------------------------------- */
  /* Logs                                                             */
  /* ---------------------------------------------------------------- */

  http.get(`${API}/projects/:slug/logs`, async ({ request, params }) => {
    await latency(60);
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50) || 50));
    const before = url.searchParams.get("before");
    const after = url.searchParams.get("after");
    const endpointId = url.searchParams.get("endpointId");
    const status = url.searchParams.get("status");
    const injected = url.searchParams.get("injected");

    let items = [...auth.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (after) {
      const index = items.findIndex((item) => item.id === after);
      items = index === -1 ? items : items.slice(0, index);
    }
    if (before) {
      const index = items.findIndex((item) => item.id === before);
      if (index !== -1) items = items.slice(index + 1);
    }
    if (endpointId) items = items.filter((item) => item.endpointId === endpointId);
    if (status) items = items.filter((item) => item.status === Number(status));
    if (injected === "true") items = items.filter((item) => item.injected);
    if (injected === "false") items = items.filter((item) => !item.injected);

    const page = items.slice(0, limit);
    const response: LogsResponse = {
      items: page,
      nextCursor: items.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
    return HttpResponse.json(response, { headers: CORS });
  }),

  http.delete(`${API}/projects/:slug/logs`, async ({ request, params }) => {
    await latency();
    const auth = requiresProject(request, String(params.slug));
    if (isResponse(auth)) return auth;
    auth.logs = [];
    putProject(auth);
    return new HttpResponse(null, { status: 204, headers: CORS });
  }),

  /* ---------------------------------------------------------------- */
  /* Mock runtime                                                     */
  /* ---------------------------------------------------------------- */

  http.all(`${MOCK}/:slug`, async ({ request, params }) => {
    return handleRuntime(request, String(params.slug), "/");
  }),

  http.all(`${MOCK}/:slug/*`, async ({ request, params }) => {
    const url = new URL(request.url);
    const slug = String(params.slug);
    const basePath = new URL(MOCK).pathname.replace(/\/+$/, "");
    const prefix = `${basePath}/${slug}`;
    const path = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length) || "/"
      : "/";
    return handleRuntime(request, slug, path);
  }),

  /* ---------------------------------------------------------------- */
  /* Test / demo reset                                                */
  /* ---------------------------------------------------------------- */

  http.post(`${API}/__mock/reset`, async () => {
    resetMockData();
    return HttpResponse.json({ ok: true, demoSlug: DEMO_SLUG }, { headers: CORS });
  }),
];

function matchesTemplate(template: string, path: string): Record<string, string> | null {
  if (!template.includes("{")) {
    return template === path ? {} : null;
  }
  const names: string[] = [];
  const pattern = template
    .split("/")
    .map((segment) => {
      const match = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(segment);
      if (match?.[1]) {
        names.push(match[1]);
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  const result = new RegExp(`^${pattern}/?$`).exec(path);
  if (!result) return null;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(result[index + 1] ?? "")]));
}

async function handleRuntime(request: Request, slug: string, path: string) {
  const started = Date.now();
  const project = getProjectBySlug(slug);
  const method = request.method.toUpperCase() as HttpMethod;
  const url = new URL(request.url);

  if (!project) {
    return runtimeError(404, "project_not_found", "The project does not exist.");
  }
  if (new Date(project.expiresAt).getTime() < Date.now()) {
    return runtimeError(410, "project_expired", "The project has expired.");
  }

  const route = project.endpoints.find((endpoint) => {
    if (endpoint.method !== method) return false;
    return matchesTemplate(endpoint.path, path) !== null;
  });

  const requestBody = method === "GET" || method === "DELETE" ? null : await safeJson(request);
  const id = nextLogId(project);

  if (!route) {
    const log: ProjectLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      method,
      path,
      status: 404,
      endpointId: null,
      endpointPath: null,
      injected: false,
      injectedError: null,
      delayMs: 0,
      latencyMs: Date.now() - started,
      requestId: id,
      requestBody: requestBody as JsonValue | string | null,
      query: url.search || null,
      userAgent: request.headers.get("user-agent"),
      byteSize: 0,
    };
    appendLog(project, log);
    return runtimeError(404, "endpoint_not_found", `No ${method} endpoint at ${path}.`);
  }

  const settings = route.settings;
  const delayMs =
    settings.delay.minMs +
    Math.floor(Math.random() * Math.max(1, settings.delay.maxMs - settings.delay.minMs + 1));
  // Keep the mock usable in tests: honour the configured delay up to 1.5 s.
  await delay(Math.min(delayMs, 1_500));

  const injected = settings.errorInjection.rate > 0 && Math.random() < settings.errorInjection.rate;
  const status = injected
    ? settings.errorInjection.codes[
        Math.floor(Math.random() * settings.errorInjection.codes.length)
      ] ?? 500
    : settings.successStatus;

  const generated = injected ? null : generatePreview(route.schema, settings);
  const body = generated?.body ?? {
    error: {
      status,
      code: "injected_error",
      title: "Injected error",
      message: "This response was generated by the configured error injection.",
      injected: true,
      requestId: id,
    },
  };

  const log: ProjectLogEntry = {
    id,
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    endpointId: route.id,
    endpointPath: route.path,
    injected,
    injectedError: injected ? "injected_error" : null,
    delayMs,
    latencyMs: Date.now() - started,
    requestId: id,
    requestBody: requestBody as JsonValue | string | null,
    query: url.search || null,
    userAgent: request.headers.get("user-agent"),
    byteSize: new TextEncoder().encode(JSON.stringify(body)).length,
  };
  appendLog(project, log);

  return HttpResponse.json(body, {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Request-Id": id,
      "X-Mock-Delay-Ms": String(delayMs),
      ...(injected ? { "X-Mock-Injected-Error": "injected_error" } : {}),
      ...(settings.pagination
        ? {
            "X-Total-Count": String(settings.pagination.totalItems),
            "X-Page": url.searchParams.get("page") ?? "1",
            "X-Limit": url.searchParams.get("limit") ?? String(settings.pagination.defaultLimit),
          }
        : {}),
    },
  });
}

async function safeJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
