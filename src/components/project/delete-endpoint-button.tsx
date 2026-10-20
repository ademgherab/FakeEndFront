"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteEndpoint } from "@/lib/api/endpoints";
import { AppError, isAppError } from "@/lib/errors";
import { useProject } from "@/hooks/use-project";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";

export function DeleteEndpointButton({
  endpointId,
  endpointPath,
}: {
  endpointId: string;
  endpointPath: string;
}) {
  const { slug, token, refresh } = useProject();
  const [error, setError] = useState<AppError | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="ghost" size="xs">
            <Trash2Icon aria-hidden="true" />
            Delete
          </Button>
        }
        title="Delete this endpoint?"
        description={`${endpointPath} will stop answering immediately. The rest of the project is not affected.`}
        confirmLabel="Delete endpoint"
        destructive
        onConfirm={async () => {
          if (!token) return;
          try {
            await deleteEndpoint(slug, endpointId, token);
            await refresh();
            toast.success("Endpoint deleted");
            setError(null);
          } catch (caught) {
            const appError = isAppError(caught)
              ? caught
              : new AppError({
                  status: 0,
                  code: "unknown_error",
                  title: "The endpoint was not deleted",
                });
            // A 404 means it is already gone; refreshing is the honest result.
            if (appError.code === "endpoint_not_found") {
              await refresh();
              toast.success("Endpoint was already deleted");
              return;
            }
            setError(appError);
          }
        }}
      />
      {error ? <ErrorAlert error={error} compact /> : null}
    </div>
  );
}
