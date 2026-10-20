import type {
  EndpointPaginationSettings,
  EndpointSettings,
  InferSuggestion,
  Schema,
  SchemaNode,
} from "@/lib/api/generated/schema";
import { resolvePointer } from "@/lib/schema/pointer";

export type PaginationBindingKey =
  | "pageBinding"
  | "limitBinding"
  | "totalBinding"
  | "totalPagesBinding"
  | "hasNextBinding"
  | "hasPrevBinding";

export interface BindingDefinition {
  key: PaginationBindingKey;
  label: string;
  description: string;
  types: SchemaNode["type"][];
  aliases: RegExp;
}

export const BINDING_DEFINITIONS: BindingDefinition[] = [
  {
    key: "pageBinding",
    label: "Current page",
    description: "Reads the requested page from this field.",
    types: ["integer", "number"],
    aliases: /^(page|currentpage|current_page|pagenumber|page_number)$/i,
  },
  {
    key: "limitBinding",
    label: "Page size",
    description: "Reads the page size (limit/perPage) from this field.",
    types: ["integer", "number"],
    aliases: /^(limit|perpage|per_page|pagesize|page_size|size|count)$/i,
  },
  {
    key: "totalBinding",
    label: "Total items",
    description: "Reads the total number of items from this field.",
    types: ["integer", "number"],
    aliases: /^(total|totalitems|total_items|totalcount|total_count)$/i,
  },
  {
    key: "totalPagesBinding",
    label: "Total pages",
    description: "Reads the total number of pages from this field.",
    types: ["integer", "number"],
    aliases: /^(totalpages|total_pages|pagecount|page_count|pages)$/i,
  },
  {
    key: "hasNextBinding",
    label: "Has next page",
    description: "Reads whether another page exists from this field.",
    types: ["boolean"],
    aliases: /^(hasnext|has_next|nextpage|next_page|more)$/i,
  },
  {
    key: "hasPrevBinding",
    label: "Has previous page",
    description: "Reads whether a previous page exists from this field.",
    types: ["boolean"],
    aliases: /^(hasprev|has_prev|haspage|previous|previouspage|previous_page)$/i,
  },
];

const LIST_ALIASES =
  /^(data|items|results|rows|records|list|entries|content|payload)$/i;

export interface SuggestionItem {
  id: string;
  kind: "list" | "binding";
  pointer: string;
  binding?: PaginationBindingKey;
  title: string;
  description: string;
}

export interface SuggestionPlan {
  items: SuggestionItem[];
  listPath: string | null;
  bindings: Partial<Record<PaginationBindingKey, string>>;
}

function lastToken(pointer: string): string {
  if (!pointer) return "";
  const decoded = pointer
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
  return decoded[decoded.length - 1] ?? "";
}

function bindingForKey(key: PaginationBindingKey): BindingDefinition {
  const definition = BINDING_DEFINITIONS.find((entry) => entry.key === key);
  if (!definition) throw new Error(`Unknown binding ${key}`);
  return definition;
}

function isCompatible(node: SchemaNode, types: SchemaNode["type"][]): boolean {
  return types.some((type) => type === node.type);
}

export function suggestionKey(suggestion: InferSuggestion): string {
  return `${suggestion.code}:${suggestion.path}`;
}

function detectBinding(
  suggestion: InferSuggestion,
  node: SchemaNode,
): PaginationBindingKey | null {
  const token = lastToken(suggestion.path);
  const haystack = `${suggestion.code} ${suggestion.message}`.toLowerCase();

  for (const definition of BINDING_DEFINITIONS) {
    if (!isCompatible(node, definition.types)) continue;
    if (
      definition.aliases.test(token) ||
      haystack.includes(definition.key.toLowerCase()) ||
      haystack.includes(
        definition.key
          .replace(/Binding$/, "")
          .replace(/([A-Z])/g, " $1")
          .toLowerCase(),
      )
    ) {
      return definition.key;
    }
  }
  return null;
}

function looksLikeList(suggestion: InferSuggestion, node: SchemaNode): boolean {
  if (node.type !== "array") return false;
  const token = lastToken(suggestion.path);
  const haystack = `${suggestion.code} ${suggestion.message}`.toLowerCase();
  return (
    LIST_ALIASES.test(token) ||
    haystack.includes("list path") ||
    haystack.includes("list array") ||
    haystack.includes("root array") ||
    haystack.includes("suggest_list") ||
    haystack.includes("list_path")
  );
}

/**
 * Filters suggestions that resolve to compatible nodes and translates their
 * pointers into concrete list/pagination settings. Nothing is applied here.
 */
export function buildSuggestionPlan(
  schema: Schema,
  suggestions: InferSuggestion[],
): SuggestionPlan {
  const items: SuggestionItem[] = [];
  const seen = new Set<string>();
  let listPath: string | null = null;
  const bindings: Partial<Record<PaginationBindingKey, string>> = {};

  for (const suggestion of suggestions) {
    const node = resolvePointer(schema, suggestion.path);
    if (!node) continue;

    const binding = detectBinding(suggestion, node);
    if (binding) {
      if (bindings[binding]) continue;
      const definition = bindingForKey(binding);
      bindings[binding] = suggestion.path;
      const id = `binding:${binding}:${suggestion.path}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          kind: "binding",
          pointer: suggestion.path,
          binding,
          title: `${definition.label} → ${suggestion.path || "root"}`,
          description: `${definition.description} ${suggestion.message}`.trim(),
        });
      }
      continue;
    }

    if (looksLikeList(suggestion, node) && !listPath) {
      listPath = suggestion.path;
      const id = `list:${suggestion.path}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          kind: "list",
          pointer: suggestion.path,
          title: `Response list → ${suggestion.path || "root"}`,
          description:
            suggestion.message ||
            "This array looks like the collection the API returns.",
        });
      }
    }
  }

  return { items, listPath, bindings };
}

export function applySuggestionPlan(
  settings: EndpointSettings,
  plan: SuggestionPlan,
  options: {
    applyListPath: boolean;
    applyBindings: boolean;
    paginationDefaults: EndpointPaginationSettings;
  },
): EndpointSettings {
  let next: EndpointSettings = { ...settings };

  if (options.applyListPath && plan.listPath !== null) {
    next = { ...next, list: { ...next.list, path: plan.listPath } };
  }

  const bindingEntries = Object.entries(plan.bindings).filter(
    (entry): entry is [PaginationBindingKey, string] =>
      options.applyBindings && typeof entry[1] === "string",
  );

  if (bindingEntries.length > 0) {
    const base = next.pagination ?? options.paginationDefaults;
    const pagination: EndpointPaginationSettings = { ...base };
    for (const [key, pointer] of bindingEntries) {
      pagination[key] = pointer;
    }
    next = { ...next, pagination };
  }

  return next;
}

/**
 * True when applying the plan would replace a value the user already set to
 * something different. The UI asks for confirmation in that case.
 */
export function suggestionConflicts(
  settings: EndpointSettings,
  plan: SuggestionPlan,
): boolean {
  if (plan.listPath !== null && settings.list.path !== null && settings.list.path !== plan.listPath) {
    return true;
  }

  if (Object.keys(plan.bindings).length === 0) return false;
  if (!settings.pagination) return false;

  for (const entry of Object.entries(plan.bindings) as Array<
    [PaginationBindingKey, string]
  >) {
    const [key, pointer] = entry;
    const current = settings.pagination[key];
    if (current !== null && current !== pointer) return true;
  }
  return false;
}

export function planHasListPath(plan: SuggestionPlan): boolean {
  return plan.listPath !== null;
}

export function planHasBindings(plan: SuggestionPlan): boolean {
  return Object.keys(plan.bindings).length > 0;
}
