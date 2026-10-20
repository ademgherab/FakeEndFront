/**
 * Local development backend (not a sprint deliverable).
 *
 * The builder talks to the real management API. This script answers the
 * whole `frontend-integration.md` contract — health, meta, infer, preview,
 * project and endpoint CRUD, request logs and the mock runtime under
 * `/m/:slug/*` — so the frontend can be run and demoed without the real
 * backend.
 *
 *   node scripts/dev-backend.mjs        # http://localhost:5031
 *
 * It has no dependencies and keeps everything in memory: restarting it loses
 * the projects.
 */
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 5031);
const HOST = process.env.HOST ?? "127.0.0.1";
const API = "/api/v1";
const PROJECT_LIFETIME_DAYS = 7;

const EXPOSED_HEADERS = [
  "X-Request-Id",
  "X-Mock-Delay-Ms",
  "X-Mock-Injected-Error",
  "X-Total-Count",
  "X-Page",
  "X-Limit",
  "X-Total-Pages",
  "Link",
  "Retry-After",
  "Allow",
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type,Accept,Authorization",
  "access-control-expose-headers": EXPOSED_HEADERS.join(","),
  "access-control-max-age": "86400",
};

const LIMITS = {
  maxEndpointsPerProject: 10,
  maxSampleBytes: 102_400,
  maxRequestBodyBytes: 262_144,
  maxPathLength: 200,
  maxDelayMs: 10_000,
  maxListSize: 1_000,
  maxPaginationTotalItems: 10_000,
  maxPaginationLimit: 100,
  maxErrorStatusCodes: 10,
  dailyRequestsPerProject: 5_000,
  maxLogEntriesPerProject: 1_000,
};

const META = {
  mockBaseUrl: `http://${HOST}:${PORT}/m`,
  projectLifetimeDays: PROJECT_LIFETIME_DAYS,
  methods: ["GET", "POST", "PUT", "DELETE"],
  successStatuses: [200, 201, 202, 204],
  errorStatusRange: { min: 400, max: 599 },
  limits: LIMITS,
  generators: [
    {
      name: "randomInt",
      nodeTypes: ["integer"],
      params: [
        { name: "min", type: "integer", required: true },
        { name: "max", type: "integer", required: true },
      ],
    },
  ],
};

const DEFAULT_SETTINGS = {
  successStatus: 200,
  delay: { minMs: 0, maxMs: 0 },
  errors: { ratePercent: 0, statusCodes: [500] },
  list: { path: null, size: { min: 10, max: 10 } },
  pagination: {
    enabled: false,
    totalItems: 100,
    defaultLimit: 10,
    maxLimit: 100,
    bindings: {
      page: null,
      limit: null,
      total: null,
      totalPages: null,
      hasNext: null,
      hasPrev: null,
    },
  },
  seed: null,
};

const projects = new Map();
const logs = new Map();
let logCounter = 0;

const newToken = () => `et_${randomBytes(32).toString("base64url")}`;
const newSlug = () => randomBytes(6).toString("base64url");
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Schema inference                                                    */
/* ------------------------------------------------------------------ */

function leafFor(value) {
  if (typeof value === "boolean") return { type: "boolean", generator: { name: "boolean" } };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { type: "integer", generator: { name: "integer" } }
      : { type: "number", generator: { name: "number" } };
  }
  if (value === null) return { type: "null", generator: { name: "null" } };
  return { type: "string", generator: { name: "string" } };
}

function inferNode(value) {
  if (Array.isArray(value)) {
    const item =
      value.length > 0
        ? inferNode(value[0])
        : { type: "string", generator: { name: "string" } };
    return { type: "array", item, length: { min: 1, max: Math.max(1, value.length) } };
  }
  if (value && typeof value === "object") {
    return {
      type: "object",
      fields: Object.entries(value).map(([name, entry]) => ({
        name,
        node: inferNode(entry),
      })),
    };
  }
  return leafFor(value);
}

/** The runtime renders a schema; this is a small, readable generator. */
function generate(node, random) {
  if (!node) return null;
  switch (node.type) {
    case "object":
      return Object.fromEntries(
        (node.fields ?? []).map((field) => [field.name, generate(field.node, random)]),
      );
    case "array": {
      const count = node.length?.min ?? 1;
      return Array.from({ length: count }, () => generate(node.item, random));
    }
    case "integer":
      return Math.floor(random() * 1000);
    case "number":
      return Math.round(random() * 10000) / 100;
    case "boolean":
      return random() > 0.5;
    case "null":
      return null;
    default:
      return `value-${Math.floor(random() * 10000)}`;
  }
}

function pointerSegments(pointer) {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return null;
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function readPointer(root, pointer) {
  const segments = pointerSegments(pointer);
  if (segments === null) return undefined;
  let current = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = Array.isArray(current)
      ? current[Number(segment)]
      : current[segment];
  }
  return current;
}

function writePointer(root, pointer, value) {
  const segments = pointerSegments(pointer);
  if (segments === null || segments.length === 0) return;
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    if (current === null || typeof current !== "object") return;
    current = Array.isArray(current)
      ? current[Number(segment)]
      : current[segment];
    if (current === null || typeof current !== "object") return;
  }
  const last = segments[segments.length - 1];
  if (Array.isArray(current)) {
    current[Number(last)] = value;
  } else {
    current[last] = value;
  }
}

function mergeSettings(settings, method) {
  const base = structuredClone(DEFAULT_SETTINGS);
  const merged = { ...base, ...(settings ?? {}) };
  merged.delay = { ...base.delay, ...(settings?.delay ?? {}) };
  merged.errors = { ...base.errors, ...(settings?.errors ?? {}) };
  merged.list = {
    ...base.list,
    ...(settings?.list ?? {}),
    size: { ...base.list.size, ...(settings?.list?.size ?? {}) },
  };
  merged.pagination = {
    ...base.pagination,
    ...(settings?.pagination ?? {}),
    bindings: { ...base.pagination.bindings, ...(settings?.pagination?.bindings ?? {}) },
  };
  if (merged.successStatus === undefined) {
    merged.successStatus =
      method === "POST" ? 201 : method === "DELETE" ? 204 : 200;
  }
  return merged;
}

/** Builds the response payload for an endpoint. */
function render(schema, settings, random, query) {
  const root = schema?.root ?? { type: "object", fields: [] };
  const listPath = settings?.list?.path ?? null;
  const size = settings?.list?.size ?? { min: 10, max: 10 };

  let data;
  if (root.type === "array") {
    const count = Math.max(0, Math.min(LIMITS.maxListSize, size.min));
    data = Array.from({ length: count }, () => generate(root.item, random));
  } else {
    data = generate(root, random);
  }

  const pagination = settings?.pagination ?? {};
  if (pagination.enabled) {
    const totalItems = Math.max(
      0,
      Math.min(LIMITS.maxPaginationTotalItems, pagination.totalItems ?? 100),
    );
    const maxLimit = Math.max(1, pagination.maxLimit ?? 100);
    const defaultLimit = Math.max(1, pagination.defaultLimit ?? 10);
    const requested = Number(query?.get("limit") ?? defaultLimit);
    const limit = Math.min(
      maxLimit,
      Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : defaultLimit,
    );
    const requestedPage = Number(query?.get("page") ?? 1);
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;

    const template =
      root.type === "array"
        ? root.item
        : (readPointer(data, listPath ?? "")?.item ?? null);
    const items = Array.from({ length: totalItems }, () => generate(template, random));
    const slice = items.slice((page - 1) * limit, page * limit);

    const container = listPath ? { ...data } : [];
    if (listPath) {
      writePointer(container, listPath, slice);
    }
    data = container;

    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 0;
    const bindings = pagination.bindings ?? {};
    const values = {
      page,
      limit,
      total: totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
    for (const [name, pointer] of Object.entries(bindings)) {
      if (!pointer) continue;
      writePointer(data, pointer, values[name]);
    }

    return { data, pagination: { page, limit, totalItems, totalPages } };
  }

  return { data, pagination: null };
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function send(res, status, body, headers = {}) {
  if (body === undefined) {
    res.writeHead(status, { ...CORS, ...headers });
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...headers,
  });
  res.end(payload);
}

/**
 * The origin the caller used. A real deployment answers with its public URL;
 * echoing the request host keeps the stand-in usable from `localhost` and
 * from `127.0.0.1` alike.
 */
function publicOrigin(req) {
  const forwarded = req.headers["x-forwarded-host"];
  const host =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded) ??
    req.headers.host ??
    `${HOST}:${PORT}`;
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  return `${protocol}://${host}`;
}

function problem(res, status, code, title, detail, errors, headers = {}) {
  send(
    res,
    status,
    {
      type: `https://fakeend.local/problems/${code}`,
      status,
      code,
      title,
      detail,
      traceId: randomUUID(),
      ...(errors ? { errors } : {}),
    },
    { "content-type": "application/problem+json; charset=utf-8", ...headers },
  );
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function bearer(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * The error order from the contract: unknown project, missing token, wrong
 * token, expired project.
 */
function authorize(req, res, slug) {
  const project = projects.get(slug);
  if (!project) {
    problem(res, 404, "project_not_found", "Project not found", "This project does not exist.");
    return null;
  }
  const token = bearer(req);
  if (!token) {
    problem(
      res,
      401,
      "missing_token",
      "Missing token",
      "An edit token is required for this route.",
      undefined,
      { "www-authenticate": "Bearer" },
    );
    return null;
  }
  if (token !== project.editToken) {
    problem(
      res,
      403,
      "invalid_token",
      "Invalid token",
      "The edit token does not match this project.",
    );
    return null;
  }
  if (Date.parse(project.expiresAt) <= Date.now()) {
    problem(
      res,
      410,
      "project_expired",
      "Project expired",
      "This project has expired and can no longer be edited.",
    );
    return null;
  }
  return project;
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

function recordLog(slug, entry) {
  logCounter += 1;
  const list = logs.get(slug) ?? [];
  list.push({ id: logCounter, ...entry });
  logs.set(slug, list);
  if (list.length > LIMITS.maxLogEntriesPerProject) list.shift();
  return logCounter;
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    console.error("[dev-backend]", error);
    if (!res.headersSent) {
      problem(res, 500, "internal_error", "Internal error", "The stand-in backend failed.");
    } else {
      res.end();
    }
  }
});

async function handle(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  /* ---------------------------- health ---------------------------- */

  if (pathname === "/health/live" && req.method === "GET") {
    send(res, 200, { status: "Healthy", checks: [{ name: "self", status: "Healthy" }] });
    return;
  }
  if (pathname === "/health/ready" && req.method === "GET") {
    send(res, 200, {
      status: "Healthy",
      checks: [{ name: "self", status: "Healthy" }, { name: "postgresql", status: "Healthy" }],
    });
    return;
  }

  /* ----------------------------- meta ----------------------------- */

  if (pathname === `${API}/meta` && req.method === "GET") {
    send(res, 200, META, { "cache-control": "public, max-age=300" });
    return;
  }

  /* ---------------------------- infer ----------------------------- */

  if (pathname === `${API}/infer` && req.method === "POST") {
    const body = await readJson(req);
    if (body === null) {
      problem(res, 400, "validation_failed", "Invalid JSON", "The request body is not valid JSON.");
      return;
    }
    const sample = body?.sample;
    if (sample === undefined || sample === null || typeof sample !== "object") {
      problem(
        res,
        422,
        "sample_invalid",
        "Invalid sample",
        "The sample must be a JSON object or an array.",
      );
      return;
    }
    const root = inferNode(sample);
    const wrapInList = body?.options?.wrapInList === true;
    const schemaRoot =
      wrapInList && root.type !== "array"
        ? { type: "array", item: root, length: { min: 1, max: 1 } }
        : root;
    send(res, 200, {
      schema: { version: 1, root: schemaRoot },
      warnings: [],
      suggestions: {
        list: { path: null },
        pagination: {
          bindings: {
            page: null,
            limit: null,
            total: null,
            totalPages: null,
            hasNext: null,
            hasPrev: null,
          },
        },
      },
    });
    return;
  }

  /* ---------------------------- preview --------------------------- */

  if (pathname === `${API}/preview` && req.method === "POST") {
    const body = await readJson(req);
    if (!body?.schema) {
      problem(res, 400, "validation_failed", "Invalid preview", "A schema is required.");
      return;
    }
    const settings = mergeSettings(body.settings, "GET");
    const page = body.page ? Number(body.page) : 1;
    const limit = body.limit ? Number(body.limit) : 10;
    const result = render(body.schema, settings, Math.random, {
      get: (key) => (key === "page" ? String(page) : key === "limit" ? String(limit) : null),
    });
    const headers = {};
    if (result.pagination) {
      headers["x-total-count"] = String(result.pagination.totalItems);
      headers["x-page"] = String(result.pagination.page);
      headers["x-limit"] = String(result.pagination.limit);
      headers["x-total-pages"] = String(result.pagination.totalPages);
      const link = (target) => `<${publicOrigin(req)}${API}/preview?page=${target}&limit=${result.pagination.limit}>`;
      headers["link"] = [
        `${link(1)}; rel="first"`,
        `${link(Math.max(1, result.pagination.page - 1))}; rel="prev"`,
        `${link(result.pagination.page + 1)}; rel="next"`,
        `${link(result.pagination.totalPages || 1)}; rel="last"`,
      ].join(", ");
    }
    send(res, 200, result, headers);
    return;
  }

  /* --------------------------- projects --------------------------- */

  if (pathname === `${API}/projects` && req.method === "POST") {
    const body = await readJson(req);
    const endpoints = Array.isArray(body?.endpoints) ? body.endpoints : [];
    if (endpoints.length === 0) {
      problem(res, 400, "validation_failed", "No endpoints", "A project needs at least one endpoint.");
      return;
    }
    if (endpoints.length > LIMITS.maxEndpointsPerProject) {
      problem(
        res,
        422,
        "endpoint_limit_reached",
        "Too many endpoints",
        `A project holds at most ${LIMITS.maxEndpointsPerProject} endpoints.`,
      );
      return;
    }
    const seen = new Set();
    for (const endpoint of endpoints) {
      const key = `${endpoint.method} ${endpoint.path}`;
      if (seen.has(key)) {
        problem(res, 409, "duplicate_endpoint", "Duplicate endpoint", `The endpoint ${key} is listed twice.`);
        return;
      }
      seen.add(key);
      if (endpoint.sample !== undefined && endpoint.schema !== undefined) {
        problem(
          res,
          400,
          "validation_failed",
          "Ambiguous endpoint",
          "Send either a sample or a schema, never both.",
        );
        return;
      }
    }

    const slug = newSlug();
    const baseUrl = `${publicOrigin(req)}/m/${slug}`;
    const created = new Date();
    const expiresAt = new Date(created.getTime() + PROJECT_LIFETIME_DAYS * 86_400_000);
    const built = endpoints.map((endpoint) => {
      const schema =
        endpoint.schema ??
        inferNode(endpoint.sample ?? { id: 1 });
      return {
        id: randomUUID(),
        method: endpoint.method ?? "GET",
        path: endpoint.path ?? "/",
        url: `${baseUrl}${endpoint.path ?? "/"}`,
        schema,
        settings: mergeSettings(endpoint.settings, endpoint.method ?? "GET"),
        createdAt: created.toISOString(),
        updatedAt: created.toISOString(),
      };
    });
    const project = {
      slug,
      editToken: newToken(),
      name: body?.name ?? null,
      createdAt: created.toISOString(),
      expiresAt: expiresAt.toISOString(),
      baseUrl,
      endpoints: built,
    };
    projects.set(slug, project);
    send(res, 201, project, { location: `${API}/projects/${slug}` });
    return;
  }

  const projectMatch = pathname.match(
    new RegExp(`^${API}/projects/([^/]+)(/.*)?$`),
  );
  if (projectMatch) {
    const slug = decodeURIComponent(projectMatch[1]);
    const rest = projectMatch[2] ?? "";

    if (rest === "") {
      const project = authorize(req, res, slug);
      if (!project) return;

      if (req.method === "GET") {
        send(res, 200, {
          slug: project.slug,
          name: project.name,
          createdAt: project.createdAt,
          expiresAt: project.expiresAt,
          baseUrl: project.baseUrl,
          usage: { requestsToday: 0, dailyLimit: LIMITS.dailyRequestsPerProject },
          endpoints: project.endpoints,
        });
        return;
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        if (body === null || typeof body !== "object" || !("name" in body)) {
          problem(res, 400, "validation_failed", "Invalid body", "A name or null is required.");
          return;
        }
        project.name = body.name === null ? null : String(body.name).slice(0, 60);
        send(res, 200, {
          slug: project.slug,
          name: project.name,
          createdAt: project.createdAt,
          expiresAt: project.expiresAt,
          baseUrl: project.baseUrl,
          usage: { requestsToday: 0, dailyLimit: LIMITS.dailyRequestsPerProject },
          endpoints: project.endpoints,
        });
        return;
      }
      if (req.method === "DELETE") {
        projects.delete(slug);
        logs.delete(slug);
        send(res, 204, undefined);
        return;
      }
      problem(res, 405, "method_not_allowed", "Method not allowed", `${req.method} is not allowed here.`);
      return;
    }

    /* ---------------------------- logs ---------------------------- */

    if (rest === "/logs") {
      const project = authorize(req, res, slug);
      if (!project) return;

      if (req.method === "GET") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const before = url.searchParams.get("before");
        const after = url.searchParams.get("after");
        if (before && after) {
          problem(res, 400, "validation_failed", "Ambiguous cursor", "Use either before or after, not both.");
          return;
        }
        const endpointId = url.searchParams.get("endpointId");
        const status = url.searchParams.get("status");
        const injected = url.searchParams.get("injected");

        let items = [...(logs.get(slug) ?? [])].reverse();
        if (before) items = items.filter((entry) => entry.id < Number(before));
        if (after) items = items.filter((entry) => entry.id > Number(after));
        if (endpointId) items = items.filter((entry) => entry.endpointId === endpointId);
        if (status) items = items.filter((entry) => entry.status === Number(status));
        if (injected === "true") items = items.filter((entry) => entry.injectedError);
        if (injected === "false") items = items.filter((entry) => !entry.injectedError);

        const page = items.slice(0, limit);
        const all = logs.get(slug) ?? [];
        send(res, 200, {
          items: page,
          nextCursor: items.length > limit ? page[page.length - 1].id : null,
          latestId: all.length > 0 ? all[all.length - 1].id : null,
        });
        return;
      }
      if (req.method === "DELETE") {
        logs.delete(slug);
        send(res, 204, undefined);
        return;
      }
      problem(res, 405, "method_not_allowed", "Method not allowed", `${req.method} is not allowed here.`);
      return;
    }

    /* -------------------------- endpoints ------------------------- */

    if (rest === "/endpoints") {
      const project = authorize(req, res, slug);
      if (!project) return;

      if (req.method === "POST") {
        if (project.endpoints.length >= LIMITS.maxEndpointsPerProject) {
          problem(
            res,
            422,
            "endpoint_limit_reached",
            "Too many endpoints",
            `A project holds at most ${LIMITS.maxEndpointsPerProject} endpoints.`,
          );
          return;
        }
        const body = await readJson(req);
        if (body?.sample !== undefined && body?.schema !== undefined) {
          problem(
            res,
            400,
            "validation_failed",
            "Ambiguous endpoint",
            "Send either a sample or a schema, never both.",
          );
          return;
        }
        const duplicate = project.endpoints.some(
          (entry) => entry.method === body?.method && entry.path === body?.path,
        );
        if (duplicate) {
          problem(res, 409, "duplicate_endpoint", "Duplicate endpoint", "This method and path already exist.");
          return;
        }
        const schema = body?.schema ?? inferNode(body?.sample ?? { id: 1 });
        const endpoint = {
          id: randomUUID(),
          method: body?.method ?? "GET",
          path: body?.path ?? "/",
          url: `${project.baseUrl}${body?.path ?? "/"}`,
          schema,
          settings: mergeSettings(body?.settings, body?.method ?? "GET"),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        project.endpoints.push(endpoint);
        send(res, 201, endpoint, {
          location: `${API}/projects/${slug}/endpoints/${endpoint.id}`,
        });
        return;
      }
      problem(res, 405, "method_not_allowed", "Method not allowed", `${req.method} is not allowed here.`);
      return;
    }

    const endpointMatch = rest.match(/^\/endpoints\/([^/]+)(\/schema|\/settings)?$/);
    if (endpointMatch) {
      const project = authorize(req, res, slug);
      if (!project) return;
      const endpointId = decodeURIComponent(endpointMatch[1]);
      const target = project.endpoints.find((entry) => entry.id === endpointId);
      if (!target) {
        problem(res, 404, "endpoint_not_found", "Endpoint not found", "This endpoint does not exist.");
        return;
      }
      const section = endpointMatch[2];

      if (req.method === "GET" && !section) {
        send(res, 200, target);
        return;
      }
      if (req.method === "PUT" && !section) {
        const body = await readJson(req);
        if (!body?.schema || !body?.settings) {
          problem(res, 400, "validation_failed", "Invalid body", "A schema and settings are required.");
          return;
        }
        const duplicate = project.endpoints.some(
          (entry) =>
            entry.id !== target.id &&
            entry.method === body.method &&
            entry.path === body.path,
        );
        if (duplicate) {
          problem(res, 409, "duplicate_endpoint", "Duplicate endpoint", "This method and path already exist.");
          return;
        }
        target.method = body.method ?? target.method;
        target.path = body.path ?? target.path;
        target.url = `${project.baseUrl}${target.path}`;
        target.schema = body.schema;
        target.settings = mergeSettings(body.settings, target.method);
        target.updatedAt = nowIso();
        send(res, 200, target);
        return;
      }
      if (req.method === "PUT" && section === "/schema") {
        const body = await readJson(req);
        if (!body?.root) {
          problem(res, 400, "validation_failed", "Invalid body", "A schema is required.");
          return;
        }
        target.schema = body;
        target.updatedAt = nowIso();
        send(res, 200, target);
        return;
      }
      if (req.method === "PUT" && section === "/settings") {
        const body = await readJson(req);
        if (!body || typeof body !== "object") {
          problem(res, 400, "validation_failed", "Invalid body", "A settings object is required.");
          return;
        }
        target.settings = mergeSettings(body, target.method);
        target.updatedAt = nowIso();
        send(res, 200, target);
        return;
      }
      if (req.method === "DELETE" && !section) {
        project.endpoints = project.endpoints.filter((entry) => entry.id !== endpointId);
        send(res, 204, undefined);
        return;
      }
      problem(res, 405, "method_not_allowed", "Method not allowed", `${req.method} is not allowed here.`);
      return;
    }
  }

  /* ---------------------------- runtime --------------------------- */

  const runtime = pathname.match(/^\/m\/([^/]+)(\/.*)?$/);
  if (runtime) {
    const slug = runtime[1];
    const project = projects.get(slug);
    if (!project) {
      problem(res, 404, "not_found", "Unknown project", "This project does not exist (or the server restarted).");
      return;
    }
    const requestPath = runtime[2] ?? "/";
    const endpoint =
      project.endpoints.find((entry) => {
        const template = entry.path
          .split("/")
          .map((segment) => (segment.startsWith("{") ? "[^/]+" : segment))
          .join("/");
        return new RegExp(`^${template}/?$`, "i").test(requestPath);
      }) ?? project.endpoints[0];
    const settings = endpoint?.settings ?? {};

    const delay = settings.delay ?? { minMs: 0, maxMs: 0 };
    const wait =
      delay.minMs + Math.random() * Math.max(0, delay.maxMs - delay.minMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    const requestId = randomUUID();
    const injected =
      (settings.errors?.ratePercent ?? 0) > 0 &&
      Math.random() < settings.errors.ratePercent / 100;
    const headers = {
      "x-request-id": requestId,
      "x-mock-delay-ms": String(Math.round(wait)),
      "x-mock-injected-error": String(injected),
    };

    if (injected) {
      const code = settings.errors?.statusCodes?.[0] ?? 500;
      const payload = JSON.stringify({
        error: {
          status: code,
          code: "injected_error",
          title: "Injected error",
          message: "This response was generated by the configured error injection.",
          injected: true,
          requestId,
        },
      });
      recordLog(slug, {
        requestId,
        endpointId: endpoint?.id ?? null,
        method: req.method,
        path: requestPath,
        query: url.search.replace(/^\?/, "") || null,
        status: code,
        injectedError: true,
        delayMs: Math.round(wait),
        latencyMs: Math.round(wait),
        requestContentType: req.headers["content-type"] ?? null,
        requestBody: null,
        userAgent: req.headers["user-agent"] ?? null,
        createdAt: nowIso(),
      });
      res.writeHead(code, {
        ...CORS,
        ...headers,
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload),
        "cache-control": "no-store",
        ...(code === 429 || code === 503 ? { "retry-after": "3" } : {}),
      });
      res.end(payload);
      return;
    }

    const result = render(endpoint?.schema, settings, Math.random, url.searchParams);
    const status = settings.successStatus ?? 200;
    const responseHeaders = { ...CORS, ...headers, "cache-control": "no-store" };

    if (result.pagination) {
      responseHeaders["x-total-count"] = String(result.pagination.totalItems);
      responseHeaders["x-page"] = String(result.pagination.page);
      responseHeaders["x-limit"] = String(result.pagination.limit);
      responseHeaders["x-total-pages"] = String(result.pagination.totalPages);
      const link = (target) =>
        `<${publicOrigin(req)}/m/${slug}${requestPath}?page=${target}&limit=${result.pagination.limit}>`;
      responseHeaders["link"] = [
        `${link(1)}; rel="first"`,
        `${link(Math.max(1, result.pagination.page - 1))}; rel="prev"`,
        `${link(result.pagination.page + 1)}; rel="next"`,
        `${link(result.pagination.totalPages || 1)}; rel="last"`,
      ].join(", ");
    }

    recordLog(slug, {
      requestId,
      endpointId: endpoint?.id ?? null,
      method: req.method,
      path: requestPath,
      query: url.search.replace(/^\?/, "") || null,
      status,
      injectedError: false,
      delayMs: Math.round(wait),
      latencyMs: Math.round(wait),
      requestContentType: req.headers["content-type"] ?? null,
      requestBody: null,
      userAgent: req.headers["user-agent"] ?? null,
      createdAt: nowIso(),
    });

    if (status === 204) {
      res.writeHead(204, responseHeaders);
      res.end();
      return;
    }
    const payload = JSON.stringify(result.data);
    res.writeHead(status, {
      ...responseHeaders,
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  problem(res, 404, "not_found", "Not found", `No route for ${req.method} ${pathname}.`);
}

server.listen(PORT, HOST, () => {
  console.log(`[dev-backend] listening on http://${HOST}:${PORT}${API}`);
});
