import type { CreateProjectResponse } from "@/lib/api/generated/schema";

export interface CredentialsDownload {
  slug: string;
  name: string | null;
  baseUrl: string;
  editToken: string;
  expiresAt: string;
  endpoints: Array<{ method: string; path: string; url: string }>;
}

export function toCredentials(result: CreateProjectResponse): CredentialsDownload {
  return {
    slug: result.slug,
    name: result.name ?? null,
    baseUrl: result.baseUrl,
    editToken: result.editToken,
    expiresAt: result.expiresAt,
    endpoints: result.endpoints.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      url: endpoint.url,
    })),
  };
}

export function buildCredentialsText(result: CreateProjectResponse): string {
  const credentials = toCredentials(result);
  const lines = [
    "MockAPI project credentials",
    "==========================",
    "",
    `Project:    ${credentials.name ?? "(unnamed)"}`,
    `Slug:       ${credentials.slug}`,
    `Base URL:   ${credentials.baseUrl}`,
    `Expires at: ${credentials.expiresAt}`,
    "",
    `Edit token: ${credentials.editToken}`,
    "",
    "Keep the edit token private. It cannot be recovered if you lose it.",
    "Send it as: Authorization: Bearer <editToken>",
    "",
    "Endpoints:",
    ...credentials.endpoints.map(
      (endpoint) => `  ${endpoint.method.padEnd(6)} ${endpoint.url}`,
    ),
    "",
  ];
  return lines.join("\n");
}

export function buildCredentialsJson(result: CreateProjectResponse): string {
  return JSON.stringify(toCredentials(result), null, 2);
}

export function credentialsFileBase(result: CreateProjectResponse): string {
  const safeSlug = result.slug.replace(/[^A-Za-z0-9._-]+/g, "-");
  return `mockapi-${safeSlug}-credentials`;
}
