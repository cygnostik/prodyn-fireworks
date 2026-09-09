import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
  });
}

test("Guatemala selection reaches launches and saved layers; Signature varies and advances toward the viewer", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-palette="guatemala"]').click();
  await page.locator('[data-fire="peony"]').click();
  expect(
    await page.evaluate(
      () => window.__afterlight.stats().engine.lastLaunch.palette,
    ),
  ).toBe("guatemala");
  await page.locator('[data-add="peony"]').click();
  expect(
    await page.evaluate(() => window.__afterlight.state.show.layers[0].palette),
  ).toBe("guatemala");
  await page.locator('[data-palette="signature"]').click();
  const launches = [];
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-fire="peony"]').click();
    launches.push(
      await page.evaluate(() => window.__afterlight.stats().engine.lastLaunch),
    );
  }
  expect(launches.every((s) => s.palette === "signature")).toBe(true);
  expect(
    new Set(launches.map((s) => JSON.stringify(s.colors))).size,
  ).toBeGreaterThan(2);
  expect(launches.every((s, i) => i === 0 || s.z > launches[i - 1].z)).toBe(
    true,
  );
  const fixed = await page.evaluate(() => {
    const a = window.__afterlight;
    a.fire({ effectId: "peony", palette: "signature", variation: 4, seed: 17 });
    const first = a.stats().engine.lastLaunch.colors;
    a.fire({ effectId: "peony", palette: "signature", variation: 4, seed: 17 });
    return [first, a.stats().engine.lastLaunch.colors];
  });
  expect(fixed[0]).toEqual(fixed[1]);
});

test("Wide view gives actual sky taps more lateral room while preserving 16:9", async ({
  page,
}) => {
  await ready(page);
  expect(
    await page.evaluate(
      () => window.__afterlight.stats().engine.launchHalfWidth,
    ),
  ).toBe(220);
  await page.locator("#settings-open").click();
  await page.locator("#view").selectOption("wide");
  await page.locator("#settings [data-close-dialog]").click();
  expect(
    await page.evaluate(
      () => window.__afterlight.stats().engine.launchHalfWidth,
    ),
  ).toBe(310);
  const sky = page.locator("#sky");
  await sky.scrollIntoViewIfNeeded();
  const rectangle = await sky.boundingBox();
  expect(Math.abs(rectangle.width / rectangle.height - 16 / 9)).toBeLessThan(
    0.02,
  );
  await sky.click({
    position: { x: rectangle.width * 0.9, y: rectangle.height * 0.35 },
  });
  const shot = await page.evaluate(
    () => window.__afterlight.stats().engine.lastLaunch,
  );
  expect(shot.x).toBeGreaterThan(200);
  expect(shot.z).toBe(-125);
});
