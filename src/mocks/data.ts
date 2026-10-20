import type {
  EndpointSettings,
  HttpMethod,
  ProjectLogEntry,
  ProjectResponse,
  Schema,
} from "@/lib/api/generated/schema";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { DEMO_EDIT_TOKEN, DEMO_SAMPLE, DEMO_SLUG } from "@/content/demo";

export { DEMO_EDIT_TOKEN, DEMO_SAMPLE, DEMO_SLUG };

export interface MockEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  schema: Schema;
  settings: EndpointSettings;
  options: { wrapInList: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface MockProject {
  slug: string;
  name: string | null;
  baseUrl: string;
  editToken: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  endpoints: MockEndpoint[];
  logs: ProjectLogEntry[];
  usage: { requestsToday: number; dailyLimit: number; resetsAt: string };
}

export const MOCK_META_LIMITS = {
  maxSampleBytes: 102_400,
  maxProjectNameLength: 60,
  maxEndpointsPerProject: 10,
  maxSchemaDepth: 10,
  maxSchemaNodes: 2_000,
  maxListSize: 1_000,
  maxDelayMs: 10_000,
  maxErrorCodes: 10,
  maxLogEntries: 1_000,
  maxRequestBodyBytes: 262_144,
} as const;


const DEMO_SCHEMA: Schema = {
  version: 1,
  root: {
    name: "root",
    type: "object",
    fields: [
      { name: "id", type: "integer", generator: "integer.sequence" },
      { name: "name", type: "string", generator: "string.firstName" },
      { name: "email", type: "string", generator: "string.email" },
      { name: "role", type: "string", enumValues: ["admin", "editor", "viewer"] },
      { name: "active", type: "boolean" },
      {
        name: "createdAt",
        type: "string",
        generator: "string.dateTime",
      },
    ],
  },
};


function nowIso(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function makeLog(
  index: number,
  endpoint: { id: string; method: HttpMethod; path: string },
  overrides: Partial<ProjectLogEntry> = {},
): ProjectLogEntry {
  const timestamp = new Date(Date.now() - index * 37_000).toISOString();
  return {
    id: `log_${String(index).padStart(6, "0")}`,
    timestamp,
    method: endpoint.method,
    path: endpoint.path,
    status: 200,
    endpointId: endpoint.id,
    endpointPath: endpoint.path,
    injected: false,
    injectedError: null,
    delayMs: 0,
    latencyMs: 8 + index,
    requestId: `req_demo_${index}`,
    requestBody: null,
    query: index % 2 === 0 ? "page=1&limit=3" : null,
    userAgent: "Mozilla/5.0 (MockAPI demo)",
    byteSize: 180 + index,
    ...overrides,
  };
}

function createDemoProject(mockBaseUrl: string): MockProject {
  const createdAt = nowIso(-1);
  const endpoint: MockEndpoint = {
    id: "ep_demo_users",
    method: "GET",
    path: "/users",
    schema: DEMO_SCHEMA,
    settings: {
      ...defaultEndpointSettings("GET", {
        successStatuses: { GET: 200, POST: 201, PUT: 200, DELETE: 204 },
        errorRange: { min: 400, max: 599 },
      }),
      delay: { minMs: 120, maxMs: 320 },
      errorInjection: { rate: 0, codes: [500] },
      list: { minSize: 3, maxSize: 3, path: null },
      pagination: null,
      seed: 42,
    },
    options: { wrapInList: false },
    createdAt,
    updatedAt: createdAt,
  };

  return {
    slug: DEMO_SLUG,
    name: "Hackathon demo",
    baseUrl: `${mockBaseUrl}/${DEMO_SLUG}`,
    editToken: DEMO_EDIT_TOKEN,
    createdAt,
    updatedAt: createdAt,
    expiresAt: nowIso(30),
    endpoints: [endpoint],
    logs: [
      makeLog(0, endpoint, { status: 200, requestId: "req_demo_200" }),
      makeLog(1, endpoint, {
        status: 500,
        injected: true,
        injectedError: "internal_error",
        requestId: "req_demo_500",
      }),
      makeLog(2, endpoint, { status: 200, requestId: "req_demo_older" }),
    ],
    usage: {
      requestsToday: 3,
      dailyLimit: 10_000,
      resetsAt: nowIso(1),
    },
  };
}

let projects = new Map<string, MockProject>();

export function mockBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MOCK_BASE_URL?.trim();
  return (configured || "https://api.example.com/m").replace(/\/+$/, "");
}

export function resetMockData(): void {
  projects = new Map();
  const demo = createDemoProject(mockBaseUrl());
  projects.set(demo.slug, demo);
}

resetMockData();

export function listProjects(): MockProject[] {
  return [...projects.values()];
}

export function getProjectBySlug(slug: string): MockProject | null {
  return projects.get(slug) ?? null;
}

export function getProjectByToken(token: string): MockProject | null {
  return listProjects().find((project) => project.editToken === token) ?? null;
}

export function putProject(project: MockProject): void {
  projects.set(project.slug, project);
}

export function deleteProject(slug: string): boolean {
  return projects.delete(slug);
}

export function appendLog(project: MockProject, log: ProjectLogEntry): void {
  project.logs = [log, ...project.logs].slice(0, MOCK_META_LIMITS.maxLogEntries);
  project.usage = {
    ...project.usage,
    requestsToday: project.usage.requestsToday + 1,
  };
  projects.set(project.slug, project);
}

export function nextLogId(project: MockProject): string {
  const numeric = project.logs
    .map((log) => Number(log.id.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length > 0 ? Math.max(...numeric) : 0) + 1;
  return `log_${String(next).padStart(6, "0")}`;
}

export function toProjectResponse(project: MockProject): ProjectResponse {
  return {
    slug: project.slug,
    name: project.name,
    baseUrl: project.baseUrl,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    expiresAt: project.expiresAt,
    endpoints: project.endpoints.map((endpoint) => ({
      id: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      url: `${project.baseUrl}${endpoint.path}`,
      schema: endpoint.schema,
      settings: endpoint.settings,
      options: endpoint.options,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    })),
    usage: project.usage,
  };
}

export function makeId(prefix: string): string {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${value}`;
}

export function makeSlug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export function makeEditToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `et_${token}`;
}

export function createDemoEndpoint(
  method: HttpMethod,
  path: string,
  schema: Schema,
  settings?: EndpointSettings,
): MockEndpoint {
  const timestamp = new Date().toISOString();
  return {
    id: makeId("ep"),
    method,
    path,
    schema,
    settings:
      settings ??
      defaultEndpointSettings(method, {
        successStatuses: { GET: 200, POST: 201, PUT: 200, DELETE: 204 },
        errorRange: { min: 400, max: 599 },
      }),
    options: { wrapInList: false },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
