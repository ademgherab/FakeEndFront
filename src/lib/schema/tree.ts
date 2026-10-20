import type { Schema, SchemaNode } from "@/lib/api/generated/schema";
import {
  appendPointer,
  pointerForNode,
  pointerTokens,
  resolvePointer,
} from "@/lib/schema/pointer";

let fallbackId = 0;

export function newSchemaNodeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `n_${crypto.randomUUID()}`;
  }
  fallbackId += 1;
  return `n_${Date.now().toString(36)}_${fallbackId.toString(36)}`;
}

function withNodeIds(node: SchemaNode): SchemaNode {
  const clone: SchemaNode = { ...node, id: node.id ?? newSchemaNodeId() };
  if (node.fields) clone.fields = node.fields.map(withNodeIds);
  if (node.items) clone.items = withNodeIds(node.items);
  return clone;
}

/** Deep-clone a schema and make sure every node has a stable editor id. */
export function ensureSchemaIds(schema: Schema): Schema {
  return { version: 1, root: withNodeIds(schema.root) };
}

/** Clones without mutating and regenerates every id (used after raw apply). */
export function reassignSchemaIds(schema: Schema): Schema {
  return { version: 1, root: reassignNodeIds(schema.root) };
}

function reassignNodeIds(node: SchemaNode): SchemaNode {
  const clone: SchemaNode = { ...node, id: newSchemaNodeId() };
  if (node.fields) clone.fields = node.fields.map(reassignNodeIds);
  if (node.items) clone.items = reassignNodeIds(node.items);
  return clone;
}

export interface SchemaSummary {
  nodes: number;
  depth: number;
  leaves: number;
}

export function summarizeSchema(schema: Schema | null): SchemaSummary {
  if (!schema) return { nodes: 0, depth: 0, leaves: 0 };

  let nodes = 0;
  let leaves = 0;
  let depth = 0;

  const walk = (node: SchemaNode, currentDepth: number): void => {
    nodes += 1;
    if (currentDepth > depth) depth = currentDepth;
    const children = [...(node.fields ?? []), ...(node.items ? [node.items] : [])];
    if (children.length === 0) leaves += 1;
    for (const child of children) walk(child, currentDepth + 1);
  };

  walk(schema.root, 1);
  return { nodes, depth, leaves };
}

export interface SchemaLimitProblem {
  field: "nodes" | "depth";
  message: string;
}

export function schemaLimitProblems(
  schema: Schema | null,
  limits: { maxSchemaNodes: number; maxSchemaDepth: number },
): SchemaLimitProblem[] {
  const summary = summarizeSchema(schema);
  const problems: SchemaLimitProblem[] = [];
  if (summary.nodes > limits.maxSchemaNodes) {
    problems.push({
      field: "nodes",
      message: `This schema has ${summary.nodes.toLocaleString("en-US")} nodes; the limit is ${limits.maxSchemaNodes.toLocaleString("en-US")}.`,
    });
  }
  if (summary.depth > limits.maxSchemaDepth) {
    problems.push({
      field: "depth",
      message: `This schema is ${summary.depth} levels deep; the limit is ${limits.maxSchemaDepth}.`,
    });
  }
  return problems;
}

export function isSchemaWithinLimits(
  schema: Schema | null,
  limits: { maxSchemaNodes: number; maxSchemaDepth: number },
): boolean {
  return schemaLimitProblems(schema, limits).length === 0;
}

export interface FlatSchemaNode {
  node: SchemaNode;
  id: string;
  pointer: string;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  kind: "root" | "field" | "item";
}

/** In document order: object fields first, then array items. */
export function buildSchemaRows(schema: Schema): FlatSchemaNode[] {
  const rows: FlatSchemaNode[] = [];

  const walk = (
    node: SchemaNode,
    pointer: string,
    depth: number,
    parentId: string | null,
    kind: FlatSchemaNode["kind"],
  ): void => {
    const id = node.id ?? newSchemaNodeId();
    const children = [
      ...(node.fields ?? []).map((field) => ({
        node: field,
        pointer: appendPointer(pointer, field.name),
        kind: "field" as const,
      })),
      ...(node.items
        ? [{ node: node.items, pointer: appendPointer(pointer, "0"), kind: "item" as const }]
        : []),
    ];
    rows.push({
      node,
      id,
      pointer,
      depth,
      parentId,
      hasChildren: children.length > 0,
      kind,
    });
    for (const child of children) {
      walk(child.node, child.pointer, depth + 1, id, child.kind);
    }
  };

  walk(schema.root, "", 0, null, "root");
  return rows;
}

export function expandToDepth(rows: FlatSchemaNode[], depth: number): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.hasChildren && row.depth < depth) ids.add(row.id);
  }
  return ids;
}

/**
 * Rows that are currently visible. When searching, all matching rows and their
 * ancestors are returned regardless of collapse state.
 */
export function visibleSchemaRows(
  rows: FlatSchemaNode[],
  expanded: ReadonlySet<string>,
  query: string,
): FlatSchemaNode[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return rows.filter((row) => {
      let parent = row.parentId;
      while (parent) {
        if (!expanded.has(parent)) return false;
        parent = byId.get(parent)?.parentId ?? null;
      }
      return true;
    });
  }

  const keep = new Set<string>();
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const row of rows) {
    if (!row.node.name.toLowerCase().includes(term) && row.pointer.toLowerCase() !== term) {
      continue;
    }
    keep.add(row.id);
    let parent = row.parentId;
    while (parent) {
      keep.add(parent);
      parent = byId.get(parent)?.parentId ?? null;
    }
  }

  return rows.filter((row) => keep.has(row.id));
}

export function findNodeById(schema: Schema, id: string | null): SchemaNode | null {
  if (!id) return null;
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

export interface ArrayPointerOption {
  pointer: string;
  label: string;
  node: SchemaNode;
}

/** `list.path` options: the root (only when it is an array) and nested arrays. */
export function listArrayPointers(schema: Schema): ArrayPointerOption[] {
  const options: ArrayPointerOption[] = [];

  const walk = (node: SchemaNode, pointer: string): void => {
    if (node.type === "array") {
      options.push({
        pointer,
        label: pointer ? `${pointer} (${node.name})` : "root (the whole response is an array)",
        node,
      });
    }
    for (const field of node.fields ?? []) {
      walk(field, appendPointer(pointer, field.name));
    }
    if (node.items) walk(node.items, appendPointer(pointer, "0"));
  };

  walk(schema.root, "");
  return options;
}

export interface BindingOption {
  pointer: string;
  label: string;
  type: SchemaNode["type"];
}

/**
 * Pagination bindings are only offered for direct children of the root object,
 * as required by the settings rules.
 */
export function rootBindingOptions(schema: Schema): BindingOption[] {
  if (schema.root.type !== "object") return [];
  return (schema.root.fields ?? []).map((field) => ({
    pointer: appendPointer("", field.name),
    label: field.name,
    type: field.type,
  }));
}

export function compatibleBindings(
  schema: Schema,
  accepted: ReadonlyArray<SchemaNode["type"]>,
): BindingOption[] {
  return rootBindingOptions(schema).filter((option) =>
    accepted.some((type) => type === option.type),
  );
}

export function nodePointer(schema: Schema, node: SchemaNode): string | null {
  return pointerForNode(schema, node);
}

export function pointerDepth(pointer: string): number {
  return pointerTokens(pointer).length;
}

export function resolveSchemaPointer(schema: Schema, pointer: string): SchemaNode | null {
  return resolvePointer(schema, pointer);
}
