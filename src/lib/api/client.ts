import type {
  AppErrorCode,
  AppErrorInit,
} from "@/lib/errors";
import {
  AppError,
  parseRetryAfter,
  statusToCode,
} from "@/lib/errors";
import { apiUrl } from "@/lib/config";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_GET_ATTEMPTS = 3; // first try + two retries

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  /** Edit token. Sent as a bearer header only when provided. */
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: HeadersInit;
  /** GET retries are on by default; writes never retry automatically. */
  retry?: boolean;
  /** Backoff base in ms. Tests set this to 0. */
  retryDelayMs?: number;
  /** Code used when an error response omits one. */
  fallbackCode?: string;
}

export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  data: T;
  requestId: string | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;

  const result: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (Array.isArray(entry)) {
      const messages = entry.filter((item): item is string => typeof item === "string");
      if (messages.length > 0) result[key] = messages;
    } else if (typeof entry === "string" && entry.trim()) {
      result[key] = [entry];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function requestIdFrom(headers: Headers): string | null {
  return headers.get("x-request-id") ?? headers.get("request-id");
}

function normalizeFailure(
  status: number,
  parsed: unknown,
  headers: Headers,
  fallbackCode?: string,
): AppError {
  const headerRequestId = requestIdFrom(headers);
  const headerRetryAfter = parseRetryAfter(headers.get("retry-after"));
  const runtimeError = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : null;
  const problem = isRecord(parsed) && !runtimeError ? parsed : null;
  const source = runtimeError ?? problem;
  const errors = problem ? normalizeFieldErrors(problem.errors) : undefined;

  const code =
    asString(source?.code) ??
    fallbackCode ??
    (status === 413
      ? "payload_too_large"
      : status === 422 && errors
        ? "validation_failed"
        : statusToCode(status));

  const retryAfter =
    headerRetryAfter ??
    asNumber(source?.retryAfter) ??
    asNumber(source?.retry_after) ??
    null;

  const traceId =
    asString(source?.traceId) ??
    asString(source?.trace_id) ??
    asString(source?.requestId) ??
    headerRequestId;

  const detail = runtimeError
    ? asString(runtimeError.message)
    : asString(problem?.detail) ?? asString(problem?.message);

  const init: AppErrorInit = {
    status,
    code: code as AppErrorCode,
    title: asString(source?.title),
    detail,
    errors,    traceId,
    requestId: traceId,
    retryAfter,
  };

  return new AppError(init);
}

function parseJson(text: string): unknown {
  if (!text.trim()) return undefined;
  return JSON.parse(text) as unknown;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new AppError({ status: 0, code: "aborted" }));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    if (signal?.aborted) {
      cleanup();
      reject(new AppError({ status: 0, code: "aborted" }));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function canRetryAttempt(error: AppError, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts - 1) return false;
  return (
    error.code === "network_error" ||
    error.code === "timeout" ||
    error.status >= 500
  );
}

/**
 * The one management-API entry point.
 *
 * - Adds `/api/v1`, JSON headers and an optional bearer token.
 * - Normalises problem+json and runtime error shapes into `AppError`.
 * - Never sends credentials/cookies and never echoes the token.
 * - Retries idempotent GETs at most twice on network errors and 5xx.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const method = (options.method ?? "GET").toUpperCase();
  const attempts = options.retry === false || method !== "GET" ? 1 : MAX_GET_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = apiUrl(path);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await performAttempt<T>(url, method, options, timeoutMs);
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError({
        status: 0,
        code: "unknown_error",
        cause: error,
      });

      if (!canRetryAttempt(appError, attempt, attempts)) {
        throw appError;
      }

      const backoff = (options.retryDelayMs ?? 250) * 2 ** attempt;
      await delay(backoff, options.signal);
    }
  }

  // The loop always returns or throws.
  throw new AppError({ status: 0, code: "network_error" });
}

async function performAttempt<T>(
  url: string,
  method: string,
  options: ApiRequestOptions,
  timeoutMs: number,
): Promise<ApiResponse<T>> {
  if (options.signal?.aborted) {
    throw new AppError({ status: 0, code: "aborted" });
  }

  const controller = new AbortController();
  let timedOut = false;

  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });

    const requestId = requestIdFrom(response.headers);
    const text = response.status === 204 ? "" : await response.text();
    let parsed: unknown;
    if (text) {
      try {
        parsed = parseJson(text);
      } catch (cause) {
        if (response.ok) {
          throw new AppError({
            status: response.status,
            code: "invalid_response",
            requestId,
            cause,
          });
        }
        parsed = undefined;
      }
    }

    if (!response.ok) {
      throw normalizeFailure(
        response.status,
        parsed,
        response.headers,
        options.fallbackCode,
      );
    }

    return {
      status: response.status,
      headers: response.headers,
      data: parsed as T,
      requestId,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (controller.signal.aborted) {
      if (timedOut) {
        throw new AppError({
          status: 0,
          code: "timeout",
          detail: `No response after ${timeoutMs} ms.`,
        });
      }
      throw new AppError({ status: 0, code: "aborted" });
    }

    throw new AppError({
      status: 0,
      code: "network_error",
      detail: error instanceof Error ? error.message : undefined,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}
