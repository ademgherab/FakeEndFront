import type {
  HttpMethod,
  MetaLimits,
  MetaResponse,
} from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";

/**
 * Bump when the frontend starts relying on a newer /meta shape. It is part of
 * the sessionStorage key, so deployed clients do not read stale payloads.
 */
const META_SHAPE_VERSION = 2;
const META_CACHE_PREFIX = "mockapi.meta";

type UnknownRecord = Record<string, unknown>;

let memoryCache: { key: string; data: MetaResponse } | null = null;
let inFlight: Promise<MetaResponse> | null = null;

export function metaCacheKey(): string {
  return `${META_CACHE_PREFIX}.${config.version}.${META_SHAPE_VERSION}.${config.apiBaseUrl}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, expectation: string): never {
  throw new AppError({
    status: 0,
    code: "invalid_response",
    title: "The meta response is not usable",
    detail: `GET /api/v1/meta returned an invalid "${field}" (expected ${expectation}).`,
  });
}

function record(raw: UnknownRecord, field: string): UnknownRecord {
  const value = raw[field];
  if (!isRecord(value)) invalid(field, "an object");
  return value;
}

function positiveNumber(raw: UnknownRecord, field: string): number {
  const value = raw[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    invalid(field, "a positive number");
  }
  return value;
}

function text(raw: UnknownRecord, field: string): string {
  const value = raw[field];
  if (typeof value !== "string" || !value.trim()) invalid(field, "a non-empty string");
  return value;
}

function httpMethod(value: unknown, field: string): HttpMethod {
  if (value === "GET" || value === "POST" || value === "PUT" || value === "DELETE") {
    return value;
  }
  invalid(field, "GET, POST, PUT or DELETE");
}

const METHOD_DEFAULT_STATUS: Record<HttpMethod, number> = {
  GET: 200,
  POST: 201,
  PUT: 200,
  DELETE: 204,
};

/**
 * Validates the fields the UI depends on and fills optional groups with
 * documented defaults. Unknown properties are ignored.
 */
export function normalizeMeta(raw: unknown): MetaResponse {
  if (!isRecord(raw)) invalid("body", "a JSON object");

  const methodsRaw = raw.methods;
  if (!Array.isArray(methodsRaw) || methodsRaw.length === 0) {
    invalid("methods", "a non-empty array");
  }
  const methods = methodsRaw.map((method, index) => httpMethod(method, `methods[${index}]`));

  const mockBaseUrl = text(raw, "mockBaseUrl");
  try {
    const parsed = new URL(mockBaseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      invalid("mockBaseUrl", "an absolute http(s) URL");
    }
  } catch {
    invalid("mockBaseUrl", "an absolute http(s) URL");
  }

  const limitsRaw = record(raw, "limits");
  const requiredLimits = {
    maxSampleBytes: positiveNumber(limitsRaw, "maxSampleBytes"),
    maxProjectNameLength: positiveNumber(limitsRaw, "maxProjectNameLength"),
    maxEndpointsPerProject: positiveNumber(limitsRaw, "maxEndpointsPerProject"),
    maxSchemaDepth: positiveNumber(limitsRaw, "maxSchemaDepth"),
    maxSchemaNodes: positiveNumber(limitsRaw, "maxSchemaNodes"),
  };
  const limits: MetaLimits = {
    ...requiredLimits,
    ...optionalNumber(limitsRaw, "maxListSize"),
    ...optionalNumber(limitsRaw, "maxDelayMs"),
    ...optionalNumber(limitsRaw, "maxErrorCodes"),
    ...optionalNumber(limitsRaw, "maxLogEntries"),
    ...optionalNumber(limitsRaw, "maxRequestBodyBytes"),
  };

  const successStatuses: Record<string, number> = {};
  for (const method of methods) {
    successStatuses[method] = METHOD_DEFAULT_STATUS[method];
  }
  if (isRecord(raw.successStatuses)) {
    for (const method of methods) {
      const value = raw.successStatuses[method];
      if (typeof value === "number" && Number.isFinite(value)) {
        successStatuses[method] = value;
      }
    }
  }

  const delay = numberRange(raw.delay, "delay", { minMs: 0, maxMs: 10_000 });
  const errorRate = numberRange(raw.errorRate, "errorRate", { min: 0, max: 100 });
  const listSize = numberRange(raw.listSize, "listSize", { min: 0, max: 1_000 });
  const pagination = numberRange(raw.pagination, "pagination", {
    maxTotalItems: 10_000,
    maxLimit: 100,
  });

  const generatorsRaw = raw.generators;
  if (generatorsRaw !== undefined && !Array.isArray(generatorsRaw)) {
    invalid("generators", "an array");
  }

  return {
    version: typeof raw.version === "string" ? raw.version : "unknown",
    mockBaseUrl: mockBaseUrl.replace(/\/+$/, ""),
    methods,
    successStatuses,
    limits,
    delay: delay as MetaResponse["delay"],
    errorRate: errorRate as MetaResponse["errorRate"],
    listSize: listSize as MetaResponse["listSize"],
    pagination: pagination as MetaResponse["pagination"],
    generators: (generatorsRaw ?? []) as MetaResponse["generators"],
    errorRange: isRecord(raw.errorRange)
      ? {
          min:
            typeof raw.errorRange.min === "number" ? raw.errorRange.min : 400,
          max:
            typeof raw.errorRange.max === "number" ? raw.errorRange.max : 599,
        }
      : undefined,
  };
}

function optionalNumber<T extends string>(
  raw: UnknownRecord,
  field: T,
): Partial<Record<T, number>> {
  const value = raw[field];
  if (typeof value === "number" && Number.isFinite(value)) {
    return { [field]: value } as Partial<Record<T, number>>;
  }
  return {};
}

function numberRange<T extends string>(
  value: unknown,
  field: string,
  fallback: Record<T, number>,
): Record<T, number> {
  if (value === undefined) return fallback;
  if (!isRecord(value)) invalid(field, "an object");
  const result = { ...fallback };
  for (const key of Object.keys(fallback) as T[]) {
    const entry = value[key];
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }
  return result;
}

function readSessionCache(): MetaResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(metaCacheKey());
    if (!raw) return null;
    return normalizeMeta(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeSessionCache(data: MetaResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(metaCacheKey(), JSON.stringify(data));
  } catch {
    // Storage can be full or disabled; the in-memory cache still works.
  }
}

export function readCachedMeta(): MetaResponse | null {
  const key = metaCacheKey();
  if (memoryCache?.key === key) return memoryCache.data;
  const cached = readSessionCache();
  if (cached) {
    memoryCache = { key, data: cached };
    return cached;
  }
  return null;
}

export function clearMetaCache(): void {
  memoryCache = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(metaCacheKey());
    } catch {
      // Ignore unavailable storage.
    }
  }
}

/**
 * Loads meta once per session. Concurrent callers share one request.
 * Pass `force` for an explicit refresh.
 */
export function getMeta({ force = false, signal }: { force?: boolean; signal?: AbortSignal } = {}): Promise<MetaResponse> {
  if (!force) {
    const cached = readCachedMeta();
    if (cached) return Promise.resolve(cached);
  }

  if (inFlight) return inFlight;

  inFlight = apiRequest<unknown>("/meta", { signal })
    .then((response) => {
      const data = normalizeMeta(response.data);
      memoryCache = { key: metaCacheKey(), data };
      writeSessionCache(data);
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Test-only helper: clears module and session caches. */
export function resetMetaCacheForTests(): void {
  inFlight = null;
  clearMetaCache();
}
