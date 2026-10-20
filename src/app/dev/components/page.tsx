import type { Metadata } from "next";
import { PrimitivesDemo } from "@/components/dev/primitives-demo";

export const metadata: Metadata = {
  title: "Shared components",
  robots: { index: false, follow: false },
};

export default function DevComponentsPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
        Developer preview
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        Shared components
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        Review copy feedback, JSON rendering modes, dialogs, badges and time
        formatting without a backend. This route is excluded from search engines.
      </p>
      <div className="mt-10">
        <PrimitivesDemo />
      </div>
    </main>
  );
}
