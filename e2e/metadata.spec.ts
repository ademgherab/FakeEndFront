import { expect, test } from "@playwright/test";

/**
 * QLT-08: rendered HTML must carry shareable metadata for public routes, and
 * authenticated routes must opt out of indexing.
 */
test.describe("metadata and crawlability", () => {
  test("landing page has description, canonical, OG and Twitter tags", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /mock endpoint|mock api/i,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /MockAPI/i,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      /summary/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/$/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /index/,
    );
  });

  test("help page is canonical and shareable", async ({ page }) => {
    await page.goto("/help");
    await expect(page).toHaveTitle(/Quickstart · MockAPI/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/help$/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      /\/help$/,
    );
  });

  test("project, builder and recent routes are noindex", async ({ page }) => {
    for (const route of ["/p/example", "/new", "/projects", "/expired"]) {
      await page.goto(route);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });

  test("robots.txt and sitemap.xml expose public routes only", async ({
    request,
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /p/");
    expect(robotsText).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain("/help");
    expect(sitemapText).not.toContain("/p/");
    expect(sitemapText).not.toContain("/new");
  });

  test("OG image is served as a PNG", async ({ request }) => {
    const image = await request.get("/opengraph-image");
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
  });
});
