/**
 * Small, deterministic-enough inference and generation used by the MSW
 * contract mocks. It intentionally covers the common JSON shapes only; the
 * real API remains the authority and may return richer suggestions.
 */

import type {
  EndpointSettings,
  JsonValue,
  Schema,
  SchemaNode,
} from "@/lib/api/generated/schema";

export interface InferResult {
  schema: Schema;
  warnings: Array<{ path: string | null; code: string; message: string }>;
  suggestions: Array<{ path: string; code: string; message: string; generator?: string }>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https?:\/\//;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function generatorForString(name: string, values: unknown[]): string | undefined {
  const strings = values.filter((value): value is string => typeof value === "string");
  if (strings.length === 0) return undefined;
  if (strings.every((value) => EMAIL.test(value))) return "string.email";
  if (strings.every((value) => UUID.test(value))) return "string.uuid";
  if (strings.every((value) => DATE_TIME.test(value))) return "string.dateTime";
  if (strings.every((value) => DATE.test(value))) return "string.date";
  if (strings.every((value) => URL_PATTERN.test(value))) return "string.url";
  if (/^id$/i.test(name)) return "string.uuid";
  if (/^(first_?name|given_?name)$/i.test(name)) return "string.firstName";
  if (/^(last_?name|surname|family_?name)$/i.test(name)) return "string.lastName";
  if (/^(name|full_?name|display_?name)$/i.test(name)) return "string.fullName";
  if (/^(email|e_?mail|email_?address)$/i.test(name)) return "string.email";
  if (/^(url|website|link)$/i.test(name)) return "string.url";
  if (/^(created_?at|updated_?at|timestamp|date)$/i.test(name)) return "string.dateTime";
  if (/^(description|summary|bio|about)$/i.test(name)) return "string.paragraph";
  return undefined;
}

interface WalkResult {
  node: SchemaNode;
  warnings: InferResult["warnings"];
  suggestions: InferResult["suggestions"];
}

function inferNode(value: unknown, path: string, depth: number): WalkResult {
  const warnings: InferResult["warnings"] = [];
  const suggestions: InferResult["suggestions"] = [];

  if (value === null) {
    return {
      node: { name: "value", type: "null" },
      warnings,
      suggestions,
    };
  }

  if (typeof value === "boolean") {
    return { node: { name: "value", type: "boolean" }, warnings, suggestions };
  }

  if (typeof value === "number") {
    return {
      node: {
        name: "value",
        type: Number.isInteger(value) ? "integer" : "number",
      },
      warnings,
      suggestions,
    };
  }

  if (typeof value === "string") {
    const generator = generatorForString("value", [value]);
    if (generator && /id$/i.test(extractName(path)) && generator === "string.uuid") {
      suggestions.push({
        path,
        code: "use_uuid",
        message: "This field looks like an id. A UUID generator adds variety.",
        generator: "string.uuid",
      });
    }
    return {
      node: { name: "value", type: "string", ...(generator ? { generator } : {}) },
      warnings,
      suggestions,
    };
  }

  if (Array.isArray(value)) {
    if (depth >= 10) {
      warnings.push({
        path: path || null,
        code: "depth_limit",
        message: "Arrays nested deeper than 10 levels are truncated.",
      });
      return { node: { name: "value", type: "array", items: { name: "item", type: "string" } }, warnings, suggestions };
    }

    if (value.length === 0) {
      return {
        node: {
          name: "value",
          type: "array",
          items: { name: "item", type: "string" },
          length: { min: 1, max: 3 },
        },
        warnings,
        suggestions,
      };
    }

    const firstNonNull = value.find((entry) => entry !== null) ?? value[0];
    const item = inferNode(firstNonNull, `${path}/0`, depth + 1);
    item.node.name = "item";
    return {
      node: {
        name: "value",
        type: "array",
        items: item.node,
        length: { min: 1, max: Math.max(1, Math.min(10, value.length)) },
      },
      warnings: [...warnings, ...item.warnings],
      suggestions: item.suggestions,
    };
  }

  if (!isRecord(value)) {
    return { node: { name: "value", type: "string" }, warnings, suggestions };
  }

  if (depth >= 10) {
    warnings.push({
      path: path || null,
      code: "depth_limit",
      message: "Objects nested deeper than 10 levels are truncated.",
    });
    return { node: { name: "value", type: "object", fields: [] }, warnings, suggestions };
  }

  const fields: SchemaNode[] = [];
  for (const [name, entry] of Object.entries(value)) {
    const childPath = `${path}/${name}`;
    const child = inferNode(entry, childPath, depth + 1);
    child.node.name = name;

    if (typeof entry === "string") {
      const generator = generatorForString(name, [entry]);
      if (generator) {
        child.node.generator = generator;
      } else if (entry.length <= 40) {
        // Repeated short values are likely enums; keep them explicit.
        child.node.enumValues = [entry];
      }
      if (generator === "string.uuid" && /id$/i.test(name)) {
        child.suggestions.push({
          path: childPath,
          code: "use_uuid",
          message: "This field looks like an id. UUIDs make generated records distinguishable.",
          generator: "string.uuid",
        });
      }
    }

    if (entry === null) {
      warnings.push({
        path: childPath,
        code: "null_only",
        message: "Every sample value is null, so the field type is unknown. It defaults to null.",
      });
    }

    fields.push(child.node);
    warnings.push(...child.warnings);
    suggestions.push(...child.suggestions);
  }

  return {
    node: { name: "value", type: "object", fields },
    warnings,
    suggestions,
  };
}

function extractName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? "";
}

export function inferSample(sample: JsonValue, wrapInList = false): InferResult {
  if (sample === null || typeof sample !== "object") {
    throw new Error("sample_invalid");
  }

  const result = inferNode(sample, "", 1);
  if (wrapInList) {
    result.node = {
      name: "root",
      type: "array",
      items: { ...result.node, name: "item" },
      length: { min: 1, max: 5 },
    };
  } else {
    result.node.name = "root";
  }

  return {
    schema: { version: 1, root: result.node },
    warnings: dedupeWarnings(result.warnings),
    suggestions: result.suggestions,
  };
}

function dedupeWarnings(warnings: InferResult["warnings"]): InferResult["warnings"] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.path ?? ""}|${warning.code}|${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function hashSeed(seed: number | null): number {
  if (seed === null) return (Math.random() * 2 ** 32) >>> 0;
  const value = seed >>> 0;
  return value || 0x9e3779b9;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface GenerateContext {
  random: () => number;
  sequence: number;
}

const FIRST_NAMES = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Katherine", "Edsger", "Radia"];
const LAST_NAMES = ["Lovelace", "Hopper", "Torvalds", "Hamilton", "Turing", "Johnson", "Dijkstra", "Perlman"];

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

function generateString(node: SchemaNode, ctx: GenerateContext): string {
  if (node.enumValues && node.enumValues.length > 0) {
    const value = pick(node.enumValues, ctx.random);
    return String(value);
  }
  switch (node.generator) {
    case "string.email":
      return `${pick(FIRST_NAMES, ctx.random).toLowerCase()}.${pick(LAST_NAMES, ctx.random).toLowerCase()}@example.com`;
    case "string.uuid": {
      const hex = () => Math.floor(ctx.random() * 16).toString(16);
      const group = (length: number) => Array.from({ length }, hex).join("");
      return `${group(8)}-${group(4)}-4${group(3)}-a${group(3)}-${group(12)}`;
    }
    case "string.firstName":
      return pick(FIRST_NAMES, ctx.random);
    case "string.lastName":
      return pick(LAST_NAMES, ctx.random);
    case "string.fullName":
      return `${pick(FIRST_NAMES, ctx.random)} ${pick(LAST_NAMES, ctx.random)}`;
    case "string.url":
      return `https://example.com/${Math.floor(ctx.random() * 10_000)}`;
    case "string.date":
      return new Date(Date.UTC(2026, 0, 1 + Math.floor(ctx.random() * 300)))
        .toISOString()
        .slice(0, 10);
    case "string.dateTime":
      return new Date(Date.UTC(2026, 0, 1 + Math.floor(ctx.random() * 300), 12)).toISOString();
    case "string.paragraph":
      return "A generated description for the demo project.";
    default:
      return node.name && node.name !== "root" && node.name !== "item"
        ? `${node.name} sample`
        : "sample";
  }
}

function generateValue(node: SchemaNode, ctx: GenerateContext): JsonValue {
  if (node.constant !== undefined) return node.constant;

  if (typeof node.nullProbability === "number" && ctx.random() < node.nullProbability) {
    return null;
  }

  switch (node.type) {
    case "null":
      return null;
    case "boolean":
      return ctx.random() > 0.5;
    case "integer":
      return Math.floor(ctx.random() * 1_000);
    case "number":
      return Math.round(ctx.random() * 10_000) / 100;
    case "string":
      return generateString(node, ctx);
    case "array": {
      const min = Math.max(0, node.length?.min ?? 1);
      const max = Math.max(min, node.length?.max ?? 5);
      const count = Math.min(50, min + Math.floor(ctx.random() * (max - min + 1)));
      return Array.from({ length: count }, () =>
        generateValue(node.items ?? { name: "item", type: "string" }, ctx),
      );
    }
    case "object": {
      const result: Record<string, JsonValue> = {};
      for (const field of node.fields ?? []) {
        if (
          typeof field.omitProbability === "number" &&
          field.omitProbability > 0 &&
          ctx.random() < field.omitProbability
        ) {
          continue;
        }
        result[field.name] = generateValue(field, ctx);
      }
      return result;
    }
    default:
      return null;
  }
}

export interface GeneratedBody {
  body: JsonValue;
  byteSize: number;
}

function setAtPointer(root: JsonValue, pointer: string | null, value: JsonValue): JsonValue {
  if (!pointer || pointer === "/") return value;
  const tokens = pointer
    .split("/")
    .slice(1)
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cursor: unknown = root;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index] as string;
    if (Array.isArray(cursor)) cursor = cursor[Number(token)];
    else if (isRecord(cursor)) cursor = cursor[token];
    else return root;
  }
  const last = tokens[tokens.length - 1] as string;
  if (Array.isArray(cursor)) cursor[Number(last)] = value;
  else if (isRecord(cursor)) cursor[last] = value;
  return root;
}

export function generatePreview(
  schema: Schema,
  settings: EndpointSettings,
  { page, limit }: { page?: number; limit?: number } = {},
): GeneratedBody {
  const ctx: GenerateContext = {
    random: mulberry32(hashSeed(settings.seed)),
    sequence: 0,
  };

  const listCount = Math.max(
    settings.list.minSize,
    Math.min(
      settings.list.maxSize,
      settings.list.minSize +
        Math.floor(ctx.random() * (settings.list.maxSize - settings.list.minSize + 1)),
    ),
  );

  let body: JsonValue;
  if (schema.root.type === "array") {
    const count = Math.min(50, listCount);
    body = Array.from({ length: count }, () => generateValue(schema.root.items ?? { name: "item", type: "string" }, ctx));
  } else if (schema.root.type === "object") {
    body = generateValue(schema.root, ctx);
  } else {
    body = generateValue(schema.root, ctx);
  }

  // Pagination wraps the generated list in the documented envelope when the
  // settings define bindings; otherwise the body is left untouched.
  if (settings.pagination) {
    const total = settings.pagination.totalItems;
    const pageSize = Math.max(1, Math.min(settings.pagination.maxLimit, limit ?? settings.pagination.defaultLimit));
    const currentPage = Math.max(1, Math.floor(page ?? 1));
    const items = Array.isArray(body)
      ? body
      : [body];
    const expanded = Array.from(
      { length: Math.min(total, 500) },
      (_, index) => items[index % Math.max(1, items.length)] ?? null,
    );
    const start = (currentPage - 1) * pageSize;
    const pageItems = expanded.slice(start, start + pageSize);
    const envelope: Record<string, JsonValue> = {
      items: pageItems,
      page: currentPage,
      limit: pageSize,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNext: start + pageSize < total,
      hasPrev: currentPage > 1,
    };
    body = envelope;
  } else if (settings.list.path) {
    body = setAtPointer(body, settings.list.path, Array.isArray(body) ? body : [body]);
  }

  return {
    body,
    byteSize: new TextEncoder().encode(JSON.stringify(body)).length,
  };
}
