"use client";

import { usePathname } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";
import { cn } from "cn";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { NavLink } from "@/components/layout/nav-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-project";
import { maskToken } from "@/lib/format";

export function ProjectNav() {
  const { slug, token, project, clearToken } = useProject();
  const pathname = usePathname();
  const root = `/p/${slug}`;
  const logsHref = `${root}/logs`;
  const onLogs = pathname.startsWith(logsHref);

  return (
    <div className="mb-8 border-b border-white/10 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            Project
          </p>
          <p className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-100">
            {project?.name?.trim() || "Untitled project"}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            {slug}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-lime-300/25 bg-lime-300/[0.06] text-lime-200"
          >
            <KeyRoundIcon aria-hidden="true" />
            {token ? maskToken(token) : "Locked"}
          </Badge>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" size="xs">
                Forget token
              </Button>
            }
            title="Forget this token?"
            description="The token will be removed from this browser. Without it you cannot reopen this project, and it cannot be recovered."
            confirmLabel="Forget token"
            destructive
            onConfirm={clearToken}
          />
        </div>
      </div>

      <nav aria-label="Project" className="mt-4 flex items-center gap-1 overflow-x-auto">
        <NavLink
          href={root}
          label="Overview"
          exact
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap",
            pathname === root
              ? "bg-white/[0.08] text-zinc-50"
              : "text-zinc-400 hover:text-zinc-100",
          )}
        />
        <NavLink
          href={logsHref}
          label="Logs"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap",
            onLogs
              ? "bg-white/[0.08] text-zinc-50"
              : "text-zinc-400 hover:text-zinc-100",
          )}
        />
      </nav>
    </div>
  );
}
