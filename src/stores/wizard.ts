"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  CreateProjectResponse,
  EndpointSettings,
  HttpMethod,
  InferSuggestion,
  InferWarning,
  Schema,
} from "@/lib/api/generated/schema";
import { schemaWithoutIds } from "@/lib/schema/edit";
import { ensureSchemaIds } from "@/lib/schema/tree";

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardEndpointState {
  id: string;
  method: HttpMethod;
  path: string;
  sampleText: string;
  wrapInList: boolean;
  schema: Schema | null;
  warnings: InferWarning[];
  suggestions: InferSuggestion[];
  /** Filled from meta after a successful infer; WIZ-09 owns the full editor. */
  settings: EndpointSettings | null;
  /** True after any schema edit until the draft is reset. */
  schemaDirty: boolean;
  /** Suggestion ids dismissed for this draft. */
  dismissedSuggestionKeys: string[];
}

export interface WizardState {
  step: WizardStep;
  projectName: string;
  endpoint: WizardEndpointState;
  /** Context shown on step 1 when a create response sends the user back. */
  contextError: string | null;
  /** In-memory only. Never persisted because it contains the edit token. */
  createResult: CreateProjectResponse | null;
  /** Editor-only undo stack. Never persisted. */
  schemaHistory: Schema[];
  schemaHistoryIndex: number;

  setStep: (step: WizardStep) => void;
  setProjectName: (name: string) => void;
  setSampleText: (text: string) => void;
  setMethod: (method: HttpMethod) => void;
  setPath: (path: string) => void;
  setWrapInList: (wrap: boolean) => void;
  setInference: (payload: {
    schema: Schema;
    warnings: InferWarning[];
    suggestions: InferSuggestion[];
    settings: EndpointSettings;
  }) => void;
  updateSchema: (schema: Schema) => void;
  undoSchema: () => void;
  redoSchema: () => void;
  setSettings: (settings: EndpointSettings) => void;
  dismissSuggestions: (keys: string[]) => void;
  setContextError: (message: string | null) => void;
  setCreateResult: (result: CreateProjectResponse | null) => void;
  backToSample: () => void;
  resetDraft: () => void;
  clearAfterCreate: (result: CreateProjectResponse) => void;
  resetAll: () => void;
}

export const WIZARD_STORAGE_KEY = "mockapi.wizard.v1";
export const MAX_SCHEMA_HISTORY = 50;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ep_${Math.random().toString(36).slice(2, 10)}`;
}

export function newEndpointState(): WizardEndpointState {
  return {
    id: createId(),
    method: "GET",
    path: "/users",
    sampleText: "",
    wrapInList: false,
    schema: null,
    warnings: [],
    suggestions: [],
    settings: null,
    schemaDirty: false,
    dismissedSuggestionKeys: [],
  };
}

const initialState = (): Pick<
  WizardState,
  "step" | "projectName" | "endpoint" | "contextError" | "createResult" | "schemaHistory" | "schemaHistoryIndex"
> => ({
  step: 1,
  projectName: "",
  endpoint: newEndpointState(),
  contextError: null,
  createResult: null,
  schemaHistory: [],
  schemaHistoryIndex: -1,
});

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setStep: (step) => set({ step }),

      setProjectName: (projectName) => set({ projectName }),

      setSampleText: (sampleText) =>
        set((state) => ({
          step: 1,
          contextError: null,
          schemaHistory: [],
          schemaHistoryIndex: -1,
          endpoint: {
            ...state.endpoint,
            sampleText,
            schema: null,
            warnings: [],
            suggestions: [],
            schemaDirty: false,
            dismissedSuggestionKeys: [],
          },
        })),

      setMethod: (method) =>
        set((state) => ({ endpoint: { ...state.endpoint, method } })),

      setPath: (path) => set((state) => ({ endpoint: { ...state.endpoint, path } })),

      setWrapInList: (wrapInList) =>
        set((state) => ({
          step: 1,
          contextError: null,
          schemaHistory: [],
          schemaHistoryIndex: -1,
          endpoint: {
            ...state.endpoint,
            wrapInList,
            schema: null,
            warnings: [],
            suggestions: [],
            schemaDirty: false,
            dismissedSuggestionKeys: [],
          },
        })),

      setInference: ({ schema, warnings, suggestions, settings }) =>
        set((state) => {
          const withIds = ensureSchemaIds(schema);
          return {
            step: 2,
            contextError: null,
            schemaHistory: [withIds],
            schemaHistoryIndex: 0,
            endpoint: {
              ...state.endpoint,
              schema: withIds,
              warnings,
              suggestions,
              settings,
              schemaDirty: false,
              dismissedSuggestionKeys: [],
            },
          };
        }),

      updateSchema: (schema) =>
        set((state) => {
          const history = [
            ...state.schemaHistory.slice(0, state.schemaHistoryIndex + 1),
            schema,
          ].slice(-MAX_SCHEMA_HISTORY);
          return {
            schemaHistory: history,
            schemaHistoryIndex: history.length - 1,
            endpoint: {
              ...state.endpoint,
              schema,
              schemaDirty: true,
            },
          };
        }),

      undoSchema: () => {
        const state = get();
        if (state.schemaHistoryIndex <= 0) return;
        const index = state.schemaHistoryIndex - 1;
        const schema = state.schemaHistory[index];
        if (!schema) return;
        set({
          schemaHistoryIndex: index,
          endpoint: { ...state.endpoint, schema, schemaDirty: true },
        });
      },

      redoSchema: () => {
        const state = get();
        if (state.schemaHistoryIndex >= state.schemaHistory.length - 1) return;
        const index = state.schemaHistoryIndex + 1;
        const schema = state.schemaHistory[index];
        if (!schema) return;
        set({
          schemaHistoryIndex: index,
          endpoint: { ...state.endpoint, schema, schemaDirty: true },
        });
      },

      setSettings: (settings) =>
        set((state) => ({ endpoint: { ...state.endpoint, settings } })),

      dismissSuggestions: (keys) =>
        set((state) => ({
          endpoint: {
            ...state.endpoint,
            dismissedSuggestionKeys: Array.from(
              new Set([...state.endpoint.dismissedSuggestionKeys, ...keys]),
            ),
          },
        })),

      setContextError: (contextError) => set({ contextError }),

      setCreateResult: (createResult) => set({ createResult }),

      backToSample: () =>
        set((state) => ({
          step: 1,
          schemaHistory: [],
          schemaHistoryIndex: -1,
          endpoint: {
            ...state.endpoint,
            schema: null,
            warnings: [],
            suggestions: [],
            schemaDirty: false,
            dismissedSuggestionKeys: [],
          },
        })),

      resetDraft: () =>
        set((state) => ({
          ...initialState(),
          createResult: state.createResult,
        })),

      clearAfterCreate: (result) =>
        set({
          ...initialState(),
          createResult: result,
        }),

      resetAll: () => set({ ...initialState() }),
    }),
    {
      name: WIZARD_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        step: state.step,
        projectName: state.projectName,
        contextError: state.contextError,
        endpoint: {
          ...state.endpoint,
          schema: state.endpoint.schema
            ? schemaWithoutIds(state.endpoint.schema)
            : null,
        },
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<WizardState> | undefined;
        if (!stored) return current;
        const endpoint: WizardEndpointState = {
          ...current.endpoint,
          ...(stored.endpoint ?? {}),
          schemaDirty: stored.endpoint?.schemaDirty ?? false,
          dismissedSuggestionKeys: stored.endpoint?.dismissedSuggestionKeys ?? [],
        };
        const schema = endpoint.schema ? ensureSchemaIds(endpoint.schema) : null;
        return {
          ...current,
          ...stored,
          createResult: null,
          endpoint: { ...endpoint, schema },
          schemaHistory: schema ? [schema] : [],
          schemaHistoryIndex: schema ? 0 : -1,
        };
      },
    },
  ),
);

export function hasWizardDraft(state: WizardState): boolean {
  return (
    state.step > 1 ||
    state.endpoint.sampleText.trim().length > 0 ||
    Boolean(state.endpoint.schema) ||
    state.projectName.trim().length > 0
  );
}

export function canUndoSchema(state: { schemaHistoryIndex: number }): boolean {
  return state.schemaHistoryIndex > 0;
}

export function canRedoSchema(state: {
  schemaHistoryIndex: number;
  schemaHistory: readonly unknown[];
}): boolean {
  return state.schemaHistoryIndex < state.schemaHistory.length - 1;
}

/**
 * Rehydrates the persisted draft on the client only. Returning false lets the
 * page render a skeleton instead of hydrating mismatched editor markup.
 */
export function useWizardHydration(): boolean {
  useEffect(() => {
    if (!useWizardStore.persist.hasHydrated()) {
      void useWizardStore.persist.rehydrate();
    }
  }, []);

  return useSyncExternalStore(
    (onStoreChange) => useWizardStore.persist.onFinishHydration(onStoreChange),
    () => useWizardStore.persist.hasHydrated(),
    () => false,
  );
}
