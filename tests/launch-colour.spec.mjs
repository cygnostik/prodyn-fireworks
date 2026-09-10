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

test("ordinary automatic placements spread across the visible sky in every view", async ({
  page,
}) => {
  await ready(page);
  for (const view of ["audience", "close", "wide"]) {
    await page.locator("#settings-open").click();
    await page.locator("#view").selectOption(view);
    await page.locator("#settings [data-close-dialog]").click();
    const placements = await page.evaluate(() => {
      const a = window.__afterlight;
      return Array.from({ length: 32 }, () => {
        a.clear();
        a.fire({ effectId: "peony", seed: 17 });
        return a.stats().engine.lastLaunch;
      });
    });
    const xs = placements.map((p) => p.ndc[0]);
    expect((Math.max(...xs) - Math.min(...xs)) / 2, view).toBeGreaterThan(0.7);
    expect(Math.max(...xs), view).toBeLessThanOrEqual(0.801);
    expect(Math.min(...xs), view).toBeGreaterThanOrEqual(-0.801);
    expect(
      placements.every((p) => p.position >= -0.92 && p.position <= 0.92),
    ).toBe(true);
  }
});

test("Wide view gives actual sky taps more lateral room while preserving 16:9", async ({
  page,
}) => {
  await ready(page);
  const expectVisibleField = async () => {
    const edges = await page.evaluate(() => {
      const a = window.__afterlight;
      return [-1, 1].map((position) => {
        a.clear();
        a.fire({ effectId: "peony", seed: 17, position });
        return a.stats().engine.lastLaunch.ndc[0];
      });
    });
    expect((edges[1] - edges[0]) / 2).toBeGreaterThanOrEqual(0.72);
    expect(edges[0]).toBeGreaterThanOrEqual(-0.801);
    expect(edges[1]).toBeLessThanOrEqual(0.801);
    await page.evaluate(() => window.__afterlight.clear());
  };
  await expectVisibleField();
  await page.locator("#settings-open").click();
  await page.locator("#view").selectOption("wide");
  await page.locator("#settings [data-close-dialog]").click();
  await expectVisibleField();
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
  expect(shot.ndc[0]).toBeGreaterThan(0.6);
  expect(shot.ndc[0]).toBeLessThan(0.7);
  expect(shot.z).toBe(-125);
});
