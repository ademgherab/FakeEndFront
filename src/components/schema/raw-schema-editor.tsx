"use client";

import { useMemo, useState } from "react";
import type { Schema } from "@/lib/api/generated/schema";
import { Button } from "@/components/ui/button";
import { parseRawSchema, schemaToRawJson } from "@/lib/schema/edit";
import { reassignSchemaIds } from "@/lib/schema/tree";

export interface RawSchemaEditorProps {
  schema: Schema;
  onApply: (schema: Schema) => void;
}

export function RawSchemaEditor({ schema, onApply }: RawSchemaEditorProps) {
  const [text, setText] = useState(() => schemaToRawJson(schema));
  const [appliedNotice, setAppliedNotice] = useState(false);

  const parsed = useMemo(() => parseRawSchema(text), [text]);
  const changed = text.trim() !== schemaToRawJson(schema).trim();
  const lineCount = text.split("\n").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Raw JSON schema</h3>
          <p className="text-xs text-zinc-500">
            Applying replaces the visual tree. Formatting is not preserved.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setText(schemaToRawJson(schema));
              setAppliedNotice(false);
            }}
            disabled={!changed}
          >
            Revert
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!parsed.ok || !parsed.schema) return;
              onApply(reassignSchemaIds(parsed.schema));
              setAppliedNotice(true);
            }}
            disabled={!parsed.ok || !changed}
          >
            Apply to tree
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-zinc-400">
          <span className="font-mono">{lineCount} lines</span>
          <span className={parsed.ok ? "text-lime-300" : "text-red-300"}>
            {parsed.ok ? "Valid schema" : "Not applied"}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setAppliedNotice(false);
          }}
          spellCheck={false}
          aria-label="Raw schema JSON"
          aria-invalid={!parsed.ok}
          className="h-[26rem] w-full resize-y bg-transparent p-3 font-mono text-xs leading-6 text-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-lime-300/50 focus-visible:ring-inset"
        />
      </div>

      {!parsed.ok ? (
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200">
          {parsed.line !== null ? `Line ${parsed.line}${parsed.column !== null ? `, column ${parsed.column}` : ""}: ` : ""}
          {parsed.error}
        </p>
      ) : null}
      {appliedNotice ? (
        <p role="status" className="text-xs text-lime-300">
          Raw schema applied to the visual tree. Undo is available.
        </p>
      ) : null}
    </div>
  );
}
