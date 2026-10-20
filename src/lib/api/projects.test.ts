import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EndpointDraftLike } from "@/lib/api/projects";
import {
  buildCreateProjectRequest,
  createProject,
  normalizeCreateProjectResponse,
  stripSchemaIds,
} from "@/lib/api/projects";
import { AppError } from "@/lib/errors";
import { makeCreateProjectResponse, makeMeta } from "@/test/fixtures/meta";

const meta = makeMeta();

function draft(overrides: Partial<EndpointDraftLike> = {}): EndpointDraftLike {
  return {
    method: "GET",
    path: "/users",
    sampleText: "",
    wrapInList: false,
    schema: null,
    settings: null,
    ...overrides,
  };
}

describe("buildCreateProjectRequest", () => {
  it("sends a schema and no sample when the schema exists", () => {
    const request = buildCreateProjectRequest({
      name: "  Demo  ",
      endpoint: draft({
        schema: {
          version: 1,
          root: {
            id: "internal-root",
            name: "root",
            type: "object",
            fields: [
              { id: "internal-id", name: "id", type: "integer" },
              {
                id: "internal-address",
                name: "address",
                type: "object",
                fields: [{ id: "internal-city", name: "city", type: "string" }],
              },
            ],
          },
        },
        settings: {
          successStatus: 200,
          delay: { minMs: 0, maxMs: 0 },
          errorInjection: { rate: 0, codes: [500] },
          list: { minSize: 10, maxSize: 10, path: null },
          pagination: null,
          seed: null,
        },
      }),
      meta,
    });

    expect(request.name).toBe("Demo");
    const endpoint = request.endpoints[0];
    expect(endpoint).toBeDefined();
    expect(endpoint).not.toHaveProperty("sample");
    expect(endpoint?.schema).toBeDefined();
    expect(JSON.stringify(request)).not.toContain("internal-");
    expect(endpoint?.settings?.successStatus).toBe(200);
  });

  it("sends a parsed sample and no schema when inference is absent", () => {
    const request = buildCreateProjectRequest({
      name: "",
      endpoint: draft({ sampleText: '{"id":1}', wrapInList: true }),
      meta,
    });

    const endpoint = request.endpoints[0];
    expect(endpoint).not.toHaveProperty("schema");
    expect(endpoint?.sample).toEqual({ id: 1 });
    expect(endpoint?.options?.wrapInList).toBe(true);
    expect(request).not.toHaveProperty("name");
    expect(endpoint?.settings?.successStatus).toBe(200);
  });

  it("rejects a scalar sample before calling the API", () => {
    expect(() =>
      buildCreateProjectRequest({
        name: "",
        endpoint: draft({ sampleText: "42" }),
        meta,
      }),
    ).toThrow(AppError);
  });

  it("rejects an over-long project name", () => {
    const error = (() => {
      try {
        buildCreateProjectRequest({
          name: "x".repeat(61),
          endpoint: draft({ sampleText: "{}" }),
          meta,
        });
      } catch (caught) {
        return caught;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).errors?.name?.[0]).toMatch(/60/);
  });

  it("rejects an invalid path", () => {
    const error = (() => {
      try {
        buildCreateProjectRequest({
          name: "",
          endpoint: draft({ path: "users?page=1", sampleText: "{}" }),
          meta,
        });
      } catch (caught) {
        return caught;
      }
      return null;
    })();

    expect((error as AppError).errors?.["endpoints[0].path"]).toBeDefined();
  });

  it("strips internal ids recursively", () => {
    const stripped = stripSchemaIds({
      version: 1,
      root: {
        id: "root",
        name: "root",
        type: "array",
        items: { id: "item", name: "item", type: "string" },
      },
    });

    expect(stripped.root.id).toBeUndefined();
    expect(stripped.root.items?.id).toBeUndefined();
  });
});

describe("createProject", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the payload once and normalizes a 201", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(makeCreateProjectResponse()), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const request = buildCreateProjectRequest({
      name: "Demo",
      endpoint: draft({ sampleText: '{"id":1}' }),
      meta,
    });
    const result = await createProject(request);

    expect(result.slug).toBe("k3j9x2m8qa");
    expect(result.endpoints[0]?.url).toContain("/users");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://localhost:5080/api/v1/projects");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({ name: "Demo" });
  });

  it("propagates duplicate_endpoint without retrying", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "about:blank",
          title: "Duplicate endpoint",
          status: 409,
          code: "duplicate_endpoint",
          errors: { "endpoints[0].path": ["Already exists."] },
        }),
        { status: 409, headers: { "Content-Type": "application/problem+json" } },
      ),
    );

    const error = (await createProject({ endpoints: [] }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error.code).toBe("duplicate_endpoint");
    expect(error.errors?.["endpoints[0].path"]).toEqual(["Already exists."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes Retry-After on 429", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "rate_limited", title: "Slow down" }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    const error = (await createProject({ endpoints: [] }).catch(
      (caught: unknown) => caught,
    )) as AppError;

    expect(error.code).toBe("rate_limited");
    expect(error.retryAfter).toBe(30);
  });
});

describe("normalizeCreateProjectResponse", () => {
  it("derives endpoint URLs when the server omits them", () => {
    const response = normalizeCreateProjectResponse({
      ...makeCreateProjectResponse(),
      endpoints: [{ id: "ep_1", method: "GET", path: "/users" }],
    });

    expect(response.endpoints[0]?.url).toBe(
      "https://api.example.com/m/k3j9x2m8qa/users",
    );
  });

  it("rejects a response without a token", () => {
    const raw = { ...makeCreateProjectResponse(), editToken: "" };
    expect(() => normalizeCreateProjectResponse(raw)).toThrow(/token/i);
  });
});
