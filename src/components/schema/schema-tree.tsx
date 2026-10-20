"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type {
  InferWarning,
  MetaResponse,
  Schema,
  SchemaNodeType,
} from "@/lib/api/generated/schema";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/common/copy-button";
import {
  buildSchemaRows,
  expandToDepth,
  visibleSchemaRows,
  type FlatSchemaNode,
} from "@/lib/schema/tree";

const TYPE_STYLES: Record<SchemaNodeType, string> = {
  string: "border-lime-400/25 bg-lime-400/10 text-lime-200",
  number: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  integer: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  boolean: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  object: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  array: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200",
  null: "border-zinc-400/25 bg-zinc-400/10 text-zinc-300",
};

function paramSummary(node: FlatSchemaNode["node"]): string {
  const entries = Object.entries(node.generatorParams ?? {});
  if (entries.length === 0) return "";
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

export interface SchemaTreeProps {
  schema: Schema;
  meta: MetaResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
  warnings?: InferWarning[];
  className?: string;
}

export function SchemaTree({
  schema,
  meta,
  selectedId,
  onSelect,
  warnings = [],
  className,
}: SchemaTreeProps) {
  const rows = useMemo(() => buildSchemaRows(schema), [schema]);
  const rootId = schema.root.id ?? "";
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    expandToDepth(buildSchemaRows(schema), 1),
  );
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  // The root is always expanded; deriving it avoids resetting state in an effect.
  const expandedWithRoot = useMemo(() => {
    if (!rootId || expanded.has(rootId)) return expanded;
    return new Set(expanded).add(rootId);
  }, [expanded, rootId]);

  const visible = useMemo(
    () => visibleSchemaRows(rows, expandedWithRoot, query),
    [rows, expandedWithRoot, query],
  );

  const warningsByPointer = useMemo(() => {
    const map = new Map<string, InferWarning[]>();
    for (const warning of warnings) {
      if (warning.path === null) continue;
      const existing = map.get(warning.path) ?? [];
      existing.push(warning);
      map.set(warning.path, existing);
    }
    return map;
  }, [warnings]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusRow(id: string) {
    setFocusId(id);
    window.requestAnimationFrame(() => {
      document.getElementById(`schema-node-${id}`)?.focus();
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = visible.findIndex((row) => row.id === (focusId ?? selectedId));
    const current = index >= 0 ? visible[index] : undefined;
    const parentIndex = current?.parentId
      ? visible.findIndex((row) => row.id === current.parentId)
      : -1;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = visible[Math.min(visible.length - 1, index + 1)];
        if (next) focusRow(next.id);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const next = visible[Math.max(0, index - 1)];
        if (next) focusRow(next.id);
        break;
      }
      case "Home": {
        event.preventDefault();
        if (visible[0]) focusRow(visible[0].id);
        break;
      }
      case "End": {
        event.preventDefault();
        const last = visible[visible.length - 1];
        if (last) focusRow(last.id);
        break;
      }
      case "ArrowRight": {
        if (!current) break;
        event.preventDefault();
        if (current.hasChildren && !expanded.has(current.id)) {
          toggle(current.id);
        } else {
          const next = visible[index + 1];
          if (next) focusRow(next.id);
        }
        break;
      }
      case "ArrowLeft": {
        if (!current) break;
        event.preventDefault();
        if (current.hasChildren && expanded.has(current.id)) {
          toggle(current.id);
        } else if (parentIndex >= 0) {
          const parent = visible[parentIndex];
          if (parent) focusRow(parent.id);
        }
        break;
      }
      case "Enter":
      case " ": {
        if (!current) break;
        event.preventDefault();
        onSelect(current.id);
        break;
      }
      default:
        break;
    }
  }

  function expandAll() {
    setExpanded(new Set(rows.filter((row) => row.hasChildren).map((row) => row.id)));
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fields and pointers…"
            aria-label="Search schema fields"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="xs" variant="outline" onClick={expandAll}>
            Expand all
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
          <label className="flex items-center gap-1 text-xs text-zinc-400">
            <span className="sr-only">Expand to depth</span>
            <select
              className="h-7 rounded-lg border border-white/15 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              defaultValue="1"
              onChange={(event) => {
                const value = event.target.value;
                setExpanded(
                  value === "all"
                    ? new Set(rows.filter((row) => row.hasChildren).map((row) => row.id))
                    : expandToDepth(rows, Number(value)),
                );
              }}
              aria-label="Expand schema to depth"
            >
              <option value="1">Depth 1</option>
              <option value="2">Depth 2</option>
              <option value="3">Depth 3</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-400">
          No fields match “{query.trim()}”.
        </p>
      ) : (
        <div
          role="tree"
          aria-label="Schema tree"
          className="max-h-[30rem] overflow-auto rounded-xl border border-white/10 bg-black/20 py-1"
          onKeyDown={onKeyDown}
        >
          {visible.map((row) => {
            const nodeWarnings = warningsByPointer.get(row.pointer) ?? [];
            const selected = selectedId === row.id;
            const hasFocus = focusId === row.id;
            const generator = row.node.generator
              ? meta.generators.find((entry) => entry.id === row.node.generator)
              : undefined;
            const params = paramSummary(row.node);
            const label =
              row.kind === "item"
                ? `[0] ${row.node.name}`
                : row.node.name;

            return (
              <div
                key={row.id}
                id={`schema-node-${row.id}`}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={row.hasChildren ? expanded.has(row.id) : undefined}
                aria-selected={selected}
                tabIndex={hasFocus || (!focusId && selected) ? 0 : -1}
                onClick={() => {
                  setFocusId(row.id);
                  onSelect(row.id);
                }}
                onFocus={() => setFocusId(row.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs outline-none",
                  selected && "bg-lime-300/10",
                  !selected && "hover:bg-white/[0.04]",
                  "focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-inset",
                  nodeWarnings.length > 0 && "border-l-2 border-l-amber-400/70",
                )}
                style={{ paddingLeft: `${row.depth * 14 + 8}px` }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(row.id);
                    }}
                    aria-label={`${expanded.has(row.id) ? "Collapse" : "Expand"} ${row.node.name}`}
                    className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                  >
                    {expanded.has(row.id) ? (
                      <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                    ) : (
                      <ChevronRightIcon aria-hidden="true" className="size-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="inline-block size-4 shrink-0" />
                )}

                <span className="truncate font-mono text-zinc-200" title={row.pointer || "/"}>
                  {label}
                </span>

                <span
                  className={cn(
                    "shrink-0 rounded border px-1 py-px font-mono text-[0.62rem] uppercase tracking-wide",
                    TYPE_STYLES[row.node.type],
                  )}
                >
                  {row.node.type}
                </span>

                {generator ? (
                  <span className="hidden shrink-0 items-center gap-1 text-[0.68rem] text-zinc-400 sm:flex">
                    <span className="rounded bg-white/5 px-1 py-px">{generator.label}</span>
                    {params ? <span className="font-mono text-zinc-500">{params}</span> : null}
                  </span>
                ) : row.node.constant !== undefined ? (
                  <span className="hidden shrink-0 font-mono text-[0.68rem] text-zinc-500 sm:inline">
                    = {JSON.stringify(row.node.constant)}
                  </span>
                ) : null}

                {row.node.nullProbability ? (
                  <span className="shrink-0 text-[0.65rem] text-zinc-500">
                    null {Math.round(row.node.nullProbability * 100)}%
                  </span>
                ) : null}
                {row.node.omitProbability ? (
                  <span className="shrink-0 text-[0.65rem] text-zinc-500">
                    omit {Math.round(row.node.omitProbability * 100)}%
                  </span>
                ) : null}
                {row.node.type === "array" && row.node.length ? (
                  <span className="shrink-0 text-[0.65rem] text-zinc-500">
                    len {row.node.length.min}–{row.node.length.max}
                  </span>
                ) : null}

                {nodeWarnings.length > 0 ? (
                  <span
                    className="shrink-0 text-amber-300"
                    title={nodeWarnings.map((warning) => warning.message).join("\n")}
                    aria-label={nodeWarnings.map((warning) => warning.message).join("; ")}
                  >
                    <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
                  </span>
                ) : null}

                <span className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <CopyButton
                    value={row.pointer}
                    label={`Copy JSON Pointer for ${row.pointer || "root"}`}
                    toastMessage="Pointer copied."
                    variant="ghost"
                    size="icon-xs"
                    iconOnly
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
