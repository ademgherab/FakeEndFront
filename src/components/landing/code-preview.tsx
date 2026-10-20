import { landingContent } from "@/content/landing";

/**
 * The visual proof: the sample on the left, the URL it is served from, and
 * the response that comes back with the same shape and fresh values.
 */
export function CodePreview() {
  const code = landingContent.code;

  return (
    <figure className="relative min-w-0 max-w-full">
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2rem] bg-lime-300/[0.04] blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div aria-hidden="true" className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-zinc-700" />
            <span className="size-2 rounded-full bg-zinc-700" />
            <span className="size-2 rounded-full bg-zinc-700" />
          </div>
          <span className="truncate font-mono text-[11px] text-zinc-400">
            {code.sampleLabel}
          </span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-400">
            {code.sampleInputLabel}
          </span>
        </div>

        <pre
          tabIndex={0}
          className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-5 text-zinc-300 sm:text-xs"
        >
          <code>{code.sample}</code>
        </pre>

        <div className="border-y border-white/10 bg-lime-300/[0.04] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            {code.servedLabel}
          </p>
          <p className="mt-1.5 flex min-w-0 items-center gap-2 overflow-hidden font-mono text-[11px] sm:text-xs">
            <span className="shrink-0 rounded bg-lime-300/15 px-1.5 py-0.5 font-semibold text-lime-300">
              {code.method}
            </span>
            <span className="min-w-0 truncate text-zinc-300">{code.url}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
          <span className="truncate font-mono text-[11px] text-zinc-400">
            {code.responseLabel}
          </span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-400">
            {code.responseOutputLabel}
          </span>
        </div>

        <pre
          tabIndex={0}
          className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-5 text-zinc-300 sm:text-xs"
        >
          <code>{code.response}</code>
        </pre>
      </div>

      <figcaption className="sr-only">{code.caption}</figcaption>
    </figure>
  );
}
