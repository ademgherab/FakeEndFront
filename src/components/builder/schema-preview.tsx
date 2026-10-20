"use client";

import type { Schema } from "@/lib/types";

export interface SchemaPreviewProps {
  schema: Schema | null;
  stale: boolean;
}

/** Read-only JSON preview. No editor, no CodeMirror. */
export function SchemaPreview({ schema, stale }: SchemaPreviewProps) {
  if (!schema) return null;

  return (
    <details
      className="rounded-xl border border-white/10 bg-white/[0.02]"
      open={!stale}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-100">
        Schema {stale ? "(stale)" : ""}
      </summary>
      <pre className="max-h-72 overflow-auto border-t border-white/10 p-4 font-mono text-xs leading-5 text-zinc-300">
        {JSON.stringify(schema, null, 2)}
      </pre>
    </details>
  );
}
