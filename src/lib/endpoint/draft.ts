import type {
  EndpointSettings,
  MetaResponse,
  ProjectEndpoint,
  Schema,
} from "@/lib/api/generated/schema";
import { cloneSchema, createSchemaNode } from "@/lib/schema/edit";
import { ensureSchemaIds, schemaLimitProblems } from "@/lib/schema/tree";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { validatePath } from "@/lib/wizard/validation";

export interface EndpointSnapshot {
  method: ProjectEndpoint["method"];
  path: string;
  schema: Schema;
  settings: EndpointSettings;
}

export interface DraftProblem {
  field: string;
  message: string;
}

export function cloneSettings(settings: EndpointSettings): EndpointSettings {
  return {
    ...settings,
    delay: { ...settings.delay },
    errorInjection: {
      ...settings.errorInjection,
      codes: [...settings.errorInjection.codes],
    },
    list: { ...settings.list },
    pagination: settings.pagination ? { ...settings.pagination } : null,
  };
}

export function cloneSnapshot(snapshot: EndpointSnapshot): EndpointSnapshot {
  return {
    method: snapshot.method,
    path: snapshot.path,
    schema: cloneSchema(snapshot.schema),
    settings: cloneSettings(snapshot.settings),
  };
}

/**
 * Builds a complete editable snapshot. A missing schema gets a tiny empty
 * object root so the user can still repair the endpoint; IDs stay local and are
 * stripped before every write.
 */
export function createEndpointSnapshot(
  endpoint: ProjectEndpoint,
  meta: MetaResponse,
): EndpointSnapshot {
  const schema = endpoint.schema
    ? ensureSchemaIds(endpoint.schema)
    : ensureSchemaIds({
        version: 1,
        root: createSchemaNode("root", "object", meta),
      });

  return {
    method: endpoint.method,
    path: endpoint.path,
    schema,
    settings: cloneSettings(
      endpoint.settings ?? defaultEndpointSettings(endpoint.method, meta),
    ),
  };
}

/** Client-side checks that mirror the server rules we can know from /meta. */
export function validateEndpointDraft(
  snapshot: EndpointSnapshot,
  meta: MetaResponse,
): DraftProblem[] {
  const problems: DraftProblem[] = [];

  if (!meta.methods.includes(snapshot.method)) {
    problems.push({
      field: "method",
      message: `Method must be one of ${meta.methods.join(", ")}.`,
    });
  }

  const path = validatePath(snapshot.path);
  for (const message of path.errors) {
    problems.push({ field: "path", message });
  }

  for (const problem of schemaLimitProblems(snapshot.schema, meta.limits)) {
    problems.push({ field: `schema.${problem.field}`, message: problem.message });
  }

  const { settings } = snapshot;
  const maxDelay = meta.limits.maxDelayMs ?? meta.delay.maxMs;
  const maxList = meta.limits.maxListSize ?? meta.listSize.max;
  const maxErrorCodes = meta.limits.maxErrorCodes ?? 10;

  if (settings.delay.minMs < 0 || settings.delay.maxMs < 0) {
    problems.push({
      field: "settings.delay",
      message: "Delay values must not be negative.",
    });
  }
  if (settings.delay.minMs > settings.delay.maxMs) {
    problems.push({
      field: "settings.delay",
      message: "Minimum delay must not exceed the maximum.",
    });
  }
  if (settings.delay.minMs > maxDelay || settings.delay.maxMs > maxDelay) {
    problems.push({
      field: "settings.delay",
      message: `Delay must be ${maxDelay.toLocaleString("en-US")} ms or less.`,
    });
  }

  if (
    settings.errorInjection.rate < meta.errorRate.min ||
    settings.errorInjection.rate > meta.errorRate.max
  ) {
    problems.push({
      field: "settings.errorInjection.rate",
      message: `Error rate must be between ${meta.errorRate.min} and ${meta.errorRate.max}.`,
    });
  }
  if (
    settings.errorInjection.rate > 0 &&
    settings.errorInjection.codes.length === 0
  ) {
    problems.push({
      field: "settings.errorInjection.codes",
      message: "Add at least one error status code.",
    });
  }
  if (
    settings.errorInjection.codes.length > maxErrorCodes ||
    settings.errorInjection.codes.some(
      (code) => !Number.isInteger(code) || code < 400 || code > 599,
    )
  ) {
    problems.push({
      field: "settings.errorInjection.codes",
      message: `Use up to ${maxErrorCodes} error codes between 400 and 599.`,
    });
  }

  if (settings.list.minSize < 0 || settings.list.maxSize < 0) {
    problems.push({
      field: "settings.list",
      message: "List sizes must not be negative.",
    });
  }
  if (settings.list.minSize > settings.list.maxSize) {
    problems.push({
      field: "settings.list",
      message: "Minimum list size must not exceed the maximum.",
    });
  }
  if (settings.list.maxSize > maxList) {
    problems.push({
      field: "settings.list",
      message: `List size must be ${maxList.toLocaleString("en-US")} or less.`,
    });
  }

  if (settings.pagination) {
    if (settings.pagination.defaultLimit > settings.pagination.maxLimit) {
      problems.push({
        field: "settings.pagination",
        message: "Default limit must not exceed the max limit.",
      });
    }
    if (settings.pagination.maxLimit > meta.pagination.maxLimit) {
      problems.push({
        field: "settings.pagination",
        message: `Max limit must be ${meta.pagination.maxLimit} or less.`,
      });
    }
    if (
      settings.pagination.totalItems > meta.pagination.maxTotalItems
    ) {
      problems.push({
        field: "settings.pagination",
        message: `Total items must be ${meta.pagination.maxTotalItems.toLocaleString("en-US")} or less.`,
      });
    }
  }

  return problems;
}
