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

function Shield() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
      <path d="m9 12 2 2 4-4" />
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
              <p className="mt-2 text-sm leading-6 text-zinc-400">{step.body}</p>
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
              <p className="mt-2 text-sm leading-6 text-zinc-400">{feature.body}</p>
            </article>
          ))}
        </div>
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
          <span className="grid size-11 place-items-center rounded-lg bg-lime-300/10 text-lime-300 ring-1 ring-inset ring-lime-300/25">
            <Shield />
          </span>
          <div className="mt-6">
            <Eyebrow>{privacy.eyebrow}</Eyebrow>
            <h2
              id="privacy-title"
              className="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
            >
              {privacy.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
              {privacy.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
