"use client";

import { use } from "react";
import { ProjectWorkspace } from "@/components/project/project-workspace";

/**
 * Client-rendered project workspace. The edit token lives in memory, so the
 * page never server-renders project data: it asks for the token first and
 * only then calls the API.
 */
export default function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <ProjectWorkspace slug={slug} />;
}
