"use client";

import Link from "next/link";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import { EndpointWorkspace } from "@/components/endpoint/endpoint-workspace";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta } from "@/hooks/use-meta";
import { useProject } from "@/hooks/use-project";

export interface EndpointPageProps {
  endpointId: string;
}

export function EndpointPage({ endpointId }: EndpointPageProps) {
  const { slug, project } = useProject();
  const { data: meta, error: metaError, isLoading: metaLoading, refresh } = useMeta();

  if (!project) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading endpoint">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const endpoint = project.endpoints.find((entry) => entry.id === endpointId);

  if (!endpoint) {
    return (
      <EmptyState
        icon={<TriangleAlertIcon aria-hidden="true" />}
        title="Endpoint not found"
        description="This endpoint does not exist, was deleted, or belongs to a different project."
        action={
          <Button asChild>
            <Link href={`/p/${slug}`}>
              <ArrowLeftIcon aria-hidden="true" />
              Back to overview
            </Link>
          </Button>
        }
      />
    );
  }

  if (!meta) {
    if (metaError) {
      return (
        <div className="space-y-4">
          <ErrorAlert
            error={metaError}
            title="Could not load endpoint limits"
            onRetry={() => {
              void refresh();
            }}
          />
          <Button asChild variant="outline">
            <Link href={`/p/${slug}`}>Back to overview</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading endpoint limits">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <span className="sr-only">
          {metaLoading ? "Loading endpoint limits…" : ""}
        </span>
      </div>
    );
  }

  return <EndpointWorkspace endpoint={endpoint} meta={meta} />;
}
