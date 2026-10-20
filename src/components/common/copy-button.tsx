"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

export interface CopyButtonProps {
  value: string;
  label: string;
  toastMessage?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  /** Render only the icon; the accessible label still describes the action. */
  iconOnly?: boolean;
}

export function CopyButton({
  value,
  label,
  toastMessage = "Copied to clipboard.",
  className,
  variant = "outline",
  size = "sm",
  disabled,
  iconOnly = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    const ok = await copyText(value);
    if (!ok) {
      toast.error("Could not copy", {
        description: "Select the value and copy it manually.",
      });
      return;
    }
    setCopied(true);
    toast.success(toastMessage);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCopied(false);
      timer.current = null;
    }, 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={copied ? `${label} — copied` : label}
        disabled={disabled}
        onClick={handleCopy}
        className={cn("gap-1.5", className)}
      >
        {copied ? (
          <CheckIcon aria-hidden="true" className="text-lime-300" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {iconOnly ? null : <span>{copied ? "Copied" : "Copy"}</span>}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard." : ""}
      </span>
    </>
  );
}
