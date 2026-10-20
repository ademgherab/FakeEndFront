"use client";

import { useEffect, useRef, useState } from "react";

export interface CopyButtonProps {
  value: string;
  label: string;
  /** Accessible name when not defaulting to the visible label. */
  className?: string;
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  return legacyCopy(text);
}

/**
 * Copy button with a clipboard-API fallback and a two-second "Copied"
 * announcement. It never logs the copied value. When the copy fails the
 * button says so instead of silently doing nothing.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function handleClick() {
    void copyText(value).then((ok) => {
      setState(ok ? "copied" : "failed");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setState("idle");
        timer.current = null;
      }, 2000);
    });
  }

  const text =
    state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy";
  const accessibleLabel =
    state === "copied"
      ? `${label} — copied`
      : state === "failed"
        ? `${label} — copy failed`
        : label;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={accessibleLabel}
        className={
          className ??
          "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
        }
      >
        {text}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </>
  );
}
