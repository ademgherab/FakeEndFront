import type { EndpointSettings, MetaResponse, Method } from "@/lib/types";

/**
 * Fallback limits and status lists. They mirror the `GET /api/v1/meta`
 * payload; when meta is unavailable the UI uses these instead. The page must
 * never block on meta.
 */

export const METHODS: Method[] = ["GET", "POST", "PUT", "DELETE"];

export const SUCCESS_STATUSES = [200, 201, 202, 204] as const;

export const DEFAULT_SUCCESS_STATUS: Record<Method, 200 | 201 | 202 | 204> = {
  GET: 200,
  POST: 201,
  PUT: 200,
  DELETE: 204,
};

/** Server defaults per method, from `frontend-integration.md` §5. */
export const DEFAULT_DELAY: Record<Method, { minMs: number; maxMs: number }> = {
  GET: { minMs: 0, maxMs: 0 },
  POST: { minMs: 0, maxMs: 0 },
  PUT: { minMs: 0, maxMs: 0 },
  DELETE: { minMs: 0, maxMs: 0 },
};

export const DEFAULT_ERROR_RATE = 0;
export const DEFAULT_ERROR_CODES = [500];

export const DEFAULT_LIST_SIZE: Record<Method, { min: number; max: number }> = {
  GET: { min: 10, max: 10 },
  POST: { min: 10, max: 10 },
  PUT: { min: 10, max: 10 },
  DELETE: { min: 10, max: 10 },
};

export const DEFAULT_PAGINATION = {
  enabled: false,
  totalItems: 100,
  defaultLimit: 10,
  maxLimit: 100,
} as const;

export const FALLBACK_META: MetaResponse = {
  mockBaseUrl: "http://localhost:5031/m",
  projectLifetimeDays: 7,
  methods: [...METHODS],
  successStatuses: [...SUCCESS_STATUSES],
  errorStatusRange: { min: 400, max: 599 },
  limits: {
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
  },
  generators: [],
};

export const LIMITS = {
  path: { maxLength: FALLBACK_META.limits.maxPathLength },
  sample: { maxBytes: FALLBACK_META.limits.maxSampleBytes },
  body: { maxBytes: FALLBACK_META.limits.maxRequestBodyBytes },
  delay: { minMs: 0, maxMs: FALLBACK_META.limits.maxDelayMs },
  errorRate: { min: 0, max: 100, maxDecimals: 1 },
  errorCodes: {
    minCount: 1,
    maxCount: FALLBACK_META.limits.maxErrorStatusCodes,
    min: FALLBACK_META.errorStatusRange.min,
    max: FALLBACK_META.errorStatusRange.max,
  },
  listSize: { min: 0, max: FALLBACK_META.limits.maxListSize },
  pagination: {
    totalItems: {
      min: 0,
      max: FALLBACK_META.limits.maxPaginationTotalItems,
    },
    limit: { min: 1, max: FALLBACK_META.limits.maxPaginationLimit },
  },
  endpointsPerProject: FALLBACK_META.limits.maxEndpointsPerProject,
  logs: { maxLimit: 100, defaultLimit: 50 },
} as const;

/** The settings the server applies when a field is omitted. */
export function defaultSettingsFor(method: Method): EndpointSettings {
  return {
    successStatus: DEFAULT_SUCCESS_STATUS[method],
    delay: { ...DEFAULT_DELAY[method] },
    errors: {
      ratePercent: DEFAULT_ERROR_RATE,
      statusCodes: [...DEFAULT_ERROR_CODES],
    },
    list: { path: null, size: { ...DEFAULT_LIST_SIZE[method] } },
    pagination: {
      enabled: DEFAULT_PAGINATION.enabled,
      totalItems: DEFAULT_PAGINATION.totalItems,
      defaultLimit: DEFAULT_PAGINATION.defaultLimit,
      maxLimit: DEFAULT_PAGINATION.maxLimit,
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
}

export const DEFAULT_SETTINGS: EndpointSettings = defaultSettingsFor("GET");

export interface SettingsPreset {
  id: string;
  label: string;
  settings: EndpointSettings;
}

export const SETTINGS_PRESETS: SettingsPreset[] = [
  {
    id: "fast",
    label: "Fast + reliable",
    settings: {
      successStatus: DEFAULT_SUCCESS_STATUS.GET,
      delay: { minMs: 0, maxMs: 0 },
      errors: { ratePercent: 0, statusCodes: [500] },
      list: { path: null, size: { min: 10, max: 10 } },
    },
  },
  {
    id: "realistic",
    label: "Realistic",
    settings: {
      successStatus: DEFAULT_SUCCESS_STATUS.GET,
      delay: { minMs: 300, maxMs: 1500 },
      errors: { ratePercent: 10, statusCodes: [500, 503] },
      list: { path: null, size: { min: 10, max: 10 } },
    },
  },
  {
    id: "flaky",
    label: "Flaky demo",
    settings: {
      successStatus: DEFAULT_SUCCESS_STATUS.GET,
      delay: { minMs: 0, maxMs: 0 },
      errors: { ratePercent: 100, statusCodes: [503] },
      list: { path: null, size: { min: 10, max: 10 } },
    },
  },
];

/** Deep clone so presets and defaults cannot be mutated by form edits. */
export function cloneSettings(settings: EndpointSettings): EndpointSettings {
  return {
    ...settings,
    delay: settings.delay ? { ...settings.delay } : undefined,
    errors: settings.errors
      ? { ...settings.errors, statusCodes: [...settings.errors.statusCodes] }
      : undefined,
    list: settings.list
      ? {
          ...settings.list,
          size: settings.list.size ? { ...settings.list.size } : undefined,
        }
      : undefined,
    pagination: settings.pagination
      ? {
          ...settings.pagination,
          bindings: settings.pagination.bindings
            ? { ...settings.pagination.bindings }
            : undefined,
        }
      : undefined,
  };
}

/** The limits a form should enforce, from meta when available. */
export function limitsFromMeta(meta: MetaResponse | null) {
  return meta?.limits ?? FALLBACK_META.limits;
}

export function errorRangeFromMeta(meta: MetaResponse | null) {
  return meta?.errorStatusRange ?? FALLBACK_META.errorStatusRange;
}

export function successStatusesFromMeta(meta: MetaResponse | null): number[] {
  return meta?.successStatuses ?? [...SUCCESS_STATUSES];
}

/**
 * The API answers with the full settings object, defaults applied. When the
 * server omits a section the form falls back to the documented defaults.
 */
export function normalizeSettings(
  settings: EndpointSettings | undefined,
  method: Method,
): EndpointSettings {
  const fallback = defaultSettingsFor(method);
  const merged: EndpointSettings = {
    ...fallback,
    ...(settings ?? {}),
  };

  merged.successStatus = merged.successStatus ?? fallback.successStatus;
  merged.delay = { ...(fallback.delay ?? { minMs: 0, maxMs: 0 }), ...(settings?.delay ?? {}) };
  merged.errors = {
    ratePercent: settings?.errors?.ratePercent ?? fallback.errors!.ratePercent,
    statusCodes: [
      ...(settings?.errors?.statusCodes ?? fallback.errors!.statusCodes),
    ],
  };
  merged.list = {
    path: settings?.list?.path ?? null,
    size: {
      min: settings?.list?.size?.min ?? fallback.list!.size!.min,
      max: settings?.list?.size?.max ?? fallback.list!.size!.max,
    },
  };
  merged.pagination = {
    ...fallback.pagination,
    ...(settings?.pagination ?? {}),
    bindings: {
      ...(fallback.pagination?.bindings ?? {}),
      ...(settings?.pagination?.bindings ?? {}),
    },
  };

  return merged;
}
