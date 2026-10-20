import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CreateProjectRequest } from "@/lib/api/generated/schema";
import { inferSchema } from "@/lib/api/infer";
import { createProject, getProject } from "@/lib/api/projects";
import {
  getEndpoint,
  updateEndpointSettings,
} from "@/lib/api/endpoints";
import { listLogs } from "@/lib/api/logs";
import { AppError, isAppError } from "@/lib/errors";
import { defaultEndpointSettings } from "@/lib/settings/defaults";
import { makeMeta } from "@/test/fixtures/meta";
import { resetMocks, server } from "./server";

const SAMPLE = [
  { id: 1, name: "Ada", email: "ada@example.com", active: true },
  { id: 2, name: "Grace", email: "grace@example.com", active: true },
];

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  resetMocks();
});

afterAll(() => {
  server.close();
});

describe("MSW contract mocks (FND-10)", () => {
  it("runs create → read → save → try it → logs without a backend", async () => {
    const meta = makeMeta();
    const inferred = await inferSchema({ sample: SAMPLE });
    const request: CreateProjectRequest = {
      name: "Mock contract",
      endpoints: [
        {
          method: "GET",
          path: "/users",
          schema: inferred.schema,
          settings: defaultEndpointSettings("GET", meta),
        },
      ],
    };

    const created = await createProject(request);
    expect(created.slug).toMatch(/\S/);
    expect(created.editToken).toMatch(/^et_/);
    expect(created.endpoints[0]?.url).toContain(`/${created.slug}/users`);

    const project = await getProject(created.slug, created.editToken);
    expect(project.name).toBe("Mock contract");
    expect(project.endpoints).toHaveLength(1);

    const endpoint = project.endpoints[0];
    expect(endpoint).toBeDefined();
    if (!endpoint) throw new Error("missing endpoint");

    // Update through the settings-only contract, then read the full endpoint.
    const nextSettings = {
      ...(endpoint.settings ?? defaultEndpointSettings("GET", meta)),
      delay: { minMs: 0, maxMs: 0 },
      errorInjection: { rate: 0, codes: [500] },
    };
    await updateEndpointSettings(
      created.slug,
      endpoint.id,
      created.editToken,
      nextSettings,
      { baseUrl: project.baseUrl },
    );
    const saved = await getEndpoint(created.slug, endpoint.id, created.editToken, {
      baseUrl: project.baseUrl,
    });
    expect(saved.settings?.errorInjection.rate).toBe(0);

    // Call the runtime exactly as a browser would.
    const runtime = await fetch(`${project.baseUrl}/users`);
    expect(runtime.status).toBe(200);
    expect(runtime.headers.get("x-request-id")).toMatch(/\S/);
    const body = (await runtime.json()) as unknown;
    expect(body).toBeTruthy();

    // The call is in the cursor-paginated log table and filterable by endpoint.
    const logs = await listLogs(created.slug, created.editToken, {
      limit: 10,
      endpointId: endpoint.id,
    });
    expect(logs.items).toHaveLength(1);
    expect(logs.items[0]?.status).toBe(200);
    expect(logs.items[0]?.endpointPath).toBe("/users");
    expect(logs.items[0]?.requestBody).toBeNull();

    const noMatches = await listLogs(created.slug, created.editToken, {
      limit: 10,
      status: 500,
    });
    expect(noMatches.items).toHaveLength(0);

    const latest = logs.items[0];
    if (!latest) throw new Error("missing log");
    const afterLatest = await listLogs(created.slug, created.editToken, {
      limit: 10,
      after: latest.id,
    });
    expect(afterLatest.items).toHaveLength(0);
  });

  it("rejects missing and mismatched bearer tokens", async () => {
    const created = await createProject({
      endpoints: [{ method: "GET", path: "/ping", sample: { ok: true } }],
    });

    await expect(getProject(created.slug, "")).rejects.toMatchObject({
      code: "missing_token",
      status: 401,
    });

    try {
      await getProject(created.slug, "et_wrong_token_value");
      throw new Error("expected the mismatched token to fail");
    } catch (caught) {
      expect(isAppError(caught)).toBe(true);
      expect((caught as AppError).code).toBe("invalid_token");
      expect((caught as AppError).status).toBe(403);
    }
  });

  it("supports the seeded demo project and reset path", async () => {
    const demo = await getProject(
      "demo",
      "et_demo_mockapi_hackathon_2026",
    );
    expect(demo.name).toBe("Hackathon demo");
    expect(demo.endpoints[0]?.path).toBe("/users");

    const logs = await listLogs("demo", "et_demo_mockapi_hackathon_2026");
    expect(logs.items.length).toBeGreaterThan(0);
  });
});
