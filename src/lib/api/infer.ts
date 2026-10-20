import type {
  InferRequest,
  InferResponse,
  InferSuggestion,
  InferWarning,
  Schema,
} from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWarnings(value: unknown): InferWarning[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.code !== "string") return [];
    if (entry.path !== undefined && entry.path !== null && typeof entry.path !== "string") {
      return [];
    }
    const message = typeof entry.message === "string" ? entry.message : "";
    const path = typeof entry.path === "string" ? entry.path : null;
    return [{ path, code: entry.code, message }];
  });
}

function normalizeSuggestions(value: unknown): InferSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.code !== "string") return [];
    const path = typeof entry.path === "string" ? entry.path : "";
    const message = typeof entry.message === "string" ? entry.message : "";
    const generator = typeof entry.generator === "string" ? entry.generator : undefined;
    return [{ path, code: entry.code, message, generator }];
  });
}

export function normalizeInferResponse(raw: unknown): InferResponse {
  if (!isRecord(raw)) {
    throw new AppError({
      status: 0,
      code: "invalid_response",
      title: "The inference response is not usable",
      detail: "POST /api/v1/infer did not return a JSON object.",
    });
  }

  const schema = raw.schema;
  if (
    !isRecord(schema) ||
    schema.version !== 1 ||
    !isRecord(schema.root) ||
    typeof schema.root.type !== "string"
  ) {
    throw new AppError({
      status: 0,
      code: "invalid_response",
      title: "The inference response is not usable",
      detail: "POST /api/v1/infer returned a malformed schema.",
    });
  }

  return {
    schema: schema as unknown as Schema,
    warnings: normalizeWarnings(raw.warnings),
    suggestions: normalizeSuggestions(raw.suggestions),
  };
}

/**
 * POST /infer. No token is needed, nothing is stored server-side, and the
 * request is never retried automatically.
 */
export async function inferSchema(
  request: InferRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<InferResponse> {
  const response = await apiRequest<unknown>("/infer", {
    method: "POST",
    body: request,
    signal,
    retry: false,
    fallbackCode: "sample_invalid",
  });

  return normalizeInferResponse(response.data);
}
