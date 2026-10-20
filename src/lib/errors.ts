/**
 * One error type and one copy map for the whole app.
 *
 * The API client normalises every failure into `AppError`; components render it
 * through `explainError()` and never inspect `response.ok` or raw payloads.
 */

export const ERROR_CODES = [
  "validation_failed",
  "invalid_pagination",
  "missing_token",
  "invalid_token",
  "project_not_found",
  "endpoint_not_found",
  "method_not_allowed",
  "project_expired",
  "payload_too_large",
  "unsupported_media_type",
  "sample_invalid",
  "sample_too_complex",
  "response_too_large",
  "endpoint_limit_reached",
  "duplicate_endpoint",
  "rate_limited",
  "daily_quota_exceeded",
  "internal_error",
  "generation_failed",
  "network_error",
  "timeout",
  "aborted",
  "invalid_response",
  "unknown_error",
] as const;

export type KnownErrorCode = (typeof ERROR_CODES)[number];
/** The server may add codes before the frontend knows about them. */
export type AppErrorCode = KnownErrorCode | (string & {});

export interface AppErrorInit {
  status?: number;
  code?: AppErrorCode;
  title?: string;
  detail?: string;
  /** Field-level validation messages keyed by dotted/indexed path. */
  errors?: Record<string, string[]>;
  traceId?: string | null;
  retryAfter?: number | null;
  requestId?: string | null;
  cause?: unknown;
}

export interface ErrorCopy {
  title: string;
  message: string;
  action?: string;
}

const TOKEN_PATTERN = /\bet_[A-Za-z0-9_-]{8,}\b/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const INTERNAL_PATTERN =
  /(stack trace|stacktrace|syntaxerror|system\.|exception at|at [A-Za-z0-9_.]+\()/i;

/** Strip anything that must never reach the UI, analytics or error reports. */
export function redactSecrets(value: string): string {
  return value
    .replace(TOKEN_PATTERN, "et_…")
    .replace(BEARER_PATTERN, "Bearer [redacted]");
}

function isPresentable(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !INTERNAL_PATTERN.test(trimmed);
}

export class AppError extends Error {
  override name = "AppError";
  readonly status: number;
  readonly code: AppErrorCode;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Record<string, string[]>;
  readonly traceId: string | null;
  readonly retryAfter: number | null;
  readonly requestId: string | null;

  constructor(init: AppErrorInit = {}) {
    const status = init.status ?? 0;
    const code = init.code ?? statusToCode(status);
    const title = redactSecrets(init.title?.trim() || copyForCode(code).title);
    const detail = init.detail ? redactSecrets(init.detail) : undefined;
    super(detail ? `${title}: ${detail}` : title);

    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = init.errors;
    this.traceId = init.traceId ?? init.requestId ?? null;
    this.retryAfter = init.retryAfter ?? null;
    this.requestId = init.requestId ?? init.traceId ?? null;
    if (init.cause !== undefined) {
      this.cause = init.cause;
    }
  }
}

export function isAppError(value: unknown): value is AppError {
  if (value instanceof AppError) return true;
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown; status?: unknown };
  return (
    candidate.name === "AppError" &&
    typeof candidate.code === "string" &&
    typeof candidate.status === "number"
  );
}

/** Map an HTTP status to a code when the response does not provide one. */
export function statusToCode(status: number): AppErrorCode {
  switch (status) {
    case 400:
      return "validation_failed";
    case 401:
      return "missing_token";
    case 403:
      return "invalid_token";
    case 404:
      return "project_not_found";
    case 405:
      return "method_not_allowed";
    case 409:
      return "duplicate_endpoint";
    case 410:
      return "project_expired";
    case 413:
      return "payload_too_large";
    case 415:
      return "unsupported_media_type";
    case 422:
      return "sample_invalid";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "internal_error" : "unknown_error";
  }
}

const COPY: Record<KnownErrorCode, ErrorCopy> = {
  validation_failed: {
    title: "Some fields need attention",
    message: "Check the highlighted fields and try again.",
    action: "Fix the highlighted fields.",
  },
  invalid_pagination: {
    title: "Pagination values are out of range",
    message: "The page or limit is outside the allowed range. Lower the values and retry.",
    action: "Use a page and limit within the values shown in the form.",
  },
  missing_token: {
    title: "Edit token required",
    message: "This project needs its edit token before it can be opened.",
    action: "Enter the edit token for this project.",
  },
  invalid_token: {
    title: "That token does not match this project",
    message: "The token was rejected. Check that you copied the whole value.",
    action: "Re-enter the edit token, or clear the saved one and try again.",
  },
  project_not_found: {
    title: "Project not found",
    message: "This project does not exist or has been deleted.",
    action: "Create a new project or check the URL.",
  },
  endpoint_not_found: {
    title: "Endpoint not found",
    message: "This endpoint does not exist or has been deleted.",
    action: "Go back to the project overview.",
  },
  method_not_allowed: {
    title: "Method not allowed",
    message: "This endpoint does not accept that HTTP method.",
    action: "Use one of the methods listed in the Allow header.",
  },
  project_expired: {
    title: "This project has expired",
    message: "Expired projects are read-only for a short grace period, then deleted.",
    action: "Create a new project to keep testing.",
  },
  payload_too_large: {
    title: "That payload is too large",
    message: "The request or sample exceeds the size limit.",
    action: "Shrink the sample or request body and try again.",
  },
  unsupported_media_type: {
    title: "Unsupported content type",
    message: "The request was sent with a content type the API does not accept.",
    action: "Reload the page and try again. If it persists, report a bug.",
  },
  sample_invalid: {
    title: "That sample cannot be used",
    message: "The sample root must be a JSON object or array.",
    action: "Wrap the value in an object or array and try again.",
  },
  sample_too_complex: {
    title: "That sample is too complex",
    message: "The sample exceeds the depth, field or node limits.",
    action: "Simplify the sample, then infer again.",
  },
  response_too_large: {
    title: "The generated response would be too large",
    message: "The list size or pagination limits produce more data than the API allows.",
    action: "Lower the list size or max limit and save again.",
  },
  endpoint_limit_reached: {
    title: "Endpoint limit reached",
    message: "This project already has the maximum number of endpoints.",
    action: "Delete an endpoint before adding another.",
  },
  duplicate_endpoint: {
    title: "That endpoint already exists",
    message: "Another endpoint uses the same method and normalized path.",
    action: "Change the method or path, including any template names.",
  },
  rate_limited: {
    title: "Too many requests",
    message: "The API asked us to slow down.",
    action: "Wait for the countdown, then try again.",
  },
  daily_quota_exceeded: {
    title: "Daily request quota reached",
    message: "This project has used its requests for today.",
    action: "Wait until 00:00 UTC, then try again.",
  },
  internal_error: {
    title: "Something went wrong on our side",
    message: "The API returned an unexpected error. Your data was not changed.",
    action: "Retry in a moment. Quote the reference below if you report it.",
  },
  generation_failed: {
    title: "The mock data could not be generated",
    message: "The schema and settings produced an invalid response.",
    action: "Simplify the schema or settings, then retry.",
  },
  network_error: {
    title: "Cannot reach the API",
    message: "The browser could not connect to the API.",
    action: "Check your connection and NEXT_PUBLIC_API_BASE_URL, then retry.",
  },
  timeout: {
    title: "The request took too long",
    message: "The API did not answer before the timeout.",
    action: "Retry. If it keeps happening, check the API status.",
  },
  aborted: {
    title: "Request cancelled",
    message: "The request was cancelled before it finished.",
    action: "Try again when you are ready.",
  },
  invalid_response: {
    title: "The API returned an unreadable response",
    message: "The response did not match the expected JSON contract.",
    action: "Retry. If it persists, report a bug with the reference below.",
  },
  unknown_error: {
    title: "Something went wrong",
    message: "An unexpected error occurred.",
    action: "Retry. If it persists, reload the page.",
  },
};

export function copyForCode(code: AppErrorCode): ErrorCopy {
  if (Object.prototype.hasOwnProperty.call(COPY, code)) {
    return COPY[code as KnownErrorCode];
  }
  return COPY.unknown_error;
}

/**
 * Prefer curated copy for known codes. Unknown codes may use the server title
 * and detail, but only after redaction and only when they do not look internal.
 */
export function explainError(error: unknown): ErrorCopy {
  if (!isAppError(error)) {
    return COPY.unknown_error;
  }

  const mapped = copyForCode(error.code);
  if (Object.prototype.hasOwnProperty.call(COPY, error.code)) {
    return mapped;
  }

  const serverTitle = isPresentable(error.title) ? redactSecrets(error.title) : null;
  const serverDetail = isPresentable(error.detail) ? redactSecrets(error.detail) : null;

  return {
    title: serverTitle ?? COPY.unknown_error.title,
    message: serverDetail ?? COPY.unknown_error.message,
    action: COPY.unknown_error.action,
  };
}

/** Short, always-safe message for toasts and logs. */
export function errorText(error: unknown): string {
  const copy = explainError(error);
  return copy.message ? `${copy.title}: ${copy.message}` : copy.title;
}

/** Field-level errors from a 400 validation response. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  if (!isAppError(error) || !error.errors) return {};
  return error.errors;
}

export function isRetryable(error: unknown): boolean {
  if (!isAppError(error)) return false;
  return (
    error.code === "network_error" ||
    error.code === "timeout" ||
    error.status === 0 ||
    error.status >= 500
  );
}

/** Parse a Retry-After header (seconds or HTTP date) into seconds. */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}
