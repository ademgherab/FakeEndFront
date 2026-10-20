"use client";

import Link from "next/link";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";

export default function AppErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        This page could not be rendered
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Nothing was saved. Reload the page or return home; your draft is kept in
        this tab.
      </p>

      <ErrorAlert
        error={error}
        title="Unexpected rendering error"
        className="mt-6"
      />

      {digest ? (
        <p className="mt-3 text-xs text-zinc-500">
          Reference: <code className="font-mono text-zinc-300">{digest}</code>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => retry()}>
          Reload
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/new">Back to the builder</Link>
        </Button>
      </div>
    </main>
  );
}
