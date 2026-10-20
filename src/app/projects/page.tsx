import type { Metadata } from "next";
import { RecentProjects } from "@/components/project/recent-projects";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Recent projects",
  description:
    "Projects saved in this browser, plus a form to restore access with a project slug and edit token.",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16"
      >
        <RecentProjects />
      </main>
      <SiteFooter />
    </>
  );
}
