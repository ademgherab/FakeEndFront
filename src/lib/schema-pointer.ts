import type { ObjectNode, Schema, SchemaNode } from "@/lib/types";

/**
 * RFC 6901 pointer resolution over a schema tree.
 *
 * The API addresses values inside a generated response with pointers such as
 * `/items` or `/data/0/total`. The frontend uses the same resolution to
 * check that a list path and the pagination bindings point at real leaves of
 * the right type.
 */

export type LeafType = "string" | "integer" | "number" | "boolean" | "null";

function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Splits a pointer into decoded segments. `""` addresses the root. */
export function pointerSegments(pointer: string): string[] | null {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return null;
  return pointer.slice(1).split("/").map(decodeSegment);
}

/** Resolves a pointer to a schema node, or `null` when it does not exist. */
export function resolveSchemaNode(
  root: SchemaNode,
  pointer: string,
): SchemaNode | null {
  const segments = pointerSegments(pointer);
  if (segments === null) return null;

  let node: SchemaNode | null = root;
  for (const segment of segments) {
    if (!node) return null;
    if (node.type === "object") {
      const field: ObjectNode["fields"][number] | undefined = node.fields.find(
        (entry) => entry.name === segment,
      );
      if (!field) return null;
      node = field.node;
    } else if (node.type === "array") {
      if (!/^\d+$/.test(segment)) return null;
      node = node.item;
    } else {
      return null;
    }
  }
  return node;
}

/** The leaf type of a node, or `null` when the node is not a leaf. */
export function leafTypeOf(node: SchemaNode | null): LeafType | null {
  if (!node) return null;
  if (node.type === "object" || node.type === "array") return null;
  return node.type;
}

/** True when the pointer addresses an array node. */
export function resolvesToArray(root: SchemaNode, pointer: string): boolean {
  return resolveSchemaNode(root, pointer)?.type === "array";
}

export function schemaRoot(schema: Schema | null): SchemaNode | null {
  return schema?.root ?? null;
}
