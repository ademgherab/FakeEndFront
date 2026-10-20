import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-5 py-16 sm:px-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-zinc-400">
          The page you asked for does not exist or has moved. Check the URL, or
          start from the landing page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-200"
          >
            Go home
          </Link>
          <Link
            href="/new"
            className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
          >
            Create a mock API
          </Link>
          <Link
            href="/help"
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Read the quickstart
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
