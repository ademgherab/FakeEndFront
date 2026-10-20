import type { PreviewRequest, PreviewResponse } from "@/lib/api/generated/schema";
import { apiRequest } from "@/lib/api/client";
import { AppError } from "@/lib/errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePreviewResponse(raw: unknown): PreviewResponse {
  if (!isRecord(raw)) {
    throw new AppError({
      status: 0,
      code: "invalid_response",
      title: "The preview response is not usable",
      detail: "POST /api/v1/preview did not return a JSON object.",
    });
  }

  return {
    body: raw.body as PreviewResponse["body"],
    ...(typeof raw.byteSize === "number" ? { byteSize: raw.byteSize } : {}),
  };
}

/** POST /preview. Nothing is stored and writes are never retried. */
export async function previewEndpoint(
  request: PreviewRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<PreviewResponse> {
  const response = await apiRequest<unknown>("/preview", {
    method: "POST",
    body: request,
    signal,
    retry: false,
    fallbackCode: "generation_failed",
  });

  return normalizePreviewResponse(response.data);
}
