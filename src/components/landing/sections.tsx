import Link from "next/link";
import type { ReactNode } from "react";
import { FeatureIcon } from "@/components/landing/feature-icon";
import { landingContent } from "@/content/landing";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
      {children}
    </p>
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

export function HowItWorks() {
  const { steps } = landingContent;

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 border-t border-white/10"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <Eyebrow>{steps.eyebrow}</Eyebrow>
        <h2
          id="how-it-works-title"
          className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          {steps.title}
        </h2>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.items.map((step) => (
            <li
              key={step.number}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
            >
              <span className="font-mono text-xs font-semibold text-lime-300">
                {step.number}
              </span>
              <h3 className="mt-4 text-base font-semibold text-zinc-100">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  const { features } = landingContent;

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-t border-white/10"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <Eyebrow>{features.eyebrow}</Eyebrow>
        <h2
          id="features-title"
          className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          {features.title}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          {features.description}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.items.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-6"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-lime-300/10 text-lime-300 ring-1 ring-inset ring-lime-300/20">
                <FeatureIcon name={feature.icon} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-zinc-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {feature.body}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-6 text-zinc-400">
          {features.extras}
        </p>
      </div>
    </section>
  );
}

export function Privacy() {
  const { privacy } = landingContent;

  return (
    <section
      id="privacy"
      aria-labelledby="privacy-title"
      className="scroll-mt-20 border-t border-white/10"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="rounded-2xl border border-lime-300/20 bg-lime-300/[0.04] p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <Eyebrow>{privacy.eyebrow}</Eyebrow>
              <h2
                id="privacy-title"
                className="mt-3 text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
              >
                {privacy.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">
                {privacy.body}
              </p>
            </div>

            <ul className="space-y-3 lg:pt-9">
              {privacy.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lime-300/15 text-lime-300">
                    <Check />
                  </span>
                  <span className="text-zinc-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { finalCta } = landingContent;

  return (
    <section aria-labelledby="final-cta-title" className="border-t border-white/10">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-24">
        <h2
          id="final-cta-title"
          className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          {finalCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-400">
          {finalCta.description}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={finalCta.primaryCta.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-200 sm:w-auto"
          >
            {finalCta.primaryCta.label}
            <ArrowRight />
          </Link>
          <Link
            href={finalCta.secondaryCta.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
          >
            {finalCta.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
