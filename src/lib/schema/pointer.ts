import type { Schema, SchemaNode } from "@/lib/api/generated/schema";

/** RFC 6901 escape: `~` becomes `~0`, `/` becomes `~1`. */
export function escapePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Append a reference token to a pointer. The root pointer is the empty string. */
export function appendPointer(pointer: string, token: string): string {
  const escaped = escapePointerToken(token);
  return pointer ? `${pointer}/${escaped}` : `/${escaped}`;
}

export function pointerTokens(pointer: string): string[] {
  if (!pointer) return [];
  if (!pointer.startsWith("/")) {
    throw new Error(`JSON Pointer must start with "/": ${pointer}`);
  }
  return pointer
    .slice(1)
    .split("/")
    .map(unescapePointerToken);
}

export function parentPointer(pointer: string): string | null {
  if (!pointer) return null;
  const index = pointer.lastIndexOf("/");
  return index <= 0 ? "" : pointer.slice(0, index);
}

export function lastPointerToken(pointer: string): string | null {
  if (!pointer) return null;
  const tokens = pointerTokens(pointer);
  return tokens[tokens.length - 1] ?? null;
}

function isArrayIndex(token: string): boolean {
  if (token === "-") return true;
  return /^(0|[1-9]\d*)$/.test(token);
}

/**
 * Resolve a response JSON Pointer against a schema tree.
 *
 * Arrays in the response are represented by `node.items`, so any index token
 * descends into `items` (the schema describes every element identically).
 * Returns `null` when a token cannot be mapped, which is how incompatible
 * inference suggestions are filtered out.
 */
export function resolvePointer(schema: Schema, pointer: string): SchemaNode | null {
  let current: SchemaNode = schema.root;
  for (const token of pointerTokens(pointer)) {
    if (current.type === "array") {
      if (!current.items || !isArrayIndex(token)) return null;
      current = current.items;
      continue;
    }
    if (current.type === "object") {
      const field = current.fields?.find((entry) => entry.name === token);
      if (!field) return null;
      current = field;
      continue;
    }
    return null;
  }
  return current;
}

/** Build the canonical pointer for every node. Array items use the `0` token. */
export function pointerForNode(
  schema: Schema,
  target: SchemaNode,
): string | null {
  if (schema.root === target) return "";
  const visited = new Set<SchemaNode>();

  const walk = (node: SchemaNode, pointer: string): string | null => {
    if (node === target) return pointer;
    if (visited.has(node)) return null;
    visited.add(node);

    for (const field of node.fields ?? []) {
      const found = walk(field, appendPointer(pointer, field.name));
      if (found !== null) return found;
    }
    if (node.items) {
      const found = walk(node.items, appendPointer(pointer, "0"));
      if (found !== null) return found;
    }
    return null;
  };

  return walk(schema.root, "");
}

export function pointerSegments(pointer: string): string[] {
  return pointerTokens(pointer);
}
