"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "cn";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-white/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-lime-300/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-lime-300/60 data-[state=checked]:bg-lime-300",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-zinc-300 shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5 data-[state=checked]:bg-zinc-950",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
