"use client";

import { createContext, useContext } from "react";
import type { MetaResponse } from "@/lib/api/generated/schema";
import type { AppError } from "@/lib/errors";

export interface MetaContextValue {
  data: MetaResponse | null;
  isLoading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
}

export const MetaContext = createContext<MetaContextValue | null>(null);

/** Read the meta payload. Must be called below `<MetaProvider>`. */
export function useMeta(): MetaContextValue {
  const value = useContext(MetaContext);
  if (!value) {
    throw new Error("useMeta must be used inside <MetaProvider>.");
  }
  return value;
}
