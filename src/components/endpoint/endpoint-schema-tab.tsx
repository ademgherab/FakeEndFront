"use client";

import { useState } from "react";
import type { MetaResponse, Schema } from "@/lib/api/generated/schema";
import { SchemaInspector } from "@/components/schema/schema-inspector";
import { SchemaTree } from "@/components/schema/schema-tree";
import { RawSchemaEditor } from "@/components/schema/raw-schema-editor";
import { findNodeById, summarizeSchema } from "@/lib/schema/tree";

export interface EndpointSchemaTabProps {
  schema: Schema;
  meta: MetaResponse;
  onChange: (schema: Schema) => void;
  serverProblems: string[];
}

export function EndpointSchemaTab({
  schema,
  meta,
  onChange,
  serverProblems,
}: EndpointSchemaTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    schema.root.id ?? null,
  );
  const effectiveId = findNodeById(schema, selectedId)
    ? selectedId
    : (schema.root.id ?? null);
  const selectedNode = findNodeById(schema, effectiveId);
  const summary = summarizeSchema(schema);

  return (
    <div className="space-y-5">
      {serverProblems.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-100"
        >
          <p className="font-semibold">
            The server rejected this schema. Your edits were kept.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-red-100/80">
            {serverProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>
          {summary.nodes.toLocaleString("en-US")} node
          {summary.nodes === 1 ? "" : "s"}
        </span>
        <span>
          {summary.leaves.toLocaleString("en-US")} leaf
          {summary.leaves === 1 ? "" : "s"}
        </span>
        <span>depth {summary.depth}</span>
        <span className="text-zinc-600">
          Internal field ids never leave the browser.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <SchemaTree
            schema={schema}
            meta={meta}
            selectedId={effectiveId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="min-w-0">
          {selectedNode ? (
            <SchemaInspector
              key={effectiveId ?? "root"}
              schema={schema}
              node={selectedNode}
              meta={meta}
              onChange={onChange}
              onSelect={setSelectedId}
            />
          ) : null}
        </div>
      </div>

      <details
        className="rounded-xl border border-white/10 bg-white/[0.02] p-4 open:pb-4"
        open
      >
        <summary className="cursor-pointer text-sm font-semibold text-zinc-100">
          Edit as raw JSON
        </summary>
        <div className="mt-4">
          <RawSchemaEditor schema={schema} onApply={onChange} />
        </div>
      </details>
    </div>
  );
}
