import { beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_PROJECTS_KEY,
  TOKEN_PREFIX,
  clearSessionTokensForTests,
  clearTokenStorageForTests,
  getToken,
  hasToken,
  listRecentProjects,
  removeRecentProject,
  removeToken,
  saveToken,
} from "@/lib/storage/token-store";
import { maskToken } from "@/lib/format";

describe("token store", () => {
  beforeEach(() => {
    clearTokenStorageForTests();
    clearSessionTokensForTests();
    window.localStorage.clear();
  });

  it("stores a remembered token and never puts it in recent-project metadata", () => {
    saveToken("abc123", "et_SecretTokenValue", {
      remember: true,
      name: "Demo",
      baseUrl: "https://api.example.com/m/abc123",
      expiresAt: "2026-01-01T00:00:00Z",
    });

    expect(getToken("abc123")).toBe("et_SecretTokenValue");
    expect(window.localStorage.getItem(`${TOKEN_PREFIX}abc123`)).toBe(
      "et_SecretTokenValue",
    );

    const recentRaw = window.localStorage.getItem(RECENT_PROJECTS_KEY) ?? "";
    expect(recentRaw).toContain("abc123");
    expect(recentRaw).not.toContain("et_SecretTokenValue");
  });

  it("keeps a non-remembered token only in memory", () => {
    saveToken("session", "et_SessionOnlyToken", { remember: false });

    expect(getToken("session")).toBe("et_SessionOnlyToken");
    expect(window.localStorage.getItem(`${TOKEN_PREFIX}session`)).toBeNull();
  });

  it("forgets the token but keeps the recent entry after removal", () => {
    saveToken("abc123", "et_SecretTokenValue", { remember: true, name: "Demo" });
    removeToken("abc123");

    expect(hasToken("abc123")).toBe(false);
    expect(listRecentProjects().map((project) => project.slug)).toContain("abc123");
  });

  it("does not return the token after the in-memory session is cleared", () => {
    saveToken("session", "et_SessionOnlyToken", { remember: false });
    clearSessionTokensForTests();

    expect(getToken("session")).toBeNull();
  });

  it("sorts recent projects by most recent and removes entries", () => {
    saveToken("one", "et_OneTokenValue", { remember: true, name: "One" });
    saveToken("two", "et_TwoTokenValue", { remember: true, name: "Two" });

    expect(listRecentProjects()[0]?.slug).toBe("two");
    removeRecentProject("two");
    expect(listRecentProjects().map((project) => project.slug)).toEqual(["one"]);
  });
});

describe("maskToken", () => {
  it("shows only the prefix", () => {
    expect(maskToken("et_Qm3v1234567890")).toBe("et_Qm3v…");
  });

  it("handles an empty value", () => {
    expect(maskToken("")).toBe("");
  });
});
