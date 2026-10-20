import { expect, test, type Page } from "@playwright/test";

const SAMPLE = JSON.stringify(
  [
    {
      id: 1,
      name: "Ada Lovelace",
      email: "ada@example.com",
      active: true,
    },
    {
      id: 2,
      name: "Grace Hopper",
      email: "grace@example.com",
      active: true,
    },
  ],
  null,
  2,
);

async function pasteSample(page: Page) {
  const editor = page.getByLabel("JSON sample");
  await editor.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.insertText(SAMPLE);
}

/**
 * QLT-04: the demo path from §1.1. Selectors are role- and label-based so the
 * same flow runs against the MSW mocks in CI and a real backend with
 * `pnpm test:e2e:real`.
 */
test("paste → infer → settings → preview → create → try it → log", async ({
  page,
}) => {
  await page.goto("/new");
  await expect(
    page.getByRole("heading", { name: "Create a mock API" }),
  ).toBeVisible();

  // Step 1 — paste, infer.
  await pasteSample(page);
  await expect(page.getByText("Valid JSON", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Infer schema" }).click();
  await expect(page).toHaveURL(/\/new\?step=2/);
  await expect(page.getByRole("heading", { name: "JSON sample" })).toBeHidden();

  // Step 2 — review the schema and continue.
  await page.getByRole("button", { name: "Continue to settings" }).click();
  await expect(page).toHaveURL(/\/new\?step=3/);

  // Step 3 — set a small deterministic delay and keep errors off.
  const minDelay = page.getByLabel("Minimum (ms)");
  await minDelay.fill("100");
  await page.getByLabel("Maximum (ms)").fill("200");
  const errorRate = page.getByLabel("Error rate (%)");
  await errorRate.fill("0");

  await page.getByRole("button", { name: "Continue to preview" }).click();
  await expect(page).toHaveURL(/\/new\?step=4/);
  await expect(page.getByLabel("Preview response")).toBeVisible();

  // Step 4 — name the project and create it.
  await page.getByLabel("Project name (optional)").fill("E2E demo");
  await page.getByRole("button", { name: "Create project" }).click();

  // The token screen must be shown, with a readable token.
  await expect(page).toHaveURL(/\/new\/success/);
  await expect(
    page.getByRole("heading", { name: "Your mock API is live" }),
  ).toBeVisible();
  const token = page.getByTestId("token-value");
  await expect(token).toBeVisible();
  await expect(token).toHaveText(/^et_/);
  const tokenValue = (await token.textContent())?.trim() ?? "";
  expect(tokenValue).toMatch(/^et_/);

  await page.getByLabel("I saved this token somewhere safe").check();
  await page.getByRole("button", { name: "Open project" }).click();
  await expect(page).toHaveURL(/\/p\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "E2E demo" }),
  ).toBeVisible();

  // Open the endpoint and call the runtime.
  await page.getByRole("link", { name: "Open endpoint" }).click();
  await expect(page).toHaveURL(/\/p\/[^/]+\/endpoints\/[^/]+/);
  await page.getByRole("tab", { name: "Try it" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Real response")).toBeVisible();
  await expect(page.getByText("200", { exact: true }).first()).toBeVisible();

  // The call must appear in the live log table without a reload.
  await page.getByRole("tab", { name: "Logs" }).click();
  await expect(page.getByRole("table", { name: "Request logs" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Request logs" }).getByText("200").first(),
  ).toBeVisible();

  // No token may leak into the URL or localStorage unless the user opted in.
  expect(new URL(page.url()).search).not.toContain("et_");
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage }),
  );
  expect(storage).not.toContain(tokenValue);
});
