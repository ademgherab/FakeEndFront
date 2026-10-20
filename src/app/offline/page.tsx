"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlugZapIcon, RotateCwIcon } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

/**
 * QLT-12: the fallback page for "the API is unreachable". It is static on
 * purpose, so it still renders when the network is down.
 */
export default function OfflinePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl px-5 py-20 sm:px-8 sm:py-24"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-amber-300/10 text-amber-300 ring-1 ring-inset ring-amber-300/20">
          <PlugZapIcon aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          No connection to the API
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
          The mock API is out of reach
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          The page loaded, but the management API did not answer. Nothing was
          lost: drafts and tokens stay in this browser.
        </p>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            Check these three things
          </h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
            <li>
              <span className="font-medium text-zinc-200">Is the API running?</span>{" "}
              The management API must answer on the origin in{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_API_BASE_URL</code>.
            </li>
            <li>
              <span className="font-medium text-zinc-200">
                Does CORS allow this origin?
              </span>{" "}
              The browser blocks the call when the API does not list this
              frontend origin.
            </li>
            <li>
              <span className="font-medium text-zinc-200">
                Are you offline?
              </span>{" "}
              The mock runtime is a separate host, so a blocked network also
              stops the live URLs.
            </li>
          </ol>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              setChecking(true);
              router.refresh();
              window.setTimeout(() => setChecking(false), 1_500);
            }}
            disabled={checking}
          >
            <RotateCwIcon
              aria-hidden="true"
              className={checking ? "animate-spin" : undefined}
            />
            {checking ? "Retrying…" : "Try again"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/help">Troubleshooting</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
