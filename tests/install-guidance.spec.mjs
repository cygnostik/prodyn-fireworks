import { test, expect } from "@playwright/test";

test("requested iPhone install guidance survives subsequent offline-status updates", async ({
  browser,
  baseURL,
}) => {
  // Chromium with an iPhone identity checks UI routing, not native iOS installation.
  const context = await browser.newContext({
    baseURL,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  try {
    await context.addInitScript(() =>
      window.addEventListener(
        "beforeinstallprompt",
        (event) => event.stopImmediatePropagation(),
        true,
      ),
    );
    const page = await context.newPage();
    await page.goto("./?test=1");
    await page.waitForFunction(
      () => window.__afterlight?.stats().pwa.offlineReady,
    );
    await page.locator("#settings-open").click();
    await page.locator("#install-app").click();
    await context.setOffline(true);
    await page.waitForFunction(
      () => window.__afterlight.stats().pwa.online === false,
    );
    await expect(page.locator("#pwa-status")).toContainText(
      /Safari.*Share.*Add to Home Screen/,
    );
    expect(
      await page.evaluate(() => window.__afterlight.stats().pwa.installed),
    ).toBe(false);
  } finally {
    await context.close();
  }
});
