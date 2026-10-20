/**
 * Local development backend (not a sprint deliverable).
 *
 * The builder talks to a real management API. This script answers the four
 * endpoints the page uses — `/api/v1/meta`, `/api/v1/infer`, `/api/v1/preview`
 * and `/api/v1/projects` — plus the runtime under `/m/:slug/*`, so the app can
 * be run and demoed without the real backend.
 *
 *   node scripts/dev-backend.mjs        # http://localhost:5031
 *
 * It has no dependencies and keeps everything in memory: restarting it loses
 * the projects.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 5031);
const HOST = process.env.HOST ?? "127.0.0.1";
const API = "/api/v1";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type,Accept,Authorization",
  // The runtime headers are only readable from JavaScript when they are
  // exposed explicitly (see frontend-spec.md §11).
  "access-control-expose-headers":
    "X-Request-Id,X-Mock-Delay-Ms,X-Mock-Injected-Error,Retry-After",
};

const LIMITS = {
  maxDelayMs: 10_000,
  maxListSize: 1_000,
  maxErrorCodes: 10,
  maxPathLength: 200,
};

const META = {
  successStatuses: [200, 201, 202, 204],
  limits: LIMITS,
  errorRange: { min: 400, max: 599 },
};

const projects = new Map();

let counter = 0;
const nextId = (prefix) => `${prefix}_${(counter += 1).toString(36)}${Date.now().toString(36)}`;

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
    const item = value.length > 0 ? inferNode(value[0]) : { type: "string", generator: { name: "string" } };
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

function render(schema, settings, random) {
  const root = schema?.root ?? { type: "object", fields: [] };
  const size = settings?.list?.size;
  if (root.type === "array" && size) {
    const count = Math.max(0, Math.min(LIMITS.maxListSize, size.min));
    return Array.from({ length: count }, () => generate(root.item, random));
  }
  return generate(root, random);
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
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

function problem(res, status, code, title, detail) {
  send(res, status, {
    type: `https://fakeend.local/problems/${code}`,
    status,
    code,
    title,
    detail,
  });
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
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (url.pathname === `${API}/meta` && req.method === "GET") {
    send(res, 200, META);
    return;
  }

  if (url.pathname === `${API}/infer` && req.method === "POST") {
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
        "validation_failed",
        "Invalid sample",
        "The sample must be a JSON object or an array of objects.",
      );
      return;
    }
    const root = inferNode(sample);
    const rootIsArray = root.type === "array";
    send(res, 200, {
      schema: { version: 1, root },
      warnings: [],
      suggestions: rootIsArray ? { list: { path: null } } : {},
    });
    return;
  }

  if (url.pathname === `${API}/preview` && req.method === "POST") {
    const body = await readJson(req);
    if (!body?.schema) {
      problem(res, 422, "validation_failed", "Invalid preview", "A schema is required.");
      return;
    }
    send(res, 200, {
      data: render(body.schema, body.settings, Math.random),
      pagination: null,
    });
    return;
  }

  if (url.pathname === `${API}/projects` && req.method === "POST") {
    const body = await readJson(req);
    const endpoints = Array.isArray(body?.endpoints) ? body.endpoints : [];
    if (endpoints.length === 0) {
      problem(res, 422, "validation_failed", "No endpoints", "A project needs at least one endpoint.");
      return;
    }
    const slug = nextId("p");
    const baseUrl = `${publicOrigin(req)}/m/${slug}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const created = endpoints.map((endpoint) => ({
      id: nextId("ep"),
      method: endpoint.method ?? "GET",
      path: endpoint.path ?? "/",
      url: `${baseUrl}${endpoint.path ?? "/"}`,
      schema: endpoint.schema ?? { version: 1, root: { type: "object", fields: [] } },
      settings: endpoint.settings ?? {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }));
    const project = {
      slug,
      editToken: nextId("et"),
      name: body?.name ?? null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      baseUrl,
      endpoints: created,
    };
    projects.set(slug, project);
    send(res, 201, project);
    return;
  }

  // Runtime: /m/:slug/<path>
  const runtime = url.pathname.match(/^\/m\/([^/]+)(\/.*)?$/);
  if (runtime) {
    const project = projects.get(runtime[1]);
    if (!project) {
      problem(res, 404, "not_found", "Unknown project", "This project does not exist (or the server restarted).");
      return;
    }
    const endpoint = project.endpoints[0];
    const settings = endpoint?.settings ?? {};
    const delay = settings.delay ?? { minMs: 0, maxMs: 0 };
    const wait = delay.minMs + Math.random() * Math.max(0, delay.maxMs - delay.minMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    const requestId = nextId("req");
    const injected = (settings.errors?.ratePercent ?? 0) > 0 && Math.random() < settings.errors.ratePercent / 100;
    const headers = {
      ...CORS,
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
      res.writeHead(code, {
        ...headers,
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload),
      });
      res.end(payload);
      return;
    }

    const body = JSON.stringify(render(endpoint?.schema, settings, Math.random));
    res.writeHead(settings.successStatus ?? 200, {
      ...headers,
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  problem(res, 404, "not_found", "Not found", `No route for ${req.method} ${url.pathname}.`);
});

server.listen(PORT, HOST, () => {
  console.log(`[dev-backend] listening on http://${HOST}:${PORT}${API}`);
});
