import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProjectGate } from "@/components/project/project-gate";

export const metadata: Metadata = {
  title: "Project",
  robots: { index: false, follow: false },
};

/**
 * The server never reads the token or fetches project data. `ProjectGate` is a
 * client boundary that shows a skeleton until the stored token is validated.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProjectGate slug={slug}>{children}</ProjectGate>;
}
