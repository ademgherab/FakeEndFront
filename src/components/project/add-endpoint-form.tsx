"use client";

import { useState } from "react";
import type { Endpoint, Method, Schema } from "@/lib/types";
import { ApiError, createEndpoint, infer } from "@/lib/api";
import { DEFAULT_SUCCESS_STATUS } from "@/lib/defaults";
import { parseSample, validatePath } from "@/lib/validation";
import { ErrorBanner } from "@/components/builder/error-banner";

export interface AddEndpointFormProps {
  projectSlug: string;
  token: string;
  onCreated: (endpoint: Endpoint) => void;
}

export function AddEndpointForm({
  projectSlug,
  token,
  onCreated,
}: AddEndpointFormProps) {
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/users");
  const [sampleText, setSampleText] = useState("");
  const [schema, setSchema] = useState<Schema | null>(null);
  const [sendSchema, setSendSchema] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError["problem"] | null>(null);

  const sample = parseSample(sampleText);
  const pathValidation = validatePath(path);

  async function runInfer() {
    if (!sample.ok) return;
    setInferring(true);
    setError(null);
    try {
      const response = await infer({ sample: sample.value });
      setSchema(response.schema);
      setSendSchema(true);
    } catch (caught) {
      setSchema(null);
      setError(
        caught instanceof ApiError
          ? caught.problem
          : { title: "Inference failed." },
      );
    } finally {
      setInferring(false);
    }
  }

  async function submit() {
    if (creating) return;
    if (!sendSchema && !sample.ok) {
      setError({ title: "Paste a JSON sample first." });
      return;
    }
    if (!pathValidation.valid) {
      setError({ title: "The path is not valid.", errors: { path: pathValidation.errors } });
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Exactly one of `sample` or `schema` is sent, never both.
      const endpoint = await createEndpoint(projectSlug, token, {
        method,
        path: pathValidation.value,
        ...(sendSchema && schema
          ? { schema }
          : { sample: sample.value }),
        options: { wrapInList: false },
        settings: {
          successStatus: DEFAULT_SUCCESS_STATUS[method],
          delay: { minMs: 0, maxMs: 0 },
          errors: { ratePercent: 0, statusCodes: [500] },
          list: { path: null, size: { min: 10, max: 10 } },
        },
      });
      onCreated(endpoint);
      setSampleText("");
      setSchema(null);
      setSendSchema(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem
          : { title: "The endpoint could not be created." },
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Add an endpoint</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-endpoint-method" className="block text-sm font-medium text-zinc-100">
            Method
          </label>
          <select
            id="new-endpoint-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as Method)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            {(["GET", "POST", "PUT", "DELETE"] as Method[]).map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-endpoint-path" className="block text-sm font-medium text-zinc-100">
            Path
          </label>
          <input
            id="new-endpoint-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            aria-invalid={!pathValidation.valid || undefined}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none"
          />
          {pathValidation.errors.map((message) => (
            <p key={message} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="new-endpoint-sample" className="block text-sm font-medium text-zinc-100">
          JSON sample
        </label>
        <textarea
          id="new-endpoint-sample"
          value={sampleText}
          onChange={(event) => {
            setSampleText(event.target.value);
            setSchema(null);
            setSendSchema(false);
          }}
          spellCheck={false}
          placeholder={'{\n  "id": 1,\n  "name": "Ahmed"\n}'}
          className="h-32 w-full resize-y rounded-lg border border-white/15 bg-black/40 p-3 font-mono text-sm leading-6 text-zinc-100 outline-none"
        />
        {sample.error ? (
          <p className="text-xs text-amber-300">{sample.error}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void runInfer();
          }}
          disabled={!sample.ok || inferring}
          aria-busy={inferring}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inferring ? "Inferring…" : "Infer schema"}
        </button>

        {schema ? (
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={sendSchema}
              onChange={(event) => setSendSchema(event.target.checked)}
              className="size-3.5 rounded border-white/20 bg-transparent accent-lime-300"
            />
            Send the inferred schema instead of the sample
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={creating}
          aria-busy={creating}
          className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add endpoint"}
        </button>
      </div>

      {schema ? (
        <details className="rounded-lg border border-white/10 bg-black/20">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-200">
            Inferred schema
          </summary>
          <pre className="max-h-56 overflow-auto border-t border-white/10 p-3 font-mono text-xs leading-5 text-zinc-300">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </details>
      ) : null}

      {error ? <ErrorBanner error={error} errors={error.errors} /> : null}
    </section>
  );
}
