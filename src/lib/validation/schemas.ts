/**
 * Shared, meta-driven validation schemas (QLT-01).
 *
 * The server is authoritative. These schemas only reject what the user can fix
 * in the UI and always report the configured bound *and* the current value, so
 * a message is actionable without opening the API documentation.
 *
 * Every limit comes from `GET /api/v1/meta`; there are no hard-coded generator
 * lists or project limits in this module.
 */

import { z } from "zod";
import type {
  EndpointSettings,
  HttpMethod,
  MetaResponse,
  Schema,
  SchemaNode,
} from "@/lib/api/generated/schema";
import {
  analyzeSample,
  countBytes,
  MAX_PATH_LENGTH,
  validatePath,
} from "@/lib/wizard/validation";
import {
  schemaLimitProblems,
  summarizeSchema,
} from "@/lib/schema/tree";

export interface ValidationIssue {
  /** Dotted / bracket path suitable for a form field. */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** First issue per field, ready for inline form errors. */
  fieldErrors: Record<string, string[]>;
}

function toFieldErrors(issues: ValidationIssue[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

function toResult(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues, fieldErrors: toFieldErrors(issues) };
}

/** Convert a Zod failure into stable, serialisable issues. */
export function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".").replace(/\.(\d+)/g, "[$1]"),
    message: issue.message,
  }));
}

export function validateWith<T>(
  schema: z.ZodType<T>,
  value: unknown,
): ValidationResult & { data?: T } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ...toResult([]), data: parsed.data };
  return toResult(zodIssues(parsed.error));
}

export interface MetaLimitsLike {
  maxSampleBytes: number;
  maxProjectNameLength: number;
  maxEndpointsPerProject: number;
  maxSchemaDepth: number;
  maxSchemaNodes: number;
  maxListSize?: number;
  maxDelayMs?: number;
  maxErrorCodes?: number;
  maxRequestBodyBytes?: number;
}

export type ValidationMeta = Pick<
  MetaResponse,
  "limits" | "methods" | "delay" | "errorRate" | "listSize" | "pagination" | "errorRange"
>;

const DEFAULT_ERROR_RANGE = { min: 400, max: 599 };
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

function delayBounds(meta: ValidationMeta) {
  return {
    minMs: Math.max(0, meta.delay?.minMs ?? 0),
    maxMs: Math.max(0, meta.delay?.maxMs ?? meta.limits.maxDelayMs ?? 10_000),
  };
}

export function createMethodSchema(allowed: readonly string[]) {
  return z
    .string()
    .refine((value) => allowed.includes(value), {
      message: `Method must be one of ${allowed.join(", ")}.`,
    });
}

/**
 * The one path schema. It delegates to `validatePath`, so the wizard, the
 * endpoint editor and this schema can never disagree.
 */
export function createPathSchema(maxLength = MAX_PATH_LENGTH) {
  return z
    .string()
    .superRefine((value, ctx) => {
      const result = validatePath(value);
      for (const message of result.errors) {
        ctx.addIssue({
          code: "custom",
          message:
            message.includes(String(maxLength)) || !message.match(/\d/)
              ? message
              : `${message} (limit ${maxLength} characters; received ${[...value].length}.)`,
        });
      }
    })
    .describe("Endpoint path");
}

/** Optional project name; an empty string is valid and means "untitled". */
export function createProjectNameSchema(maxLength: number) {
  return z.string().superRefine((value, ctx) => {
    if (value.length === 0) return;
    if (value.trim().length === 0) {
      ctx.addIssue({ code: "custom", message: "Project name cannot be only whitespace." });
      return;
    }
    if ([...value].length > maxLength) {
      ctx.addIssue({
        code: "custom",
        message: `Project name must be ${maxLength} characters or fewer; this one is ${[...value].length}.`,
      });
    }
  });
}

/** Parsed sample text, bounded by the byte limit from meta. */
export function createSampleTextSchema(maxSampleBytes: number) {
  return z.string().superRefine((value, ctx) => {
    const analysis = analyzeSample(value, maxSampleBytes);
    if (!value.trim()) {
      ctx.addIssue({ code: "custom", message: "Paste a JSON sample or choose a template." });
      return;
    }
    if (analysis.jsonError) {
      const location =
        analysis.jsonError.line !== null
          ? ` (line ${analysis.jsonError.line}, column ${analysis.jsonError.column})`
          : "";
      ctx.addIssue({
        code: "custom",
        message: `The JSON is not valid${location}: ${analysis.jsonError.message}`,
      });
      return;
    }
    if (!analysis.withinLimit) {
      const actual = countBytes(value).toLocaleString("en-US");
      const limit = maxSampleBytes.toLocaleString("en-US");
      ctx.addIssue({
        code: "custom",
        message: `This sample is ${actual} bytes; the limit is ${limit} bytes (${Math.max(0, countBytes(value) - maxSampleBytes).toLocaleString("en-US")} over).`,
      });
    }
    if (analysis.rootError) {
      ctx.addIssue({ code: "custom", message: analysis.rootError });
    }
  });
}

export function createDelaySchema(meta: ValidationMeta) {
  const bounds = delayBounds(meta);
  return z
    .object({
      minMs: z
        .number()
        .int("Minimum delay must be a whole number of milliseconds.")
        .min(bounds.minMs, `Minimum delay must be at least ${bounds.minMs} ms.`)
        .max(bounds.maxMs, `Minimum delay must be ${bounds.maxMs} ms or less.`),
      maxMs: z
        .number()
        .int("Maximum delay must be a whole number of milliseconds.")
        .min(bounds.minMs, `Maximum delay must be at least ${bounds.minMs} ms.`)
        .max(bounds.maxMs, `Maximum delay must be ${bounds.maxMs} ms or less.`),
    })
    .superRefine((value, ctx) => {
      if (value.minMs > value.maxMs) {
        ctx.addIssue({
          code: "custom",
          path: ["maxMs"],
          message: `Minimum delay (${value.minMs} ms) must be less than or equal to maximum delay (${value.maxMs} ms).`,
        });
      }
    });
}

export function createErrorRateSchema(meta: ValidationMeta) {
  const max = meta.errorRate?.max ?? 100;
  const decimals = Math.max(0, meta.errorRate?.maxDecimals ?? 1);
  const step = 10 ** -decimals;
  return z
    .number()
    .min(0, "Error rate cannot be negative.")
    .max(max, `Error rate must be between 0 and ${max}%.`)
    .refine(
      (value) => {
        const percent = value * 100;
        return Math.abs(Math.round(percent / step) - percent / step) < 1e-9;
      },
      {
        message: `Error rate supports at most ${decimals} decimal place${decimals === 1 ? "" : "s"}.`,
      },
    );
}

export function createErrorInjectionSchema(meta: ValidationMeta) {
  const maxCodes = meta.limits.maxErrorCodes ?? 10;
  const range = meta.errorRange ?? DEFAULT_ERROR_RANGE;
  const minRate = 0;
  const maxRate = (meta.errorRate?.max ?? 100) / 100;

  return z
    .object({
      /** Fraction in 0..1, matching the API contract. */
      rate: z
        .number()
        .min(minRate, `Error rate must be between ${minRate * 100}% and ${maxRate * 100}%.`)
        .max(maxRate, `Error rate must be between ${minRate * 100}% and ${maxRate * 100}%.`)
        .refine(
          (value) => {
            const decimals = Math.max(0, meta.errorRate?.maxDecimals ?? 1);
            const step = 10 ** -decimals;
            const percent = value * 100;
            return Math.abs(Math.round(percent / step) - percent / step) < 1e-9;
          },
          {
            message: `Error rate supports at most ${Math.max(0, meta.errorRate?.maxDecimals ?? 1)} decimal place${Math.max(0, meta.errorRate?.maxDecimals ?? 1) === 1 ? "" : "s"}.`,
          },
        ),
      codes: z
        .array(
          z
            .number()
            .int(`Error codes must be whole numbers between ${range.min} and ${range.max}.`)
            .min(range.min, `Error codes must be between ${range.min} and ${range.max}.`)
            .max(range.max, `Error codes must be between ${range.min} and ${range.max}.`),
        )
        .min(1, "Choose at least one error code.")
        .max(maxCodes, `Choose ${maxCodes} error codes or fewer.`)
        .refine((codes) => new Set(codes).size === codes.length, {
          message: "Error codes must be unique.",
        }),
    })
    .superRefine((value, ctx) => {
      if (value.rate > 0 && value.codes.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["codes"],
          message: "Choose at least one error code when error injection is on.",
        });
      }
    });
}

export function createListSettingsSchema(meta: ValidationMeta) {
  const min = Math.max(0, meta.listSize?.min ?? 0);
  const max = Math.max(min, meta.listSize?.max ?? meta.limits.maxListSize ?? 1_000);

  return z
    .object({
      minSize: z
        .number()
        .int("Minimum list size must be a whole number.")
        .min(min, `Minimum list size must be between ${min} and ${max}.`)
        .max(max, `Minimum list size must be between ${min} and ${max}.`),
      maxSize: z
        .number()
        .int("Maximum list size must be a whole number.")
        .min(min, `Maximum list size must be between ${min} and ${max}.`)
        .max(max, `Maximum list size must be between ${min} and ${max}.`),
      path: z.string().nullable().default(null),
    })
    .superRefine((value, ctx) => {
      if (value.minSize > value.maxSize) {
        ctx.addIssue({
          code: "custom",
          path: ["maxSize"],
          message: `Minimum list size (${value.minSize}) must be less than or equal to maximum list size (${value.maxSize}).`,
        });
      }
    });
}

const JSON_POINTER_PATTERN = /^(?:\/(?:[^~/]|~[01])*)*$/;

function bindingSchema(label: string) {
  return z
    .string()
    .nullable()
    .refine(
      (value) => value === null || value === "" || JSON_POINTER_PATTERN.test(value),
      `The ${label} binding must be a JSON Pointer such as /meta/page, or empty.`,
    );
}

export function createPaginationSchema(meta: ValidationMeta) {
  const maxTotalItems = Math.max(0, meta.pagination?.maxTotalItems ?? 10_000);
  const maxLimitBound = Math.max(1, meta.pagination?.maxLimit ?? 100);

  return z
    .object({
      totalItems: z
        .number()
        .int("Total items must be a whole number.")
        .min(0, `Total items must be between 0 and ${maxTotalItems}.`)
        .max(maxTotalItems, `Total items must be between 0 and ${maxTotalItems}.`),
      defaultLimit: z
        .number()
        .int("Default limit must be a whole number.")
        .min(1, "Default limit must be at least 1.")
        .max(maxLimitBound, `Default limit must be ${maxLimitBound} or less.`),
      maxLimit: z
        .number()
        .int("Maximum limit must be a whole number.")
        .min(1, "Maximum limit must be at least 1.")
        .max(maxLimitBound, `Maximum limit must be ${maxLimitBound} or less.`),
      pageBinding: bindingSchema("page"),
      limitBinding: bindingSchema("limit"),
      totalBinding: bindingSchema("total"),
      totalPagesBinding: bindingSchema("total pages"),
      hasNextBinding: bindingSchema("has next"),
      hasPrevBinding: bindingSchema("has previous"),
    })
    .superRefine((value, ctx) => {
      if (value.defaultLimit > value.maxLimit) {
        ctx.addIssue({
          code: "custom",
          path: ["defaultLimit"],
          message: `Default limit (${value.defaultLimit}) must be less than or equal to maximum limit (${value.maxLimit}).`,
        });
      }
    });
}

/** Int32 from meta-independent API rules, or null/empty for a random seed. */
export function createSeedSchema() {
  return z
    .number()
    .int("Seed must be a whole number.")
    .min(INT32_MIN, `Seed must be ${INT32_MIN} or greater (Int32).`)
    .max(INT32_MAX, `Seed must be ${INT32_MAX} or less (Int32).`)
    .nullable();
}

export function createEndpointSettingsSchema(meta: ValidationMeta) {
  return z
    .object({
      successStatus: z
        .number()
        .int("Success status must be a whole number.")
        .min(100, "Success status must be a valid HTTP status between 100 and 599.")
        .max(599, "Success status must be a valid HTTP status between 100 and 599."),
      delay: createDelaySchema(meta),
      errorInjection: createErrorInjectionSchema(meta),
      list: createListSettingsSchema(meta),
      pagination: createPaginationSchema(meta).nullable(),
      seed: createSeedSchema(),
    })
    .describe("Endpoint settings");
}

export function validateEndpointSettings(
  settings: unknown,
  meta: ValidationMeta,
): ValidationResult & { data?: EndpointSettings } {
  return validateWith(createEndpointSettingsSchema(meta), settings);
}

/**
 * Schema shape limits that the server enforces: unique field names, maximum
 * depth, node count and probabilities. Generator ids are intentionally *not*
 * checked here; `/meta` owns that catalogue.
 */
export function createSchemaShapeSchema(_meta: ValidationMeta) {
  void _meta;
  return z.custom<Schema>((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      (value as { version?: unknown }).version !== 1 ||
      typeof (value as { root?: unknown }).root !== "object"
    ) {
      return false;
    }
    return true;
  }, "Schema must be an object with version 1 and a root node.");
}

function walkSchema(
  node: SchemaNode,
  visit: (node: SchemaNode, path: string, depth: number) => void,
  path = "",
  depth = 1,
): void {
  visit(node, path, depth);
  for (const field of node.fields ?? []) {
    walkSchema(field, visit, `${path}/${field.name}`, depth + 1);
  }
  if (node.items) walkSchema(node.items, visit, `${path}/0`, depth + 1);
}

export function validateSchemaShape(
  schema: Schema | null,
  meta: ValidationMeta,
): ValidationResult {
  if (!schema) {
    return toResult([{ path: "schema", message: "Infer or paste a schema first." }]);
  }

  const issues: ValidationIssue[] = [];
  const limits = { maxSchemaNodes: meta.limits.maxSchemaNodes, maxSchemaDepth: meta.limits.maxSchemaDepth };

  for (const problem of schemaLimitProblems(schema, limits)) {
    issues.push({ path: problem.field === "depth" ? "schema.depth" : "schema.nodes", message: problem.message });
  }

  walkSchema(schema.root, (node, path) => {
    if (!node.name?.trim() && path !== "") {
      issues.push({ path: `schema.${path}.name`, message: "Field name is required." });
    }
    if (node.type === "object") {
      const seen = new Set<string>();
      for (const field of node.fields ?? []) {
        if (seen.has(field.name)) {
          issues.push({
            path: `schema.${path || "/"}.${field.name}`,
            message: `Field name "${field.name}" is used more than once in the same object.`,
          });
        }
        seen.add(field.name);
      }
    }
    for (const [key, label] of [
      ["nullProbability", "Null probability"],
      ["omitProbability", "Omission probability"],
    ] as const) {
      const value = node[key];
      if (typeof value === "number" && (value < 0 || value > 1)) {
        issues.push({
          path: `schema.${path || "/"}.${key}`,
          message: `${label} must be between 0 and 1; received ${value}.`,
        });
      }
    }
    if (node.type === "array" && node.length) {
      if (node.length.min < 0 || node.length.max < 0) {
        issues.push({
          path: `schema.${path || "/"}.length`,
          message: "Array length bounds cannot be negative.",
        });
      } else if (node.length.min > node.length.max) {
        issues.push({
          path: `schema.${path || "/"}.length`,
          message: `Array minimum length (${node.length.min}) must be less than or equal to maximum length (${node.length.max}).`,
        });
      }
    }
  });

  return toResult(issues);
}

export interface PathCollisionCandidate {
  method: HttpMethod | string;
  path: string;
}

/**
 * Case-insensitive, template-name-insensitive key. `/Users/{id}` and
 * `/users/{userId}` are the same route to the server, so they must collide
 * before submit rather than after a failed request.
 */
export function normalizePathForComparison(path: string): string {
  const withoutTemplates = path.trim().replace(/\{[^}]*\}/g, "{}");
  const collapsed = withoutTemplates.replace(/\/+/g, "/").replace(/\/$/, "");
  return (collapsed || "/").toLowerCase();
}

export function endpointCollisionKey(candidate: PathCollisionCandidate): string {
  return `${candidate.method.toUpperCase()} ${normalizePathForComparison(candidate.path)}`;
}

export function findNormalizedPathCollision<T extends PathCollisionCandidate>(
  candidate: T,
  existing: readonly T[],
  { ignore }: { ignore?: (entry: T) => boolean } = {},
): T | null {
  const key = endpointCollisionKey(candidate);
  return (
    existing.find(
      (entry) => !ignore?.(entry) && endpointCollisionKey(entry) === key,
    ) ?? null
  );
}

/** Table-driven helper used by tests and forms. */
export function summariseSchema(schema: Schema | null) {
  return summarizeSchema(schema);
}
