import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore, WIZARD_STORAGE_KEY, newEndpointState } from "@/stores/wizard";
import { makeCreateProjectResponse } from "@/test/fixtures/meta";

function endpointSettings() {
  return {
    successStatus: 200,
    delay: { minMs: 0, maxMs: 0 },
    errorInjection: { rate: 0, codes: [500] },
    list: { minSize: 10, maxSize: 10, path: null },
    pagination: null,
    seed: null,
  };
}

describe("wizard store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useWizardStore.getState().resetAll();
  });

  it("keeps the raw sample text and endpoint basics", () => {
    const store = useWizardStore.getState();
    store.setSampleText('{"a":1}');
    store.setMethod("POST");
    store.setPath("/orders");
    store.setWrapInList(true);

    const state = useWizardStore.getState();
    expect(state.endpoint.sampleText).toBe('{"a":1}');
    expect(state.endpoint.method).toBe("POST");
    expect(state.endpoint.path).toBe("/orders");
    expect(state.endpoint.wrapInList).toBe(true);
  });

  it("advances to review after infer and keeps warnings", () => {
    const warning = { path: "/id", code: "enum_low_cardinality", message: "Only two values." };
    useWizardStore.getState().setInference({
      schema: { version: 1, root: { name: "user", type: "object", fields: [] } },
      warnings: [warning],
      suggestions: [],
      settings: endpointSettings(),
    });

    const state = useWizardStore.getState();
    expect(state.step).toBe(2);
    expect(state.endpoint.warnings).toEqual([warning]);
    expect(state.endpoint.schema?.version).toBe(1);
  });

  it("returns to step 1 and clears stale inference when the sample changes", () => {
    useWizardStore.getState().setInference({
      schema: { version: 1, root: { name: "user", type: "object", fields: [] } },
      warnings: [],
      suggestions: [],
      settings: endpointSettings(),
    });

    useWizardStore.getState().setSampleText('{"b":2}');

    const state = useWizardStore.getState();
    expect(state.step).toBe(1);
    expect(state.endpoint.schema).toBeNull();
    expect(state.endpoint.warnings).toEqual([]);
  });

  it("never persists the create result or token", () => {
    const result = makeCreateProjectResponse();
    useWizardStore.getState().clearAfterCreate(result);

    const raw = window.sessionStorage.getItem(WIZARD_STORAGE_KEY) ?? "";
    expect(raw).not.toContain(result.editToken);
    expect(useWizardStore.getState().createResult).toEqual(result);
    expect(useWizardStore.getState().endpoint.sampleText).toBe("");
  });

  it("resets the draft but keeps the in-memory result", () => {
    const result = makeCreateProjectResponse();
    useWizardStore.getState().clearAfterCreate(result);
    useWizardStore.getState().resetDraft();

    expect(useWizardStore.getState().createResult).toEqual(result);
    expect(useWizardStore.getState().step).toBe(1);
  });

  it("creates a fresh endpoint identity when reset", () => {
    const first = useWizardStore.getState().endpoint.id;
    useWizardStore.getState().resetDraft();
    const second = useWizardStore.getState().endpoint.id;
    expect(first).not.toBe(second);
    expect(newEndpointState().id).toBeTruthy();
  });
});
