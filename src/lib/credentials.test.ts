import { describe, expect, it } from "vitest";
import {
  buildCredentialsJson,
  buildCredentialsText,
  credentialsFileBase,
  toCredentials,
} from "@/lib/credentials";
import { makeCreateProjectResponse } from "@/test/fixtures/meta";

describe("credentials download", () => {
  const result = makeCreateProjectResponse();

  it("includes slug, token, base URL, endpoints and expiry in text", () => {
    const text = buildCredentialsText(result);

    expect(text).toContain(result.slug);
    expect(text).toContain(result.editToken);
    expect(text).toContain(result.baseUrl);
    expect(text).toContain(result.expiresAt);
    expect(text).toContain(result.endpoints[0]?.url ?? "");
    expect(text).toContain("Authorization: Bearer");
  });

  it("includes the same data in JSON", () => {
    const parsed = JSON.parse(buildCredentialsJson(result)) as ReturnType<
      typeof toCredentials
    >;

    expect(parsed.slug).toBe(result.slug);
    expect(parsed.editToken).toBe(result.editToken);
    expect(parsed.endpoints[0]?.url).toBe(result.endpoints[0]?.url);
  });

  it("never puts the token in a URL", () => {
    const parsed = toCredentials(result);
    expect(parsed.baseUrl).not.toContain(parsed.editToken);
    for (const endpoint of parsed.endpoints) {
      expect(endpoint.url).not.toContain(parsed.editToken);
    }
  });

  it("uses a safe filename", () => {
    expect(credentialsFileBase(result)).toBe(
      "mockapi-k3j9x2m8qa-credentials",
    );
  });
});
