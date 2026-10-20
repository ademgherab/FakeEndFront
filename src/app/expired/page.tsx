import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Project expired",
  description:
    "Expired MockAPI projects are read-only for a short grace period, then permanently deleted.",
  robots: { index: false, follow: false },
};

export default async function ExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.slug;
  const slug = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24"
      >
        <EmptyState
          icon={<TriangleAlertIcon aria-hidden="true" />}
          title="This project has expired"
          description={
            slug
              ? `The project "${slug}" reached the end of its lifetime. Expired projects are read-only during a 3-day grace window, then permanently deleted. The edit token cannot recover a deleted project.`
              : "This project reached the end of its lifetime. Expired projects are read-only during a 3-day grace window, then permanently deleted. The edit token cannot recover a deleted project."
          }
          action={
            <>
              <Button asChild>
                <Link href="/new">
                  Create a new project
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/projects">Recent projects</Link>
              </Button>
            </>
          }
        />

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-zinc-400">
          <h2 className="text-sm font-semibold text-zinc-100">
            What still works during the grace period?
          </h2>
          <p className="mt-2">
            Read-only views may remain available briefly and request logs are
            kept for a short time. Writes such as saving an endpoint, clearing
            logs or changing settings are rejected with{" "}
            <code className="font-mono text-zinc-300">410 project_expired</code>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
