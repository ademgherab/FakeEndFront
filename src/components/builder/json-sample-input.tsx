"use client";

import type { ApiError } from "@/lib/api";

export interface JsonSampleInputProps {
  sampleText: string;
  onSampleText: (value: string) => void;
  wrapInList: boolean;
  onWrapInList: (value: boolean) => void;
  inferring: boolean;
  inferError: ApiError["problem"] | null;
  warnings: Array<{ code: string; path: string; message: string }>;
  parsedOk: boolean;
  isEmpty: boolean;
  rootIsArray: boolean;
  parseError: string | null;
  canInfer: boolean;
  onInfer: () => void;
}

export function JsonSampleInput({
  sampleText,
  onSampleText,
  wrapInList,
  onWrapInList,
  inferring,
  inferError,
  warnings,
  parsedOk,
  isEmpty,
  rootIsArray,
  parseError,
  canInfer,
  onInfer,
}: JsonSampleInputProps) {
  return (
    <section className="space-y-4">
      <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100">
        Do not paste real or sensitive data.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="json-sample" className="block text-sm font-medium text-zinc-100">
          JSON sample
        </label>
        <textarea
          id="json-sample"
          value={sampleText}
          onChange={(event) => onSampleText(event.target.value)}
          spellCheck={false}
          placeholder={'{\n  "id": 1,\n  "name": "Ahmed"\n}'}
          className="h-48 w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus-visible:border-lime-300/50"
        />
      </div>

      <div aria-live="polite" className="min-h-5 text-xs">
        {isEmpty ? (
          <span className="text-zinc-400">Paste JSON to begin.</span>
        ) : parsedOk ? (
          <span className="text-lime-300">
            Valid JSON{rootIsArray ? " · array root" : " · object root"}.
          </span>
        ) : (
          <span className="text-amber-300">{parseError ?? "Invalid JSON."}</span>
        )}
      </div>

      <label className="flex items-center gap-3 text-sm text-zinc-100">
        <input
          type="checkbox"
          checked={wrapInList}
          onChange={(event) => onWrapInList(event.target.checked)}
          disabled={rootIsArray}
          className="size-4 rounded border-white/20 bg-transparent accent-lime-300"
        />
        <span>Return as list</span>
        {rootIsArray ? (
          <span className="text-xs text-zinc-400">disabled for array roots</span>
        ) : null}
      </label>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-200">Warnings</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.map((warning) => (
              <li key={`${warning.code}-${warning.path}-${warning.message}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {inferError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/[0.06] p-3 text-sm text-red-100"
        >
          {inferError.code ? `${inferError.code}: ` : ""}
          {inferError.detail ?? inferError.title ?? "Inference failed."}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onInfer}
        disabled={!canInfer || inferring}
        aria-busy={inferring}
        className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {inferring ? "Inferring…" : "Infer schema"}
      </button>
    </section>
  );
}
