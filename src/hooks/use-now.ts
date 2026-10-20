"use client";

import { useSyncExternalStore } from "react";

let currentTime = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  currentTime = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(tick, 1_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return currentTime;
}

/** `null` during SSR/hydration so countdown markup cannot mismatch. */
function getServerSnapshot(): number | null {
  return null;
}

/**
 * Shared 1-second clock. Components that render a countdown use this instead
 * of setting state from an effect, and every subscriber shares one timer.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
