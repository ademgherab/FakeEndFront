import Link from "next/link";
import { CodePreview } from "@/components/landing/code-preview";
import { landingContent } from "@/content/landing";

function ArrowRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Hero() {
  const { hero } = landingContent;

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-10" />
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />

      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/[0.08] px-3 py-1 text-xs font-medium text-lime-200">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-lime-300" />
              {hero.eyebrow}
            </p>

            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              <span className="block">{hero.titleLead}</span>
              <span className="mt-1 block text-lime-300">{hero.titleAccent}</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
              {hero.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={hero.primaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-200"
              >
                {hero.primaryCta.label}
                <ArrowRight />
              </Link>
              <a
                href={hero.secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
              >
                {hero.secondaryCta.label}
              </a>
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-zinc-400">
              <span className="grid size-4 place-items-center rounded-full bg-lime-300/10 text-lime-300">
                <Check />
              </span>
              {hero.footnote}
            </p>
          </div>

          <CodePreview />
        </div>
      </div>
    </section>
  );
}
