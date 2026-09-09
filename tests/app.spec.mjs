import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { EFFECTS } from "../src/data/catalog.js";

async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
  });
}

test("real 3D sky, grouped firing, aim, pause and finite finale", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await ready(page);
  await expect(page.locator("[data-bank]")).toHaveCount(6);
  await expect(page.locator("[data-fire]")).toHaveCount(7);
  const rect = await page.locator("#sky").boundingBox();
  expect(rect.width / rect.height).toBeCloseTo(16 / 9, 3);
  await page.getByRole("button", { name: "Fire Peony", exact: true }).click();
  await page.evaluate(() => window.__afterlight.step(5));
  expect(
    (await page.evaluate(() => window.__afterlight.stats())).engine
      .activeParticles,
  ).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Add Peony to finale", exact: true })
    .click();
  await page.locator('[data-bank="canopies"]').click();
  await page
    .getByRole("button", { name: "Add Willow to finale", exact: true })
    .click();
  await page.locator("#finale-open").click();
  await expect(page.locator("[data-layer]")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Move Willow earlier", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => window.__afterlight.state.show.layers[0].effectId,
    ),
  ).toBe("willow");
  await page.locator("#duration").fill("12");
  await page.locator("#finale-fire").click();
  expect(
    await page.evaluate(() => window.__afterlight.state.player.running),
  ).toBe(true);
  await page.evaluate(() => window.__afterlight.step(3));
  await page.locator("#pause-toggle").click();
  const before = await page.evaluate(
    () => window.__afterlight.stats().engine.time,
  );
  await page.evaluate(() => window.__afterlight.step(2));
  expect(
    await page.evaluate(() => window.__afterlight.stats().engine.time),
  ).toBe(before);
  await page.locator("#pause-toggle").click();
  await page.evaluate(() => window.__afterlight.step(30));
  expect(
    await page.evaluate(() => window.__afterlight.state.player.running),
  ).toBe(false);
  await page.locator("#clear-sky").click();
  expect(
    (await page.evaluate(() => window.__afterlight.stats())).engine
      .activeParticles,
  ).toBe(0);
  expect(errors).toEqual([]);
});

test("all 40 catalogue entries launch in the actual renderer", async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  const results = [];
  for (const effect of EFFECTS) {
    const result = await page.evaluate((id) => {
      const a = window.__afterlight;
      a.clear();
      const before = a.state.launches;
      const ok = a.fire({
        effectId: id,
        palette: "gold",
        position: 0,
        seed: 131,
      });
      a.step(4);
      return {
        id,
        ok,
        launches: a.state.launches - before,
        ...a.stats().engine,
      };
    }, effect.id);
    expect(result.ok, effect.id).toBe(true);
    expect(result.launches).toBe(1);
    expect(result.backend).toBe("webgl2");
    results.push(result);
  }
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/catalog-render.json",
    JSON.stringify(results, null, 2),
  );
  expect(results.length).toBe(EFFECTS.length);
});

test("show persistence, imported shape validation and keyboard alternatives", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sky").focus();
  await page.keyboard.press("Shift+Digit1");
  expect(
    (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(1);
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(
    (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(1);
  await page.locator("#finale-open").click();
  await page.locator("#show-title").fill("Our summer night");
  await page.locator("#show-title").press("Tab");
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.show.title)).toBe(
    "Our summer night",
  );
  await page.locator("#settings-open").click();
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"version":1,"title":"bad","duration":20,"layers":[{"effectId":"__proto__"}]}',
    ),
  });
  expect(
    (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(1);
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 700, height: 430 },
  { width: 390, height: 844 },
]) {
  test(`bottom deck and playable film at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await page
      .getByRole("button", { name: "Fire Chrysanthemum", exact: true })
      .click();
    await page.evaluate(() => window.__afterlight.step(4.1));
    const measures = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      film: document.getElementById("film").getBoundingClientRect().toJSON(),
      deck: document.querySelector(".deck").getBoundingClientRect().toJSON(),
      height: innerHeight,
    }));
    expect(measures.scroll).toBeLessThanOrEqual(measures.width);
    expect(measures.deck.bottom).toBeLessThanOrEqual(measures.height + 1);
    expect(measures.film.width / measures.film.height).toBeCloseTo(16 / 9, 3);
    expect(measures.film.bottom).toBeLessThanOrEqual(measures.deck.top + 1);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await mkdir("evidence/screenshots", { recursive: true });
    await page.screenshot({
      path: `evidence/screenshots/app-${viewport.width}.png`,
    });
    await writeFile(
      `evidence/axe-${viewport.width}.json`,
      JSON.stringify(scan.violations, null, 2),
    );
    expect(scan.violations).toEqual([]);
  });
}

test("sound is opt-in and can actually be started and muted", async ({
  page,
}) => {
  await ready(page);
  expect(await page.locator("#sound-toggle").getAttribute("aria-pressed")).toBe(
    "false",
  );
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Fire Peony", exact: true }).click();
  await page.evaluate(() => window.__afterlight.step(4));
  const audio = await page.evaluate(() => window.__afterlight.stats().audio);
  await writeFile("evidence/audio-app.json", JSON.stringify(audio, null, 2));
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("gentle motion starts still and a renderer failure retains the saved finale", async ({
  browser,
}) => {
  const gentle = await browser.newContext({ reducedMotion: "reduce" });
  const page = await gentle.newPage();
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(0);
  expect(await page.evaluate(() => window.__afterlight.state.gentle)).toBe(
    true,
  );
  await gentle.close();
  const failed = await browser.newContext();
  const bad = await failed.newPage();
  await bad.addInitScript(() => {
    const old = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return String(type).includes("webgl")
        ? null
        : old.call(this, type, ...args);
    };
  });
  await bad.goto("./");
  await expect(bad.locator("#canvas-error")).toBeVisible();
  await expect(
    bad.getByRole("button", { name: "Fire Peony", exact: true }),
  ).toBeDisabled();
  await bad.locator('[data-bank="canopies"]').click();
  await expect(
    bad.getByRole("button", { name: "Fire Willow", exact: true }),
  ).toBeDisabled();
  await expect(
    bad.getByRole("button", { name: "Add Willow to finale", exact: true }),
  ).toBeEnabled();
  await bad
    .getByRole("button", { name: "Add Willow to finale", exact: true })
    .click();
  expect(
    (await bad.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(1);
  await failed.close();
});

test("touch input and a full 12-layer finale stay bounded on a phone viewport", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await ready(page);
    await page.locator('[data-fire="peony"]').tap();
    expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(
      1,
    );
    const rect = await page.locator("#sky").boundingBox();
    await page.touchscreen.tap(
      rect.x + rect.width * 0.7,
      rect.y + rect.height * 0.35,
    );
    expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(
      2,
    );
    const types = [
      "willow",
      "brocade",
      "pistil",
      "crossette",
      "crackle",
      "fan",
      "chrysanthemum",
      "strobe",
      "palm",
      "nishiki",
      "mine",
      "shell-of-shells",
    ];
    const incoming = {
      version: 1,
      title: "Full layered finale",
      duration: 12,
      layers: types.map((effectId, i) => ({
        id: `stress-${i}`,
        effectId,
        palette: "signature",
        density: 3,
      })),
    };
    await page.locator("#settings-open").tap();
    await page.locator("#import-file").setInputFiles({
      name: "full-finale.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await expect(page.locator("[data-layer]")).toHaveCount(12);
    await page.locator("#finale-close").tap();
    await page.locator('[data-add="peony"]').tap();
    expect(
      (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
    ).toBe(12);
    await page.locator("#finale-open").tap();
    await page.locator("#finale-fire").tap();
    const samples = [];
    for (let i = 0; i < 5; i++) {
      samples.push(
        await page.evaluate(() => {
          window.__afterlight.step(3);
          return window.__afterlight.stats().engine;
        }),
      );
    }
    expect(
      await page.evaluate(() => window.__afterlight.state.player.running),
    ).toBe(false);
    expect(
      samples.every(
        (s) =>
          s.activeParticles <= 62000 &&
          Number.isFinite(s.time) &&
          s.drawCalls > 0,
      ),
    ).toBe(true);
    expect(samples.some((s) => s.activeParticles > 1000)).toBe(true);
    await mkdir("evidence/screenshots", { recursive: true });
    await page.screenshot({ path: "evidence/screenshots/phone-finale.png" });
    await writeFile(
      "evidence/phone-finale.json",
      JSON.stringify(samples, null, 2),
    );
    await page.evaluate(() => window.__afterlight.step(60));
    expect(
      (await page.evaluate(() => window.__afterlight.stats())).engine
        .activeParticles,
    ).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("cinema opens the full sky and restores the bottom controls", async ({
  page,
}) => {
  await ready(page);
  const before = await page.locator("#film").boundingBox();
  await page.locator("#fullscreen-toggle").click();
  await expect(page.locator(".deck")).toBeHidden();
  await expect(page.locator("#cinema-exit")).toBeVisible();
  const after = await page.locator("#film").boundingBox();
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.width / after.height).toBeCloseTo(16 / 9, 3);
  await page
    .locator("#sky")
    .click({ position: { x: after.width * 0.55, y: after.height * 0.3 } });
  expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(1);
  await page.locator("#cinema-exit").click();
  await expect(page.locator(".deck")).toBeVisible();
});

test("production assets are precached and a cold page works offline", async ({
  context,
  page,
}) => {
  await ready(page);
  await page.waitForFunction(
    () => window.__afterlight.stats().pwa.offlineReady,
    { timeout: 30000 },
  );
  await context.setOffline(true);
  const cold = await context.newPage();
  await cold.goto("./?test=1");
  await cold.waitForFunction(() => window.__afterlight?.ready);
  await cold.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
    window.__afterlight.fire({ effectId: "palm", palette: "gold" });
    window.__afterlight.step(4);
  });
  expect(
    (await cold.evaluate(() => window.__afterlight.stats())).engine
      .activeParticles,
  ).toBeGreaterThan(0);
  await context.setOffline(false);
});
