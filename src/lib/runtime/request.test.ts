import { describe, expect, it } from "vitest";
import {
  buildRuntimeUrl,
  injectedErrorFromHeaders,
  readRuntimeHeaders,
  requiredPathParams,
  statusCategory,
  validateRequestBody,
  type KeyValueRow,
} from "@/lib/runtime/request";

function row(key: string, value: string, id = `${key}-${value}`): KeyValueRow {
  return { id, key, value };
}

describe("buildRuntimeUrl (RUN-01)", () => {
  const base = {
    baseUrl: "https://api.example.com/m/demo",
    path: "/users/{id}",
  };

  it("encodes path parameter values", () => {
    const result = buildRuntimeUrl({
      ...base,
      pathParams: { id: "a b/c" },
      queryParams: [],
    });
    expect(result.url).toBe(
      "https://api.example.com/m/demo/users/a%20b%2Fc",
    );
    expect(result.missing).toEqual([]);
  });

  it("lists missing path parameters instead of guessing values", () => {
    const result = buildRuntimeUrl({
      ...base,
      pathParams: { id: "  " },
      queryParams: [],
    });
    expect(result.missing).toEqual(["id"]);
    expect(result.url).toContain("{id}");
  });

  it("prefers the server-provided endpoint URL when present", () => {
    const result = buildRuntimeUrl({
      endpointUrl: "https://runtime.example/{id}/detail",
      baseUrl: base.baseUrl,
      path: base.path,
      pathParams: { id: "42" },
      queryParams: [],
    });
    expect(result.url).toBe("https://runtime.example/42/detail");
  });

  it("appends and encodes query parameters", () => {
    const result = buildRuntimeUrl({
      ...base,
      pathParams: { id: "1" },
      queryParams: [row("search", "Ada Lovelace"), row("page", "2")],
    });
    expect(result.url).toBe(
      "https://api.example.com/m/demo/users/1?search=Ada+Lovelace&page=2",
    );
  });

  it("preserves query parameters already present in the URL", () => {
    const result = buildRuntimeUrl({
      endpointUrl: "https://runtime.example/items?token=abc",
      baseUrl: base.baseUrl,
      path: "/items",
      pathParams: {},
      queryParams: [row("page", "2")],
    });
    expect(result.url).toBe("https://runtime.example/items?token=abc&page=2");
  });

  it("reports a value with an empty key but ignores an empty pair", () => {
    const result = buildRuntimeUrl({
      ...base,
      pathParams: { id: "1" },
      queryParams: [row("", "orphan"), row("", "")],
    });
    expect(result.invalidQueryKeys).toEqual(["(empty key)"]);
    expect(result.url).toBe("https://api.example.com/m/demo/users/1");
  });

  it("exposes required parameters in path order", () => {
    expect(requiredPathParams("/orgs/{org}/users/{id}")).toEqual(["org", "id"]);
  });
});

describe("validateRequestBody", () => {
  it("never sends a body for GET or DELETE", () => {
    expect(validateRequestBody('{"ignored":true}', "GET")).toEqual({
      valid: true,
      hasBody: false,
    });
    expect(validateRequestBody('{"ignored":true}', "DELETE")).toEqual({
      valid: true,
      hasBody: false,
    });
  });

  it("treats an empty body as absent", () => {
    expect(validateRequestBody("   ", "POST")).toEqual({
      valid: true,
      hasBody: false,
    });
  });

  it("parses a JSON body", () => {
    expect(validateRequestBody('{"name":"Ada"}', "PUT")).toEqual({
      valid: true,
      hasBody: true,
      value: { name: "Ada" },
    });
  });

  it("returns an error for malformed JSON", () => {
    const result = validateRequestBody("{", "POST");
    expect(result.valid).toBe(false);
    expect(result.hasBody).toBe(true);
    expect(result.error).toBeTruthy();
  });
});

describe("runtime response helpers", () => {
  it("reads only headers the runtime exposes", () => {
    const headers = new Headers({
      "x-request-id": "req_1",
      "x-mock-injected-error": "injected_error",
      "content-type": "application/json",
    });
    expect(readRuntimeHeaders(headers)).toEqual([
      { name: "x-request-id", value: "req_1" },
      { name: "x-mock-injected-error", value: "injected_error" },
    ]);
    expect(injectedErrorFromHeaders(headers)).toBe("injected_error");
  });

  it("classifies status codes", () => {
    expect(statusCategory(0)).toBe("No response");
    expect(statusCategory(204)).toBe("Success");
    expect(statusCategory(404)).toBe("Client error");
    expect(statusCategory(500)).toBe("Server error");
  });
});
