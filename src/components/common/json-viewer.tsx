"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";

type JsonObject = Record<string, unknown>;

interface TreeRow {
  path: string;
  label: string;
  value: unknown;
  depth: number;
  kind: "container" | "leaf" | "more";
  childCount: number;
  expanded: boolean;
  trailing: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContainer(value: unknown): value is JsonObject | unknown[] {
  return Array.isArray(value) || isObject(value);
}

function childEntries(value: JsonObject | unknown[]): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }
  return Object.entries(value);
}

function pathFor(parent: string, key: string): string {
  const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
  return parent ? `${parent}/${escaped}` : `/${escaped}`;
}

function leafText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === undefined) return "undefined";
  return String(value);
}

function valueTone(value: unknown): string {
  if (value === null) return "text-zinc-500";
  if (typeof value === "string") return "text-lime-200";
  if (typeof value === "number") return "text-sky-200";
  if (typeof value === "boolean") return "text-amber-200";
  return "text-zinc-300";
}

function containerSummary(value: JsonObject | unknown[]): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[ ${value.length.toLocaleString("en-US")} item${value.length === 1 ? "" : "s"} ]`;
  }
  const size = Object.keys(value).length;
  return size === 0 ? "{}" : `{ ${size.toLocaleString("en-US")} field${size === 1 ? "" : "s"} }`;
}

interface BuildResult {
  rows: TreeRow[];
  truncated: boolean;
}

function buildRows(
  value: unknown,
  expanded: ReadonlySet<string>,
  limit: number,
): BuildResult {
  const rows: TreeRow[] = [];
  let truncated = false;

  const push = (row: TreeRow): boolean => {
    if (rows.length >= limit) {
      truncated = true;
      return false;
    }
    rows.push(row);
    return true;
  };

  const walk = (path: string, label: string, current: unknown, depth: number): void => {
    if (truncated) return;
    const container = isContainer(current);
    const children = container ? childEntries(current) : [];
    const isExpanded = container && expanded.has(path);
    if (
      !push({
        path,
        label,
        value: current,
        depth,
        kind: container ? "container" : "leaf",
        childCount: children.length,
        expanded: Boolean(isExpanded),
        trailing: container ? containerSummary(current) : leafText(current),
      })
    ) {
      return;
    }
    if (!isExpanded) return;
    for (const [key, child] of children) {
      walk(pathFor(path, key), key, child, depth + 1);
      if (truncated) return;
    }
  };

  walk("", "root", value, 0);
  return { rows, truncated };
}

function expandablePaths(value: unknown, limit = 5_000): Set<string> {
  const paths = new Set<string>();
  const walk = (path: string, current: unknown): void => {
    if (paths.size >= limit || !isContainer(current)) return;
    paths.add(path);
    for (const [key, child] of childEntries(current)) {
      walk(pathFor(path, key), child);
    }
  };
  walk("", value);
  return paths;
}

function rawJson(value: unknown, pretty: boolean): string {
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0) ?? "undefined";
  } catch {
    return String(value);
  }
}

export interface JsonViewerProps {
  value: unknown;
  /** Starts in pretty (tree) or raw (single document) mode. */
  defaultMode?: "pretty" | "raw";
  showLineNumbers?: boolean;
  className?: string;
  maxHeight?: string;
  label?: string;
}

export function JsonViewer({
  value,
  defaultMode = "pretty",
  showLineNumbers = true,
  className,
  maxHeight = "32rem",
  label = "JSON",
}: JsonViewerProps) {
  const [mode, setMode] = useState<"pretty" | "raw">(defaultMode);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    isContainer(value) ? new Set([""]) : new Set(),
  );
  const [rowLimit, setRowLimit] = useState(1_000);

  const { rows, truncated } = useMemo(
    () => buildRows(value, expanded, rowLimit),
    [value, expanded, rowLimit],
  );

  const text = useMemo(() => rawJson(value, mode === "pretty"), [value, mode]);
  const lines = useMemo(() => text.split("\n"), [text]);

  function toggle(path: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function expandAll() {
    setExpanded(expandablePaths(value));
    setRowLimit((current) => Math.max(current, 1_000));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-black/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-200">{label}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide">
            {mode}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="JSON view mode">
            <Button
              type="button"
              variant={mode === "pretty" ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={mode === "pretty"}
              onClick={() => setMode("pretty")}
            >
              Tree
            </Button>
            <Button
              type="button"
              variant={mode === "raw" ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={mode === "raw"}
              onClick={() => setMode("raw")}
            >
              Raw
            </Button>
          </div>
          {mode === "pretty" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={expandAll}
                aria-label="Expand all JSON nodes"
              >
                <ChevronsUpDownIcon aria-hidden="true" />
                Expand all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={collapseAll}
                aria-label="Collapse all JSON nodes"
              >
                <ChevronsDownUpIcon aria-hidden="true" />
                Collapse all
              </Button>
            </>
          ) : null}
          <CopyButton
            value={text}
            label={`Copy ${label} JSON`}
            toastMessage="JSON copied."
            variant="ghost"
            size="xs"
          />
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        {mode === "pretty" ? (
          <div role="tree" aria-label={`${label} tree`} className="min-w-full py-1 font-mono text-xs leading-5">
            {rows.map((row, index) => (
              <div key={row.path || "root"} className="flex min-w-max">
                {showLineNumbers ? (
                  <span
                    aria-hidden="true"
                    className="w-12 shrink-0 select-none border-r border-white/5 pr-2 text-right text-[0.68rem] text-zinc-600"
                  >
                    {index + 1}
                  </span>
                ) : null}
                <div
                  className="flex min-w-0 flex-1 items-start gap-1 px-2"
                  style={{ paddingLeft: `${row.depth * 14 + 8}px` }}
                >
                  {row.kind === "container" ? (
                    <button
                      type="button"
                      role="treeitem"
                      aria-selected={false}
                      aria-expanded={row.expanded}
                      onClick={() => toggle(row.path)}
                      className="flex min-w-0 items-start gap-1 rounded px-0.5 text-left hover:bg-white/5"
                    >
                      {row.expanded ? (
                        <ChevronDownIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                      ) : (
                        <ChevronRightIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                      )}
                      <span className="text-zinc-400">{row.label === "root" ? "" : `${row.label}: `}</span>
                      <span className="text-zinc-500">{row.trailing}</span>
                    </button>
                  ) : (
                    <div role="treeitem" aria-selected={false} className="flex min-w-0 items-start gap-1">
                      <span className="w-3.5 shrink-0" />
                      <span className="text-zinc-400">{row.label}: </span>
                      <span className={cn("break-all", valueTone(row.value))}>{row.trailing}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {truncated ? (
              <div className="flex items-center gap-2 px-4 py-2 text-zinc-400">
                <span>Large document — showing the first {rowLimit.toLocaleString("en-US")} rows.</span>
                <Button type="button" size="xs" variant="outline" onClick={() => setRowLimit((current) => current + 1_000)}>
                  Show 1,000 more
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-max font-mono text-xs leading-5">
            {showLineNumbers ? (
              <div aria-hidden="true" className="w-12 shrink-0 select-none border-r border-white/5 py-2 pr-2 text-right text-[0.68rem] text-zinc-600">
                {lines.map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
            ) : null}
            <pre className="whitespace-pre p-2 text-zinc-200" tabIndex={0}>
              <code>{text}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
