/**
 * INTERIM OPENAPI TYPES — DO NOT HAND-EDIT LONG-TERM.
 *
 * The backend has not published `/openapi/v1.json` yet. This file is a
 * deliberately small, clearly marked stand-in so the app can compile against
 * the contract described in the technical spec. Replace it by running:
 *
 *   pnpm gen:types
 *
 * That command regenerates this exact path from
 * `${NEXT_PUBLIC_API_BASE_URL}/openapi/v1.json` and fails loudly when the
 * backend is unreachable. Delete the INTERIM banner once the generated file is
 * committed.
 *
 * App code must import API types from this module only.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface MetaLimits {
  maxSampleBytes: number;
  maxProjectNameLength: number;
  maxEndpointsPerProject: number;
  maxSchemaDepth: number;
  maxSchemaNodes: number;
  maxListSize?: number;
  maxDelayMs?: number;
  maxErrorCodes?: number;
  maxLogEntries?: number;
  maxRequestBodyBytes?: number;
}

export interface MetaGeneratorParam {
  name: string;
  type: "string" | "integer" | "number" | "boolean";
  required: boolean;
  description?: string;
  default?: JsonValue;
}

export interface MetaGenerator {
  id: string;
  label: string;
  description?: string;
  appliesTo: Array<"string" | "number" | "integer" | "boolean" | "array" | "object">;
  params: MetaGeneratorParam[];
}

export interface MetaResponse {
  version: string;
  mockBaseUrl: string;
  methods: HttpMethod[];
  successStatuses: Record<string, number>;
  limits: MetaLimits;
  delay: { minMs: number; maxMs: number };
  errorRate: { min: number; max: number; maxDecimals?: number };
  listSize: { min: number; max: number };
  pagination: { maxTotalItems: number; maxLimit: number };
  generators: MetaGenerator[];
  errorRange?: { min: number; max: number };
}

export type SchemaNodeType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

export interface SchemaNode {
  /** Stable editor-only id. Never sent to the API. */
  id?: string;
  name: string;
  type: SchemaNodeType;
  nullable?: boolean;
  nullProbability?: number;
  omitProbability?: number;
  generator?: string;
  generatorParams?: Record<string, JsonValue>;
  enumValues?: JsonValue[];
  /** Constant value for leaves; mutually exclusive with a generator. */
  constant?: JsonValue;
  /** Nested array item-count bounds. */
  length?: { min: number; max: number };
  fields?: SchemaNode[];
  items?: SchemaNode;
}

export interface Schema {
  version: 1;
  root: SchemaNode;
}

export interface InferWarning {
  path: string | null;
  code: string;
  message: string;
}

export interface InferSuggestion {
  path: string;
  code: string;
  message: string;
  generator?: string;
}

export interface InferRequest {
  sample: JsonValue;
  options?: {
    wrapInList?: boolean;
  };
}

export interface InferResponse {
  schema: Schema;
  warnings?: InferWarning[];
  suggestions?: InferSuggestion[];
}

export interface EndpointDelay {
  minMs: number;
  maxMs: number;
}

export interface EndpointErrorInjection {
  /** Fraction in 0..1. */
  rate: number;
  codes: number[];
}

export interface EndpointListSettings {
  minSize: number;
  maxSize: number;
  /** JSON Pointer to the array inside the response object; null means the root. */
  path: string | null;
}

export interface EndpointPaginationSettings {
  totalItems: number;
  defaultLimit: number;
  maxLimit: number;
  pageBinding: string | null;
  limitBinding: string | null;
  totalBinding: string | null;
  totalPagesBinding: string | null;
  hasNextBinding: string | null;
  hasPrevBinding: string | null;
}

export interface EndpointSettings {
  successStatus: number;
  delay: EndpointDelay;
  errorInjection: EndpointErrorInjection;
  list: EndpointListSettings;
  pagination: EndpointPaginationSettings | null;
  seed: number | null;
}

export interface CreateEndpointInput {
  method: HttpMethod;
  path: string;
  /** Exactly one of `sample` or `schema` is sent per endpoint. */
  sample?: JsonValue;
  schema?: Schema;
  options?: {
    wrapInList?: boolean;
  };
  settings?: EndpointSettings;
}

export interface CreateProjectRequest {
  name?: string;
  endpoints: CreateEndpointInput[];
}

export interface CreatedEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  url: string;
}

export interface ProjectQuota {
  limit: number;
  remaining: number;
  resetsAt?: string;
}

export interface CreateProjectResponse {
  slug: string;
  name?: string | null;
  baseUrl: string;
  editToken: string;
  expiresAt: string;
  endpoints: CreatedEndpoint[];
  quota?: ProjectQuota;
}

export interface ProjectEndpoint extends CreatedEndpoint {
  createdAt?: string;
  updatedAt?: string;
  schema?: Schema;
  settings?: EndpointSettings;
  options?: {
    wrapInList?: boolean;
  };
}

export interface ProjectUsage {
  requestsToday: number;
  dailyLimit: number;
  resetsAt?: string;
}

export interface ProjectResponse {
  slug: string;
  name?: string | null;
  baseUrl: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt: string;
  endpoints: ProjectEndpoint[];
  quota?: ProjectQuota;
  /** Preferred shape from §10.3.5; quota remains a fallback. */
  usage?: ProjectUsage;
}

export interface UpdateEndpointInput {
  method: HttpMethod;
  path: string;
  schema: Schema;
  settings: EndpointSettings;
  options?: {
    wrapInList?: boolean;
  };
}

export interface CreateEndpointRequest {
  method: HttpMethod;
  path: string;
  sample?: JsonValue;
  schema?: Schema;
  options?: {
    wrapInList?: boolean;
  };
  settings?: EndpointSettings;
}

/** Normalised log row used by the log table; the API may omit optional fields. */
export interface ProjectLogEntry {
  id: string;
  timestamp: string;
  method: HttpMethod;
  path: string;
  status: number;
  endpointId: string | null;
  endpointPath: string | null;
  injected: boolean;
  injectedError: string | null;
  delayMs: number | null;
  latencyMs: number | null;
  requestId: string | null;
  requestBody: JsonValue | string | null;
  query: string | null;
  userAgent: string | null;
  byteSize: number | null;
}

export interface LogsResponse {
  items: ProjectLogEntry[];
  nextCursor: string | null;
}

export interface PreviewRequest {
  schema: Schema;
  settings: EndpointSettings;
  page?: number;
  limit?: number;
}

export interface PreviewResponse {
  body: JsonValue;
  byteSize?: number;
}
