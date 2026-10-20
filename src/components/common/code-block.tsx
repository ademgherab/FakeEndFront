import type { ReactNode } from "react";
import { cn } from "cn";
import { CopyButton } from "@/components/common/copy-button";

export interface CodeBlockProps {
  code: string;
  label?: string;
  language?: string;
  copyLabel?: string;
  className?: string;
  maxHeight?: string;
  wrap?: boolean;
  actions?: ReactNode;
}

export function CodeBlock({
  code,
  label,
  language,
  copyLabel = "Copy code",
  className,
  maxHeight = "24rem",
  wrap = false,
  actions,
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-black/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {label ? <span className="font-medium text-zinc-200">{label}</span> : null}
          {language ? (
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide">
              {language}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          <CopyButton
            value={code}
            label={copyLabel}
            toastMessage="Copied."
            variant="ghost"
            size="xs"
          />
        </div>
      </div>
      <pre
        className={cn(
          "overflow-auto p-3 font-mono text-xs leading-6 text-zinc-200",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        )}
        style={{ maxHeight }}
        tabIndex={0}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
