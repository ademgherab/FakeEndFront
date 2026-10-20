import type {
  CreateProjectResponse,
  MetaResponse,
} from "@/lib/api/generated/schema";

export function makeMeta(overrides: Partial<MetaResponse> = {}): MetaResponse {
  const base: MetaResponse = {
    version: "1",
    mockBaseUrl: "https://api.example.com/m",
    methods: ["GET", "POST", "PUT", "DELETE"],
    successStatuses: { GET: 200, POST: 201, PUT: 200, DELETE: 204 },
    limits: {
      maxSampleBytes: 102_400,
      maxProjectNameLength: 60,
      maxEndpointsPerProject: 10,
      maxSchemaDepth: 10,
      maxSchemaNodes: 2_000,
    },
    delay: { minMs: 0, maxMs: 10_000 },
    errorRate: { min: 0, max: 100, maxDecimals: 1 },
    listSize: { min: 0, max: 1_000 },
    pagination: { maxTotalItems: 10_000, maxLimit: 100 },
    generators: [],
    errorRange: { min: 400, max: 599 },
  };

  return {
    ...base,
    ...overrides,
    limits: { ...base.limits, ...overrides.limits },
  };
}

export function makeCreateProjectResponse(
  overrides: Partial<CreateProjectResponse> = {},
): CreateProjectResponse {
  return {
    slug: "k3j9x2m8qa",
    name: "Demo project",
    baseUrl: "https://api.example.com/m/k3j9x2m8qa",
    editToken: "et_Qm3vExampleTokenValue12345",
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    endpoints: [
      {
        id: "ep_123",
        method: "GET",
        path: "/users",
        url: "https://api.example.com/m/k3j9x2m8qa/users",
      },
    ],
    ...overrides,
  };
}
