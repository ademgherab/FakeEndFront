import type { Metadata } from "next";
import { Suspense } from "react";
import { MetaProvider } from "@/components/providers/meta-provider";
import { NewProjectWizard } from "@/components/wizard/new-project-wizard";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Builder",
  robots: { index: false, follow: false },
};

function BuilderFallback() {
  return (
    <div className="space-y-4" aria-label="Loading builder">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <Suspense fallback={<BuilderFallback />}>
          <MetaProvider>
            <NewProjectWizard />
          </MetaProvider>
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
