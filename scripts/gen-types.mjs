import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = path.join(root, "src", "lib", "api", "generated", "schema.d.ts");
const check = process.argv.includes("--check");

function fail(message) {
  console.error(`\n[gen:types] ${message}\n`);
  process.exit(1);
}

async function envFromFile(file) {
  try {
    const raw = await readFile(file, "utf8");
    const entries = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      entries[key] = value;
    }
    return entries;
  } catch {
    return {};
  }
}

const fileEnv = await envFromFile(path.join(root, ".env.local"));
const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? fileEnv.NEXT_PUBLIC_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

if (!baseUrl) {
  fail(
    "NEXT_PUBLIC_API_BASE_URL is missing. Set it in .env.local or the environment " +
      "(for example http://localhost:5080) and run `pnpm gen:types` again.",
  );
}

const documentUrl = `${baseUrl}/openapi/v1.json`;
console.log(`[gen:types] Fetching ${documentUrl}`);

let response;
try {
  response = await fetch(documentUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
} catch (error) {
  fail(
    `Could not reach ${documentUrl}: ${error instanceof Error ? error.message : String(error)}. ` +
      `Check NEXT_PUBLIC_API_BASE_URL (${baseUrl}) and that the backend is running and publishes /openapi/v1.json.`,
  );
}

if (!response.ok) {
  fail(
    `${documentUrl} responded ${response.status}. The backend must publish an OpenAPI 3 document at /openapi/v1.json.`,
  );
}

let document;
try {
  document = await response.json();
} catch {
  fail(`${documentUrl} did not return valid JSON.`);
}

let contents;
try {
  contents = astToString(await openapiTS(document));
} catch (error) {
  fail(
    `Could not generate types from ${documentUrl}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Source: ${documentUrl}
 * Regenerate: pnpm gen:types
 */

`;

const next = `${banner}${contents}`;

if (check) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    fail("src/lib/api/generated/schema.d.ts is missing. Run `pnpm gen:types`.");
  }
  if (current !== next) {
    fail(
      "src/lib/api/generated/schema.d.ts is stale. Run `pnpm gen:types` and commit the result.",
    );
  }
  console.log("[gen:types] Generated types are up to date.");
} else {
  await writeFile(outputPath, next, "utf8");
  console.log(
    `[gen:types] Wrote ${path.relative(root, outputPath)} (${contents.length} characters).`,
  );
}
