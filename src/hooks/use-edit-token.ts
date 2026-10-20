"use client";

import { useSyncExternalStore } from "react";
import {
  getServerTokenSnapshot,
  getToken,
  subscribeToTokens,
} from "@/lib/credentials";

/**
 * Reads the in-memory edit token for a slug.
 *
 * The token never reaches the server: the server snapshot is always `null`,
 * so the server-rendered markup is identical whether or not a token is
 * known, and the client picks it up right after hydration.
 */
export function useEditToken(slug: string): string | null {
  return useSyncExternalStore(
    subscribeToTokens,
    () => getToken(slug),
    getServerTokenSnapshot,
  );
}
