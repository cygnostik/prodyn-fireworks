import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`intro copy fades automatically while paused at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("./?test=1");
    await page.waitForFunction(() => window.__afterlight?.ready);
    await expect(page.locator("#sky-title")).toBeVisible();
    await page.locator("#pause-toggle").click();
    await page.waitForFunction(
      () => {
        const opacity = Number(
          getComputedStyle(document.getElementById("sky-title")).opacity,
        );
        return opacity > 0 && opacity < 1;
      },
      {},
      { timeout: 6500, polling: "raf" },
    );
    await expect(page.locator("#sky-title")).toHaveCSS("visibility", "hidden");
    await expect(page.locator("#sky-title")).toHaveCSS("opacity", "0");
    await expect(page.locator("#watch-show")).toBeHidden();
    await expect(page.locator(".portrait-note")).toHaveCount(0);
    if (viewport.width < 640) {
      const gap = await page.evaluate(
        () =>
          document.querySelector(".deck").getBoundingClientRect().top -
          document.querySelector(".film").getBoundingClientRect().bottom,
      );
      expect(Math.abs(gap)).toBeLessThan(1);
    }
    await expect(page.locator('[data-fire="chrysanthemum"]')).toBeVisible();
    await expect(page.locator("#finale-open")).toBeVisible();
    expect(await page.evaluate(() => window.__afterlight.state.paused)).toBe(
      true,
    );
  });
}
test("intro also disappears in reduced-motion mode without needing a firework", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await expect(page.locator("#sky-title")).toHaveCSS("visibility", "hidden", {
    timeout: 6500,
  });
  expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(0);
  await expect(page.locator('[data-fire="chrysanthemum"]')).toBeVisible();
});
