/**
 * Contract types. These mirror `frontend-integration.md` §7 exactly and are
 * the only place the wire format is described. `Schema` stays opaque for
 * rendering: the frontend never re-implements generator validation.
 */

export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type Schema = { version: 1; root: SchemaNode };
export type SchemaNode = ObjectNode | ArrayNode | LeafNode;

export type ObjectNode = {
  type: "object";
  fields: Array<{
    name: string;
    node: SchemaNode;
    nullProbability?: number;
    omitProbability?: number;
  }>;
};

export type ArrayNode = {
  type: "array";
  item: SchemaNode;
  length?: { min: number; max: number };
};

export type LeafNode = {
  type: "string" | "integer" | "number" | "boolean" | "null";
  generator: { name: string; params?: Record<string, unknown> };
};

export type PaginationBindings = {
  page?: string | null;
  limit?: string | null;
  total?: string | null;
  totalPages?: string | null;
  hasNext?: string | null;
  hasPrev?: string | null;
};

export type PaginationSettings = {
  enabled?: boolean;
  totalItems?: number;
  defaultLimit?: number;
  maxLimit?: number;
  bindings?: PaginationBindings;
};

export type EndpointSettings = {
  successStatus?: 200 | 201 | 202 | 204;
  delay?: { minMs: number; maxMs: number };
  errors?: { ratePercent: number; statusCodes: number[] };
  list?: {
    /** RFC 6901 pointer to the array, or `null` for a root array. */
    path?: string | null;
    size?: { min: number; max: number };
  };
  pagination?: PaginationSettings;
  /** Reserved. Accepted by the API, but seeded generation is not implemented. */
  seed?: number | null;
};

export type EndpointInput = {
  method: Method;
  path: string;
  sample?: unknown;
  schema?: Schema;
  options?: { wrapInList?: boolean };
  settings?: EndpointSettings;
};

export type ProjectInput = {
  name?: string;
  endpoints: EndpointInput[];
};

export type Endpoint = {
  id: string;
  method: Method;
  path: string;
  url: string;
  schema: Schema;
  settings: EndpointSettings;
  createdAt: string;
  updatedAt: string;
};

export type ProjectUsage = {
  requestsToday: number;
  dailyLimit: number;
};

export type Project = {
  slug: string;
  /** Only returned by `POST /api/v1/projects`. Never persisted by the app. */
  editToken?: string;
  name: string | null;
  createdAt: string;
  expiresAt: string;
  baseUrl: string;
  usage?: ProjectUsage;
  endpoints: Endpoint[];
};

export type InferWarning = {
  code: string;
  path: string;
  message: string;
};

export type InferResponse = {
  schema: Schema;
  warnings: InferWarning[];
  suggestions: {
    list?: { path: string | null };
    pagination?: { bindings: Record<string, string | null> };
  };
};

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
  errors?: Record<string, string[]>;
};

/**
 * The problem payload as it arrives on the wire. The API always sends the
 * fields of `ApiProblem`, but a proxy or a crash can answer with something
 * else, so every field is optional while parsing.
 */
export type ProblemPayload = Partial<ApiProblem> & {
  status?: number;
};

export type RuntimeErrorBody = {
  error: {
    status: number;
    code: string;
    title: string;
    message: string;
    injected: boolean;
    requestId: string;
  };
};

export type PreviewPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type PreviewResponse = {
  data: unknown;
  pagination: PreviewPagination | null;
};

export type LogEntry = {
  id: number;
  requestId: string;
  endpointId: string | null;
  method: string;
  path: string;
  query: string | null;
  status: number;
  injectedError: boolean;
  delayMs: number | null;
  latencyMs: number | null;
  requestContentType: string | null;
  requestBody: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type LogsResponse = {
  items: LogEntry[];
  nextCursor: number | null;
  latestId: number | null;
};

export type LogsQuery = {
  limit?: number;
  before?: number | null;
  after?: number | null;
  endpointId?: string | null;
  status?: number | null;
  injected?: boolean | null;
};

export type GeneratorParam = {
  name: string;
  type: string;
  required: boolean;
};

export type GeneratorDescriptor = {
  name: string;
  nodeTypes: string[];
  params: GeneratorParam[];
};

export type MetaLimits = {
  maxEndpointsPerProject: number;
  maxSampleBytes: number;
  maxRequestBodyBytes: number;
  maxPathLength: number;
  maxDelayMs: number;
  maxListSize: number;
  maxPaginationTotalItems: number;
  maxPaginationLimit: number;
  maxErrorStatusCodes: number;
  dailyRequestsPerProject: number;
  maxLogEntriesPerProject: number;
};

export type MetaResponse = {
  mockBaseUrl: string;
  projectLifetimeDays: number;
  methods: Method[];
  successStatuses: number[];
  errorStatusRange: { min: number; max: number };
  limits: MetaLimits;
  generators: GeneratorDescriptor[];
};

export type HealthResponse = {
  status: string;
  checks: Array<{ name: string; status: string }>;
};
