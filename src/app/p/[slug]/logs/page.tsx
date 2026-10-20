import { Suspense } from "react";
import { LogsView } from "@/components/logs/logs-view";
import { Skeleton } from "@/components/ui/skeleton";

function LogsFallback() {
  return (
    <div className="space-y-3" aria-label="Loading request logs">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function ProjectLogsPage() {
  return (
    <Suspense fallback={<LogsFallback />}>
      <LogsView heading="Project request logs" />
    </Suspense>
  );
}
