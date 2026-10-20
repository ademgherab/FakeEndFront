"use client";

import { createContext, useContext } from "react";
import type { ProjectResponse } from "@/lib/api/generated/schema";
import type { AppError } from "@/lib/errors";

export type ProjectGateStatus =
  | "checking"
  | "missing"
  | "loading"
  | "invalid"
  | "not_found"
  | "expired"
  | "error"
  | "ready";

export interface SubmitTokenResult {
  ok: boolean;
}

export interface ProjectContextValue {
  slug: string;
  token: string | null;
  project: ProjectResponse | null;
  status: ProjectGateStatus;
  error: AppError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  submitToken: (token: string, remember: boolean) => Promise<SubmitTokenResult>;
  clearToken: () => void;
  /** Replace the cached project after a successful mutation. */
  setProject: (project: ProjectResponse) => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

/** Project data and token gate state. Must be used below `<ProjectGate>`. */
export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error("useProject must be used inside <ProjectGate>.");
  }
  return value;
}
