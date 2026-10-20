import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "How MockAPI turns a JSON sample into a live mock endpoint with configurable delay, errors and pagination.",
  alternates: { canonical: "/help" },
  openGraph: {
    url: "/help",
    title: "MockAPI quickstart — from a sample to a URL",
    description:
      "Paste a JSON sample, review the schema, set delay and errors, then call the live mock URL.",
  },
};

const steps = [
  {
    number: "01",
    title: "Paste a JSON sample",
    body: "Use an object for a single record, or an array for a list. Inference reads field names, value patterns and types to choose realistic generators.",
  },
  {
    number: "02",
    title: "Review the schema",
    body: "Rename fields, change types and pick a different generator. Add null or omission probabilities when a field is sometimes absent.",
  },
  {
    number: "03",
    title: "Set the behaviour",
    body: "Choose a success status, add a fixed or random delay, and inject errors at a percentage you control. Pagination and a fixed seed are optional.",
  },
  {
    number: "04",
    title: "Call the URL",
    body: "Every request returns fresh data with the same shape. CORS is open, so the browser can call it directly. Logs show the last 1,000 requests.",
  },
];

const curlExample = `curl "https://api.example.com/m/k3j9x2m8qa/users?page=2&limit=10"`;

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
          Quickstart
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          From a sample to a URL
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-400">
          MockAPI turns a JSON sample into a live endpoint. The builder is being
          finished; this is the flow it follows.
        </p>

        <ol className="mt-10 space-y-6">
          {steps.map((step) => (
            <li key={step.number} className="flex gap-4">
              <span className="mt-0.5 font-mono text-xs font-semibold text-lime-300">
                {step.number}
              </span>
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <section aria-labelledby="example-title" className="mt-12">
          <h2
            id="example-title"
            className="text-base font-semibold text-zinc-100"
          >
            Example request
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <pre tabIndex={0} className="font-mono text-xs leading-6 text-zinc-300">
              <code>{curlExample}</code>
            </pre>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Replace the slug with your project slug. The mock URL is never
            versioned and ignores unknown query parameters.
          </p>
        </section>

        <aside className="mt-10 rounded-xl border border-lime-300/20 bg-lime-300/[0.04] p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            Do not paste real or sensitive data
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Samples are analyzed in memory and never stored, except for values
            kept by enum generators. Request bodies sent to a mock appear in
            logs, truncated to 4 KB.
          </p>
        </aside>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="rounded-md text-sm font-semibold text-lime-300 underline-offset-4 hover:underline"
          >
            Back to the landing page
          </Link>
          <Link
            href="/new"
            className="rounded-md text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            Open the builder
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
