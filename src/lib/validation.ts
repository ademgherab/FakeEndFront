import type { EndpointSettings, MetaLimits, Method, Schema } from "@/lib/types";
import {
  FALLBACK_META,
  LIMITS,
  METHODS,
  SUCCESS_STATUSES,
  DEFAULT_SUCCESS_STATUS,
} from "@/lib/defaults";
import { leafTypeOf, resolveSchemaNode } from "@/lib/schema-pointer";

export type FieldErrors = Record<string, string[]>;

export interface PathValidation {
  valid: boolean;
  value: string;
  errors: string[];
}

/** Trim, add a leading `/`, then reject characters the backend does not allow. */
export function normalizePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function validatePath(
  raw: string,
  maxLength: number = LIMITS.path.maxLength,
): PathValidation {
  const value = normalizePath(raw);
  if (!value) {
    return { valid: false, value, errors: ["Path is required."] };
  }
  if (value.length > maxLength) {
    return {
      valid: false,
      value,
      errors: [`Path must be ${maxLength} characters or fewer.`],
    };
  }
  if (/\s/.test(value)) {
    return { valid: false, value, errors: ["Path must not contain spaces."] };
  }
  if (value.includes("?") || value.includes("#")) {
    return {
      valid: false,
      value,
      errors: ["Path must not contain `?` or `#`."],
    };
  }
  return { valid: true, value, errors: [] };
}

export interface SampleParse {
  ok: boolean;
  value: unknown;
  rootIsArray: boolean;
  isEmpty: boolean;
  error: string | null;
}

/** Parse the raw sample text locally. Empty input is not an error. */
export function parseSample(text: string): SampleParse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, value: null, rootIsArray: false, isEmpty: true, error: null };
  }

  try {
    const value: unknown = JSON.parse(trimmed);
    return {
      ok: true,
      value,
      rootIsArray: Array.isArray(value),
      isEmpty: false,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      rootIsArray: false,
      isEmpty: false,
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function decimalPlaces(value: number): number {
  const text = String(value);
  const index = text.indexOf(".");
  return index === -1 ? 0 : text.length - index - 1;
}

export interface SettingsValidation {
  valid: boolean;
  errors: FieldErrors;
}

export function validateSettings(
  settings: EndpointSettings,
  method: Method,
  limits: MetaLimits = FALLBACK_META.limits,
  errorRange: { min: number; max: number } = FALLBACK_META.errorStatusRange,
): SettingsValidation {
  const errors: FieldErrors = {};
  const maxDelayMs = limits.maxDelayMs;
  const maxListSize = limits.maxListSize;
  const maxErrorCodes = limits.maxErrorStatusCodes;

  if (!METHODS.includes(method)) {
    errors.method = [`Method must be one of ${METHODS.join(", ")}.`];
  }

  const successStatus = settings.successStatus;
  if (
    successStatus !== undefined &&
    !SUCCESS_STATUSES.includes(successStatus as never)
  ) {
    errors.successStatus = [
      `Success status must be one of ${SUCCESS_STATUSES.join(", ")}.`,
    ];
  }

  const minMs = settings.delay?.minMs;
  const maxMs = settings.delay?.maxMs;
  if (
    minMs !== undefined &&
    (!isInteger(minMs) || minMs < LIMITS.delay.minMs || minMs > maxDelayMs)
  ) {
    errors["delay.minMs"] = [
      `Delay must be between ${LIMITS.delay.minMs} and ${maxDelayMs} ms.`,
    ];
  }
  if (
    maxMs !== undefined &&
    (!isInteger(maxMs) || maxMs < LIMITS.delay.minMs || maxMs > maxDelayMs)
  ) {
    errors["delay.maxMs"] = [
      `Delay must be between ${LIMITS.delay.minMs} and ${maxDelayMs} ms.`,
    ];
  }
  if (minMs !== undefined && maxMs !== undefined && minMs > maxMs) {
    errors["delay.maxMs"] = [
      "Maximum delay must be greater than or equal to the minimum.",
    ];
  }

  const rate = settings.errors?.ratePercent;
  if (
    rate !== undefined &&
    (!Number.isFinite(rate) || rate < 0 || rate > 100)
  ) {
    errors["errors.ratePercent"] = ["Error rate must be between 0 and 100."];
  } else if (rate !== undefined && decimalPlaces(rate) > LIMITS.errorRate.maxDecimals) {
    errors["errors.ratePercent"] = [
      "Error rate allows at most one decimal place.",
    ];
  }

  const codes = settings.errors?.statusCodes ?? [];
  if (rate !== undefined && rate > 0 && codes.length === 0) {
    errors["errors.statusCodes"] = [
      "Choose at least one error code when the rate is above 0.",
    ];
  }
  if (codes.length > maxErrorCodes) {
    errors["errors.statusCodes"] = [
      `Choose at most ${maxErrorCodes} error codes.`,
    ];
  }
  const invalidCode = codes.some(
    (code) => !isInteger(code) || code < errorRange.min || code > errorRange.max,
  );
  if (invalidCode) {
    errors["errors.statusCodes"] = [
      `Error codes must be between ${errorRange.min} and ${errorRange.max}.`,
    ];
  }
  if (new Set(codes).size !== codes.length) {
    errors["errors.statusCodes"] = ["Error codes must be unique."];
  }

  const listMin = settings.list?.size?.min;
  const listMax = settings.list?.size?.max;
  if (
    listMin !== undefined &&
    (!isInteger(listMin) || listMin < 0 || listMin > maxListSize)
  ) {
    errors["list.size.min"] = [
      `List size must be between 0 and ${maxListSize}.`,
    ];
  }
  if (
    listMax !== undefined &&
    (!isInteger(listMax) || listMax < 0 || listMax > maxListSize)
  ) {
    errors["list.size.max"] = [
      `List size must be between 0 and ${maxListSize}.`,
    ];
  }
  if (listMin !== undefined && listMax !== undefined && listMin > listMax) {
    errors["list.size.max"] = [
      "Maximum list size must be greater than or equal to the minimum.",
    ];
  }

  const pagination = settings.pagination;
  const maxLimit = pagination?.maxLimit;
  const defaultLimit = pagination?.defaultLimit;
  const totalItems = pagination?.totalItems;

  if (
    totalItems !== undefined &&
    (!isInteger(totalItems) ||
      totalItems < 0 ||
      totalItems > limits.maxPaginationTotalItems)
  ) {
    errors["pagination.totalItems"] = [
      `Total items must be between 0 and ${limits.maxPaginationTotalItems}.`,
    ];
  }
  if (
    maxLimit !== undefined &&
    (!isInteger(maxLimit) ||
      maxLimit < LIMITS.pagination.limit.min ||
      maxLimit > limits.maxPaginationLimit)
  ) {
    errors["pagination.maxLimit"] = [
      `Maximum limit must be between ${LIMITS.pagination.limit.min} and ${limits.maxPaginationLimit}.`,
    ];
  }
  if (
    defaultLimit !== undefined &&
    (!isInteger(defaultLimit) ||
      defaultLimit < LIMITS.pagination.limit.min ||
      (maxLimit !== undefined && defaultLimit > maxLimit))
  ) {
    errors["pagination.defaultLimit"] = [
      maxLimit !== undefined
        ? `Default limit must be between ${LIMITS.pagination.limit.min} and ${maxLimit}.`
        : `Default limit must be at least ${LIMITS.pagination.limit.min}.`,
    ];
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** The leaf type each pagination binding has to point at. */
export const BINDING_LEAF_TYPES = {
  page: "integer",
  limit: "integer",
  total: "integer",
  totalPages: "integer",
  hasNext: "boolean",
  hasPrev: "boolean",
} as const;

export type BindingName = keyof typeof BINDING_LEAF_TYPES;

/**
 * Checks the settings that can only be validated against the schema: the
 * list path and the pagination bindings. A binding pointer must resolve to a
 * leaf of the expected type.
 */
export function validateSettingsAgainstSchema(
  settings: EndpointSettings,
  schema: Schema | null,
): SettingsValidation {
  const errors: FieldErrors = {};
  if (!schema) return { valid: true, errors };

  const root = schema.root;
  const listPath = settings.list?.path ?? null;
  const pagination = settings.pagination;

  const rootIsArray = root.type === "array";
  if (listPath !== null && listPath !== undefined) {
    if (!listPath.startsWith("/")) {
      errors["list.path"] = [
        "List path must be an RFC 6901 pointer that starts with `/`.",
      ];
    } else if (!resolveSchemaNode(root, listPath)) {
      errors["list.path"] = ["List path does not exist in the schema."];
    } else if (resolveSchemaNode(root, listPath)?.type !== "array") {
      errors["list.path"] = ["List path must point to an array."];
    }
  }

  const hasList = rootIsArray || Boolean(listPath);
  if (pagination?.enabled && !hasList) {
    errors["pagination.enabled"] = [
      "Pagination requires a list: use an array root or set a list path.",
    ];
  }

  const bindings = pagination?.bindings ?? {};
  for (const name of Object.keys(BINDING_LEAF_TYPES) as BindingName[]) {
    const pointer = bindings[name];
    if (pointer === null || pointer === undefined || pointer === "") continue;
    if (!pointer.startsWith("/")) {
      errors[`pagination.bindings.${name}`] = [
        "Binding must be an RFC 6901 pointer that starts with `/`.",
      ];
      continue;
    }
    const node = resolveSchemaNode(root, pointer);
    if (!node) {
      errors[`pagination.bindings.${name}`] = [
        "Binding does not resolve to a value in the schema.",
      ];
      continue;
    }
    const expected = BINDING_LEAF_TYPES[name];
    const actual = leafTypeOf(node);
    if (actual !== expected) {
      errors[`pagination.bindings.${name}`] = [
        `Binding must point to a ${expected} value, but it points to a ${actual ?? "non-leaf"} value.`,
      ];
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function methodDefaultStatus(method: Method): number {
  return DEFAULT_SUCCESS_STATUS[method];
}
