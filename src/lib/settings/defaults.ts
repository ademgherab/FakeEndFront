import type {
  EndpointPaginationSettings,
  EndpointSettings,
  HttpMethod,
  MetaResponse,
} from "@/lib/api/generated/schema";

/**
 * Defaults from §9.4. Bounds and success statuses always come from meta; the
 * literal values here are only the starting settings the user can edit.
 */
export function defaultEndpointSettings(
  method: HttpMethod,
  meta: Pick<MetaResponse, "successStatuses" | "errorRange">,
): EndpointSettings {
  const successStatus = meta.successStatuses[method] ?? 200;

  return {
    successStatus,
    delay: { minMs: 0, maxMs: 0 },
    errorInjection: { rate: 0, codes: [500] },
    list: { minSize: 10, maxSize: 10, path: null },
    pagination: null,
    seed: null,
  };
}

/** Pagination defaults from §9.4, bounded by the current meta payload. */
export function defaultPaginationSettings(
  meta: Pick<MetaResponse, "pagination">,
): EndpointPaginationSettings {
  return {
    totalItems: Math.min(100, meta.pagination.maxTotalItems),
    defaultLimit: Math.min(10, meta.pagination.maxLimit),
    maxLimit: meta.pagination.maxLimit,
    pageBinding: null,
    limitBinding: null,
    totalBinding: null,
    totalPagesBinding: null,
    hasNextBinding: null,
    hasPrevBinding: null,
  };
}
