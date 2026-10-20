import type { ReactNode } from "react";
import { cn } from "cn";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Consistent empty state with an always-available next action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center sm:p-12",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-lime-300/10 text-lime-300 ring-1 ring-inset ring-lime-300/20">
          {icon}
        </div>
      ) : null}
      <h2 className="mt-4 text-base font-semibold text-zinc-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
        {description}
      </p>
      {action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
