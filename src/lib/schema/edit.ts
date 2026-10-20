import type {
  JsonValue,
  MetaGenerator,
  MetaResponse,
  Schema,
  SchemaNode,
  SchemaNodeType,
} from "@/lib/api/generated/schema";
import { newSchemaNodeId } from "@/lib/schema/tree";

export const SCHEMA_NODE_TYPES: SchemaNodeType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
];

export const LEAF_TYPES: SchemaNodeType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "null",
];

export function generatorsForType(
  generators: MetaGenerator[],
  type: SchemaNodeType,
): MetaGenerator[] {
  return generators.filter((generator) =>
    generator.appliesTo.some((entry) => entry === type),
  );
}

function defaultValueFor(param: MetaGenerator["params"][number]): JsonValue {
  if (param.default !== undefined) return param.default;
  switch (param.type) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    default:
      return "";
  }
}

export interface GeneratorDefaults {
  generator?: string;
  generatorParams?: Record<string, JsonValue>;
}

/** Pick the first generator that declares support for the node type. */
export function defaultGeneratorFor(
  type: SchemaNodeType,
  meta: Pick<MetaResponse, "generators">,
): GeneratorDefaults {
  const generator = generatorsForType(meta.generators, type)[0];
  if (!generator) return {};
  const params: Record<string, JsonValue> = {};
  for (const param of generator.params) {
    params[param.name] = defaultValueFor(param);
  }
  return { generator: generator.id, generatorParams: params };
}

export function createSchemaNode(
  name: string,
  type: SchemaNodeType,
  meta: Pick<MetaResponse, "generators">,
): SchemaNode {
  const base: SchemaNode = {
    id: newSchemaNodeId(),
    name,
    type,
    nullProbability: 0,
    omitProbability: 0,
  };
  if (type === "object") return { ...base, fields: [] };
  if (type === "array") {
    return {
      ...base,
      length: { min: 1, max: 10 },
      items: createSchemaNode("item", "string", meta),
    };
  }
  return { ...base, ...defaultGeneratorFor(type, meta) };
}

function cloneNode(node: SchemaNode): SchemaNode {
  return {
    ...node,
    generatorParams: node.generatorParams ? { ...node.generatorParams } : undefined,
    enumValues: node.enumValues ? [...node.enumValues] : undefined,
    constant: node.constant,
    length: node.length ? { ...node.length } : undefined,
    fields: node.fields ? node.fields.map(cloneNode) : undefined,
    items: node.items ? cloneNode(node.items) : undefined,
  };
}

export function cloneSchema(schema: Schema): Schema {
  return { version: 1, root: cloneNode(schema.root) };
}

export function updateNode(
  schema: Schema,
  id: string,
  updater: (node: SchemaNode) => SchemaNode,
): Schema {
  const walk = (node: SchemaNode): SchemaNode => {
    if (node.id === id) return updater(cloneNode(node));
    if (node.fields) {
      return { ...node, fields: node.fields.map(walk) };
    }
    if (node.items) {
      return { ...node, items: walk(node.items) };
    }
    return node;
  };
  return { version: 1, root: walk(schema.root) };
}

export function findSiblings(node: SchemaNode): SchemaNode[] {
  return node.fields ?? [];
}

export function fieldNameError(
  schema: Schema,
  nodeId: string,
  name: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Field name is required.";
  if (name !== trimmed) return "Field name must not start or end with spaces.";
  if (/\s/.test(trimmed)) return "Field name must not contain spaces.";
  if (trimmed.length > 120) return "Field name must be 120 characters or fewer.";

  let siblings: SchemaNode[] | null = null;
  const walk = (node: SchemaNode): void => {
    if (siblings) return;
    if (node.fields?.some((field) => field.id === nodeId)) {
      siblings = node.fields;
      return;
    }
    for (const field of node.fields ?? []) walk(field);
    if (!siblings && node.items) walk(node.items);
  };
  walk(schema.root);

  if (siblings) {
    const duplicate = (siblings as SchemaNode[]).some(
      (field) => field.id !== nodeId && field.name === trimmed,
    );
    if (duplicate) return `"${trimmed}" is already used by a sibling field.`;
  }
  return null;
}

export function renameNode(schema: Schema, id: string, name: string): Schema {
  return updateNode(schema, id, (node) => ({ ...node, name: name.trim() }));
}

export function changeNodeType(
  schema: Schema,
  id: string,
  type: SchemaNodeType,
  meta: Pick<MetaResponse, "generators">,
): Schema {
  return updateNode(schema, id, (node) => {
    const next: SchemaNode = { ...node, type };
    delete next.fields;
    delete next.items;
    delete next.enumValues;
    delete next.constant;
    delete next.length;
    delete next.generator;
    delete next.generatorParams;

    if (type === "object") {
      next.fields = [];
    } else if (type === "array") {
      next.length = { min: 1, max: 10 };
      next.items = createSchemaNode("item", "string", meta);
    } else {
      Object.assign(next, defaultGeneratorFor(type, meta));
    }
    return next;
  });
}

export function setGenerator(
  schema: Schema,
  id: string,
  generatorId: string,
  meta: Pick<MetaResponse, "generators">,
): Schema {
  return updateNode(schema, id, (node) => {
    const generator = meta.generators.find((entry) => entry.id === generatorId);
    if (!generator) return node;
    const params: Record<string, JsonValue> = {};
    for (const param of generator.params) {
      params[param.name] = node.generatorParams?.[param.name] ?? defaultValueFor(param);
    }
    const next: SchemaNode = { ...node, generator: generator.id, generatorParams: params };
    delete next.constant;
    return next;
  });
}

export function setGeneratorParam(
  schema: Schema,
  id: string,
  param: string,
  value: JsonValue,
): Schema {
  return updateNode(schema, id, (node) => ({
    ...node,
    generatorParams: { ...(node.generatorParams ?? {}), [param]: value },
  }));
}

export function setProbability(
  schema: Schema,
  id: string,
  key: "nullProbability" | "omitProbability",
  percent: number,
): Schema {
  const fraction = Math.min(1, Math.max(0, percent / 100));
  return updateNode(schema, id, (node) => ({
    ...node,
    [key]: Math.round(fraction * 1000) / 1000,
  }));
}

export function setEnumValues(schema: Schema, id: string, values: JsonValue[]): Schema {
  return updateNode(schema, id, (node) => ({
    ...node,
    enumValues: values,
    constant: undefined,
  }));
}

export function setConstant(schema: Schema, id: string, value: JsonValue): Schema {
  return updateNode(schema, id, (node) => {
    const next: SchemaNode = { ...node, constant: value };
    delete next.generator;
    delete next.generatorParams;
    delete next.enumValues;
    return next;
  });
}

export function clearConstant(schema: Schema, id: string): Schema {
  return updateNode(schema, id, (node) => {
    const next: SchemaNode = { ...node };
    delete next.constant;
    return next;
  });
}

export function setArrayLength(
  schema: Schema,
  id: string,
  min: number,
  max: number,
): Schema {
  return updateNode(schema, id, (node) => ({
    ...node,
    length: {
      min: Math.max(0, Math.min(min, max)),
      max: Math.max(Math.max(0, min), max),
    },
  }));
}

function uniqueFieldName(fields: SchemaNode[]): string {
  const names = new Set(fields.map((field) => field.name));
  if (!names.has("field")) return "field";
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `field${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `field_${newSchemaNodeId()}`;
}

export interface AddFieldResult {
  schema: Schema;
  id: string;
}

export function addField(
  schema: Schema,
  parentId: string,
  meta: Pick<MetaResponse, "generators">,
): AddFieldResult | null {
  const parent = findNode(schema, parentId);
  if (!parent) return null;

  if (parent.type === "object") {
    const node = createSchemaNode(uniqueFieldName(parent.fields ?? []), "string", meta);
    const id = node.id ?? newSchemaNodeId();
    return {
      schema: updateNode(schema, parentId, (current) => ({
        ...current,
        fields: [...(current.fields ?? []), node],
      })),
      id,
    };
  }

  if (parent.type === "array") {
    const node = createSchemaNode("item", "string", meta);
    const id = node.id ?? newSchemaNodeId();
    return {
      schema: updateNode(schema, parentId, (current) => ({ ...current, items: node })),
      id,
    };
  }

  return null;
}

export function removeNode(schema: Schema, id: string): Schema {
  if (schema.root.id === id) return schema;

  const walk = (node: SchemaNode): SchemaNode => {
    const fields = node.fields?.filter((field) => field.id !== id);
    const items = node.items?.id === id ? undefined : node.items;
    const changed =
      (node.fields && fields && fields.length !== node.fields.length) ||
      (node.items && items === undefined);
    const next: SchemaNode = { ...node };
    if (changed) {
      if (fields) next.fields = fields;
      if (items === undefined) delete next.items;
    }
    if (next.fields) next.fields = next.fields.map(walk);
    if (next.items) next.items = walk(next.items);
    return next;
  };

  return { version: 1, root: walk(schema.root) };
}

export function findNode(schema: Schema, id: string): SchemaNode | null {
  if (schema.root.id === id) return schema.root;
  const walk = (node: SchemaNode): SchemaNode | null => {
    for (const field of node.fields ?? []) {
      if (field.id === id) return field;
      const nested = walk(field);
      if (nested) return nested;
    }
    if (node.items) {
      if (node.items.id === id) return node.items;
      return walk(node.items);
    }
    return null;
  };
  return walk(schema.root);
}

export function findParent(schema: Schema, id: string): SchemaNode | null {
  const walk = (node: SchemaNode): SchemaNode | null => {
    if (node.fields?.some((field) => field.id === id)) return node;
    if (node.items?.id === id) return node;
    for (const field of node.fields ?? []) {
      const parent = walk(field);
      if (parent) return parent;
    }
    if (node.items) return walk(node.items);
    return null;
  };
  return walk(schema.root);
}

export function moveField(
  schema: Schema,
  id: string,
  direction: -1 | 1,
): Schema {
  const parent = findParent(schema, id);
  if (!parent?.fields) return schema;
  const index = parent.fields.findIndex((field) => field.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= parent.fields.length) return schema;
  const parentId = parent.id;
  if (!parentId) return schema;

  return updateNode(schema, parentId, (node) => {
    const fields = [...(node.fields ?? [])];
    const current = fields[index];
    const next = fields[target];
    if (!current || !next) return node;
    fields[index] = next;
    fields[target] = current;
    return { ...node, fields };
  });
}

export function countSchemaNodes(schema: Schema | null): number {
  if (!schema) return 0;
  const walk = (node: SchemaNode): number =>
    1 +
    (node.fields ?? []).reduce((total, field) => total + walk(field), 0) +
    (node.items ? walk(node.items) : 0);
  return walk(schema.root);
}

export function schemaDepth(schema: Schema | null): number {
  if (!schema) return 0;
  const walk = (node: SchemaNode, depth: number): number => {
    const childDepths = [
      ...(node.fields ?? []).map((field) => walk(field, depth + 1)),
      ...(node.items ? [walk(node.items, depth + 1)] : []),
    ];
    return childDepths.length > 0 ? Math.max(...childDepths) : depth;
  };
  return walk(schema.root, 1);
}

/** Remove editor ids before persisting or sending. */
export function schemaWithoutIds(schema: Schema): Schema {
  const walk = (node: SchemaNode): SchemaNode => {
    const next: SchemaNode = { ...node };
    delete next.id;
    if (next.fields) next.fields = next.fields.map(walk);
    if (next.items) next.items = walk(next.items);
    return next;
  };
  return { version: 1, root: walk(schema.root) };
}

/** Pretty raw JSON used by the advanced editor. */
export function schemaToRawJson(schema: Schema): string {
  return JSON.stringify(schemaWithoutIds(schema), null, 2);
}

export interface RawSchemaParseResult {
  ok: boolean;
  schema: Schema | null;
  error: string | null;
  line: number | null;
  column: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rawNodeProblem(node: unknown, path: string): string | null {
  if (!isRecord(node)) return `${path} must be an object.`;
  if (typeof node.name !== "string" || !node.name.trim()) {
    return `${path}.name must be a non-empty string.`;
  }
  if (
    typeof node.type !== "string" ||
    !SCHEMA_NODE_TYPES.some((type) => type === node.type)
  ) {
    return `${path}.type must be one of ${SCHEMA_NODE_TYPES.join(", ")}.`;
  }
  for (const key of ["nullProbability", "omitProbability"]) {
    const value = node[key];
    if (value !== undefined && (typeof value !== "number" || value < 0 || value > 1)) {
      return `${path}.${key} must be a number between 0 and 1.`;
    }
  }
  if (node.fields !== undefined && !Array.isArray(node.fields)) {
    return `${path}.fields must be an array.`;
  }
  if (Array.isArray(node.fields)) {
    for (let index = 0; index < node.fields.length; index += 1) {
      const problem = rawNodeProblem(node.fields[index], `${path}.fields[${index}]`);
      if (problem) return problem;
    }
    const names = node.fields
      .filter(isRecord)
      .map((field) => field.name)
      .filter((name): name is string => typeof name === "string");
    if (new Set(names).size !== names.length) {
      return `${path}.fields contains duplicate names.`;
    }
  }
  if (node.items !== undefined) {
    const problem = rawNodeProblem(node.items, `${path}.items`);
    if (problem) return problem;
  }
  return null;
}

export function parseRawSchema(text: string): RawSchemaParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Invalid JSON.";
    const position = /position\s+(\d+)/i.exec(raw);
    if (position?.[1]) {
      const offset = Number(position[1]);
      const before = text.slice(0, offset).split("\n");
      return {
        ok: false,
        schema: null,
        error: raw,
        line: before.length,
        column: (before[before.length - 1]?.length ?? 0) + 1,
      };
    }
    const lineColumn = /line\s+(\d+)\s+column\s+(\d+)/i.exec(raw);
    return {
      ok: false,
      schema: null,
      error: raw,
      line: lineColumn?.[1] ? Number(lineColumn[1]) : null,
      column: lineColumn?.[2] ? Number(lineColumn[2]) : null,
    };
  }

  if (!isRecord(parsed)) {
    return { ok: false, schema: null, error: "The schema must be a JSON object.", line: null, column: null };
  }
  if (parsed.version !== 1) {
    return { ok: false, schema: null, error: "schema.version must be 1.", line: null, column: null };
  }
  const problem = rawNodeProblem(parsed.root, "schema.root");
  if (problem) {
    return { ok: false, schema: null, error: problem, line: null, column: null };
  }

  return {
    ok: true,
    schema: { version: 1, root: parsed.root as unknown as SchemaNode },
    error: null,
    line: null,
    column: null,
  };
}
