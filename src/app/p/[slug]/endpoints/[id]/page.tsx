import { Suspense } from "react";
import { EndpointPage } from "@/components/endpoint/endpoint-page";
import { Skeleton } from "@/components/ui/skeleton";

function EndpointFallback() {
  return (
    <div className="space-y-4" aria-label="Loading endpoint">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function EndpointRoute({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<EndpointFallback />}>
      <EndpointPage endpointId={id} />
    </Suspense>
  );
}
