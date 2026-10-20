import type { ReactNode } from "react";
import { cn } from "cn";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}

/** Shared page heading so every workspace page starts the same way. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  titleId,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
            {eyebrow}
          </p>
        ) : null}
        <h1
          id={titleId}
          className={cn(
            "text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl",
            eyebrow && "mt-2",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
