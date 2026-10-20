import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const realApi = process.env.E2E_MODE === "real";

/**
 * The default E2E run boots the app with `NEXT_PUBLIC_ENABLE_MOCKS=true`, so
 * the whole create → try it → logs flow runs without a backend.
 *
 * `pnpm test:e2e:real` uses the normal dev server instead and expects a real
 * API at `NEXT_PUBLIC_API_BASE_URL` (or whatever `.env.local` provides).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: realApi
          ? "corepack pnpm dev -p 3100"
          : "corepack pnpm dev:e2e",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_API_BASE_URL:
            process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5080",
          NEXT_PUBLIC_APP_URL: baseURL,
          NEXT_PUBLIC_ENABLE_MOCKS: realApi ? "false" : "true",
        },
      },
});
