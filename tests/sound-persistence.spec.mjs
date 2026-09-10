import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    window.setTestVisibility = (value) => {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
}

test("previously enabled sound resumes after a hidden-visible lifecycle cycle", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => window.setTestVisibility(true));
  await expect
    .poll(() =>
      page.evaluate(() => window.__afterlight.stats().audio.contextState),
    )
    .toBe("suspended");
  expect(
    await page.evaluate(() => window.__afterlight.stats().audio.activeVoices),
  ).toBe(0);
  await page.evaluate(() => window.setTestVisibility(false));
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 4000 },
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__afterlight.stats().audio.contextState),
    )
    .toBe("running");
});

test("an explicit mute remains muted after returning and after reload", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#sound-toggle").click();
  await page.evaluate(() => {
    window.setTestVisibility(true);
    window.setTestVisibility(false);
  });
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    await page.evaluate(() => window.__afterlight.stats().audio.activeVoices),
  ).toBe(0);
  await ready(page);
  await page.locator('[data-fire="chrysanthemum"]').click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    await page.evaluate(() => window.__afterlight.stats().audio.contextState),
  ).toBe("uninitialized");
});

test("remembered sound waits for a fresh page gesture, then restores without a second Sound click", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await ready(page);
  expect(
    await page.evaluate(() => window.__afterlight.stats().audio.contextState),
  ).toBe("uninitialized");
  await page.locator('[data-fire="chrysanthemum"]').click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 4000 },
  );
});

test("cache-style suspension restores consented sound but never turns it on for a muted page", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__afterlight.stats().audio.contextState),
    )
    .toBe("suspended");
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#sound-toggle").click();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
