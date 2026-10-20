import { joinUrl } from "@/lib/config";
import { pathTemplateNames } from "@/lib/wizard/validation";

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

export interface RuntimeUrlInput {
  /** Full URL returned by the API, possibly containing `{param}` templates. */
  endpointUrl?: string | null;
  baseUrl: string;
  path: string;
  pathParams: Record<string, string>;
  queryParams: KeyValueRow[];
}

export interface RuntimeUrlResult {
  url: string | null;
  missing: string[];
  invalidQueryKeys: string[];
}

/** Parameters required by `path`, in order of appearance. */
export function requiredPathParams(path: string): string[] {
  return pathTemplateNames(path);
}

/**
 * Builds the runtime URL and URL-encodes every user value. Returns `missing`
 * instead of guessing a value, so the caller can block the request.
 */
export function buildRuntimeUrl({
  endpointUrl,
  baseUrl,
  path,
  pathParams,
  queryParams,
}: RuntimeUrlInput): RuntimeUrlResult {
  const template =
    endpointUrl && endpointUrl.trim()
      ? endpointUrl.trim()
      : joinUrl(baseUrl, path);

  const names = pathTemplateNames(path);
  const missing: string[] = [];
  let url = template;

  for (const name of names) {
    const raw = pathParams[name]?.trim() ?? "";
    if (!raw) {
      missing.push(name);
      continue;
    }
    // Replace all occurrences in case the server's URL template repeats one.
    url = url.split(`{${name}}`).join(encodeURIComponent(raw));
  }

  const invalidQueryKeys: string[] = [];
  const search = new URLSearchParams();
  const existingQuery = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  if (existingQuery) {
    for (const [key, value] of new URLSearchParams(existingQuery)) {
      search.append(key, value);
    }
    url = url.slice(0, url.indexOf("?"));
  }

  for (const row of queryParams) {
    const key = row.key.trim();
    if (!key) {
      if (row.value.trim()) invalidQueryKeys.push("(empty key)");
      continue;
    }
    search.append(key, row.value);
  }

  const suffix = search.toString();
  return {
    url: `${url}${suffix ? `?${suffix}` : ""}`,
    missing,
    invalidQueryKeys,
  };
}

export interface BodyValidation {
  valid: boolean;
  hasBody: boolean;
  value?: unknown;
  error?: string;
}

/** JSON body validation for POST/PUT. GET and DELETE never send a body. */
export function validateRequestBody(text: string, method: string): BodyValidation {
  if (method === "GET" || method === "DELETE") {
    return { valid: true, hasBody: false };
  }
  if (!text.trim()) return { valid: true, hasBody: false };

  try {
    return { valid: true, hasBody: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      valid: false,
      hasBody: true,
      error: error instanceof Error ? error.message : "The body is not valid JSON.",
    };
  }
}

/** Headers the runtime is documented to expose through CORS. */
export const RUNTIME_HEADERS = [
  "x-request-id",
  "x-mock-delay-ms",
  "x-mock-injected-error",
  "x-total-count",
  "x-page",
  "x-limit",
  "x-total-pages",
  "x-has-next",
  "x-has-prev",
  "retry-after",
] as const;

export interface RuntimeHeader {
  name: string;
  value: string;
}

export function readRuntimeHeaders(headers: Headers): RuntimeHeader[] {
  const result: RuntimeHeader[] = [];
  for (const name of RUNTIME_HEADERS) {
    const value = headers.get(name);
    if (value !== null) result.push({ name, value });
  }
  return result;
}

export function injectedErrorFromHeaders(headers: Headers): string | null {
  return headers.get("x-mock-injected-error");
}

export function statusCategory(status: number): string {
  if (status === 0) return "No response";
  if (status < 200) return "Informational";
  if (status < 300) return "Success";
  if (status < 400) return "Redirect";
  if (status < 500) return "Client error";
  return "Server error";
}
