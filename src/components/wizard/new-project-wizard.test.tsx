import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppError } from "@/lib/errors";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { useWizardStore } from "@/stores/wizard";
import { makeCreateProjectResponse, makeMeta } from "@/test/fixtures/meta";
import { NewProjectWizard } from "@/components/wizard/new-project-wizard";

const mocks = vi.hoisted(() => ({
  inferSchema: vi.fn(),
  createProject: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(""),
}));

vi.mock("@/lib/api/infer", () => ({ inferSchema: mocks.inferSchema }));

vi.mock("@/lib/api/projects", () => ({
  createProject: mocks.createProject,
  buildCreateProjectRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => "/new",
}));

vi.mock("@/hooks/use-meta", () => ({
  useMeta: () => ({
    data: makeMeta(),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

const schema = {
  version: 1 as const,
  root: { name: "root", type: "object" as const, fields: [] },
};

async function renderWizard() {
  render(<NewProjectWizard />);
  return screen.findByRole("button", { name: /^infer schema$/i });
}

async function setSample(value: string) {
  act(() => {
    useWizardStore.getState().setSampleText(value);
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^infer schema$/i })).toBeEnabled(),
  );
}

function seedReviewStep() {
  const meta = makeMeta();
  useWizardStore.getState().setInference({
    schema: { version: 1, root: { name: "root", type: "object", fields: [] } },
    warnings: [],
    suggestions: [],
    settings: defaultEndpointSettings("GET", meta),
  });
  useWizardStore.getState().setStep(4);
}

describe("NewProjectWizard inference (WIZ-03)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    useWizardStore.getState().resetAll();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.inferSchema.mockReset();
    mocks.createProject.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("infers the pasted sample, stores the result and advances to step 2", async () => {
    mocks.inferSchema.mockResolvedValue({
      schema,
      warnings: [],
      suggestions: [],
    });

    await renderWizard();
    await setSample('{"id":1,"name":"Ada"}');
    fireEvent.click(screen.getByRole("button", { name: /^infer schema$/i }));

    await waitFor(() => expect(mocks.inferSchema).toHaveBeenCalledTimes(1));
    expect(mocks.inferSchema.mock.calls[0]?.[0]).toMatchObject({
      sample: { id: 1, name: "Ada" },
      options: { wrapInList: false },
    });

    await waitFor(() => expect(useWizardStore.getState().step).toBe(2));
    expect(useWizardStore.getState().endpoint.schema?.root.type).toBe("object");
    expect(mocks.push).toHaveBeenCalledWith("/new?step=2", { scroll: false });
  });

  it("keeps the user on step 1 and shows the error for an invalid sample response", async () => {
    mocks.inferSchema.mockRejectedValue(
      new AppError({
        status: 422,
        code: "sample_invalid",
        detail: "Sample values are inconsistent.",
      }),
    );

    await renderWizard();
    await setSample('{"id":1}');
    fireEvent.click(screen.getByRole("button", { name: /^infer schema$/i }));

    await screen.findByText(/that sample cannot be used/i);

    expect(useWizardStore.getState().step).toBe(1);
    expect(useWizardStore.getState().endpoint.schema).toBeNull();
    expect(mocks.push).not.toHaveBeenCalledWith(
      "/new?step=2",
      expect.anything(),
    );
  });

  it("aborts an in-flight inference and ignores its stale result when the sample changes", async () => {
    let resolveInfer: (value: unknown) => void = () => {};
    mocks.inferSchema.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInfer = resolve;
        }),
    );

    await renderWizard();
    await setSample('{"id":1}');
    fireEvent.click(screen.getByRole("button", { name: /^infer schema$/i }));

    await waitFor(() => expect(mocks.inferSchema).toHaveBeenCalledTimes(1));
    const signal = mocks.inferSchema.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    act(() => {
      useWizardStore.getState().setSampleText('{"id":2}');
    });
    await waitFor(() => expect(signal.aborted).toBe(true));

    resolveInfer({ schema, warnings: [], suggestions: [] });
    await waitFor(() =>
      expect(useWizardStore.getState().endpoint.schema).toBeNull(),
    );
    expect(useWizardStore.getState().step).toBe(1);
    expect(mocks.push).not.toHaveBeenCalledWith(
      "/new?step=2",
      expect.anything(),
    );
  });
});

describe("NewProjectWizard create (WIZ-12)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    useWizardStore.getState().resetAll();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.createProject.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function renderReviewStep() {
    seedReviewStep();
    render(<NewProjectWizard />);
    return screen.findByRole("button", { name: /^create project$/i });
  }

  it("creates once, stores the result and routes to the success screen", async () => {
    const result = makeCreateProjectResponse();
    mocks.createProject.mockResolvedValue(result);

    const create = await renderReviewStep();
    fireEvent.click(create);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/new/success"),
    );
    expect(mocks.createProject).toHaveBeenCalledTimes(1);
    expect(useWizardStore.getState().createResult?.editToken).toBe(
      result.editToken,
    );
    expect(useWizardStore.getState().step).toBe(1);
  });

  it("blocks a double submit while the first request is pending", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    mocks.createProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const create = await renderReviewStep();
    fireEvent.click(create);
    fireEvent.click(create);
    fireEvent.click(create);

    expect(mocks.createProject).toHaveBeenCalledTimes(1);

    resolveCreate(makeCreateProjectResponse());
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/new/success"),
    );
  });

  it("routes a 409 duplicate endpoint back to step 1 with the server field error", async () => {
    mocks.createProject.mockRejectedValue(
      new AppError({
        status: 409,
        code: "duplicate_endpoint",
        errors: { "endpoints[0].path": ["This path already exists."] },
      }),
    );

    const create = await renderReviewStep();
    fireEvent.click(create);

    await waitFor(() => expect(useWizardStore.getState().step).toBe(1));
    expect(useWizardStore.getState().contextError).toMatch(
      /another endpoint uses the same method/i,
    );
    expect(await screen.findByText("This path already exists.")).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalledWith("/new/success");
    expect(useWizardStore.getState().createResult).toBeNull();
  });

  it("disables create until the Retry-After window elapses on 429", async () => {
    mocks.createProject.mockRejectedValue(
      new AppError({ status: 429, code: "rate_limited", retryAfter: 5 }),
    );

    const create = await renderReviewStep();
    fireEvent.click(create);

    await screen.findByText(/too many requests/i);
    await waitFor(() => expect(create).toBeDisabled());
    expect(useWizardStore.getState().createResult).toBeNull();
    expect(mocks.push).not.toHaveBeenCalledWith("/new/success");
  });

  it("never shows success on a network failure and keeps the draft", async () => {
    mocks.createProject.mockRejectedValue(new TypeError("fetch failed"));

    const create = await renderReviewStep();
    fireEvent.click(create);

    await waitFor(() => expect(create).toBeEnabled());
    expect(useWizardStore.getState().step).toBe(4);
    expect(useWizardStore.getState().createResult).toBeNull();
    expect(useWizardStore.getState().endpoint.schema).not.toBeNull();
    expect(mocks.push).not.toHaveBeenCalledWith("/new/success");
  });
});
