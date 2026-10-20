import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CreateProjectResponse } from "@/lib/api/generated/schema";
import { useWizardStore } from "@/stores/wizard";
import { clearSuccessShownForTests, markSuccessShown } from "@/lib/storage/success-session";
import { CreateSuccess } from "@/components/wizard/create-success";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  downloadTextFile: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/new/success",
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    info: mocks.toastInfo,
    error: vi.fn(),
  },
}));

vi.mock("@/lib/download", () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

const TOKEN = "et_SecretTokenValue";

const result: CreateProjectResponse = {
  slug: "demo",
  name: "Demo project",
  baseUrl: "https://api.example.com/m/demo",
  editToken: TOKEN,
  expiresAt: "2026-11-01T12:00:00Z",
  endpoints: [
    {
      id: "ep_1",
      method: "GET",
      path: "/users",
      url: "https://api.example.com/m/demo/users",
    },
  ],
};

function renderSuccess() {
  useWizardStore.setState({ createResult: result });
  return render(<CreateSuccess />);
}

describe("CreateSuccess", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearSuccessShownForTests();
    useWizardStore.setState({ createResult: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSuccessShownForTests();
    useWizardStore.setState({ createResult: null });
  });

  it("shows the full token once and masks it on demand", () => {
    renderSuccess();

    const token = screen.getByTestId("token-value");
    expect(token).toHaveTextContent(TOKEN);

    fireEvent.click(screen.getByRole("button", { name: /hide token/i }));

    expect(token).not.toHaveTextContent(TOKEN);
    expect(token).toHaveTextContent("et_Secr…");
    expect(screen.getByRole("button", { name: /reveal token/i })).toBeVisible();
  });

  it("masks the token and disables copy/download after it was shown", () => {
    markSuccessShown(result.slug);
    renderSuccess();

    const token = screen.getByTestId("token-value");
    expect(token).not.toHaveTextContent(TOKEN);
    expect(screen.queryByRole("button", { name: /reveal token/i })).toBeNull();
    expect(screen.getByRole("button", { name: /copy edit token/i })).toBeDisabled();
    expect(screen.getByText(/cannot be displayed again/i)).toBeVisible();
  });

  it("downloads a credentials file that contains the token", () => {
    renderSuccess();

    fireEvent.click(screen.getByRole("button", { name: /download \.txt/i }));

    expect(mocks.downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, content] = mocks.downloadTextFile.mock.calls[0] ?? [];
    expect(filename).toBe("mockapi-demo-credentials.txt");
    expect(String(content)).toContain(TOKEN);
    expect(String(content)).toContain("Keep the edit token private");
  });

  it("only persists the token after the explicit remember opt-in", () => {
    renderSuccess();

    expect(window.localStorage.getItem("mockapi.token.demo")).toBeNull();
    expect(window.sessionStorage.getItem("mockapi.token.demo")).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /remember this token/i }),
    );

    expect(window.localStorage.getItem("mockapi.token.demo")).toBe(TOKEN);
    expect(window.sessionStorage.getItem("mockapi.token.demo")).toBeNull();
  });

  it("copies the token with the legacy fallback when the clipboard API fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    renderSuccess();
    fireEvent.click(screen.getByRole("button", { name: /copy edit token/i }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Edit token copied. Store it somewhere safe.",
      ),
    );
    expect(execCommand).toHaveBeenCalledWith("copy");

    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("requires the saved-token confirmation before opening the project", () => {
    renderSuccess();

    const open = screen.getByRole("button", { name: /open project/i });
    expect(open).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /i saved this token/i }),
    );
    expect(open).toBeEnabled();

    fireEvent.click(open);
    expect(mocks.push).toHaveBeenCalledWith("/p/demo");
  });
});
