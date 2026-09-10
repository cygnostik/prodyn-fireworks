import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { MeteorField } from "../src/engine/meteors.js";

const dir = "evidence/meteor-revision";
const fixture = "/evidence/meteor-revision/fixture.html";
const model = new MeteorField();
const catalogue = [];
for (let i = 0; i < 300; i++) {
  model.update(model.nextAt + 0.12);
  catalogue.push(model.getStats().recent.at(-1));
}
const examples = {
  visible: catalogue.find(
    (e) => e.peakIntensity > 0.08 && Math.abs(e.startDirection[0]) < 0.4,
  ),
  faint: catalogue.find(
    (e) =>
      e.peakIntensity > 0.009 &&
      e.peakIntensity < 0.013 &&
      e.visibility.separation > 20,
  ),
  "near-moon": catalogue[0],
  warm: catalogue.find(
    (e) => e.colourName === "warm" && e.peakIntensity > 0.035,
  ),
  "blue-green": catalogue.find(
    (e) => e.colourName === "blue-green" && e.peakIntensity > 0.035,
  ),
};
async function openFixture(page) {
  await page.goto(fixture);
  await page.waitForFunction(() => window.meteorTest);
}
async function seek(page, time) {
  return page.evaluate((target) => {
    const t = window.meteorTest;
    if (target < t.engine.simulation.time) t.engine.reset();
    while (target - t.engine.simulation.time > 600)
      t.frame(t.engine.simulation.time + 600);
    return t.frame(target);
  }, time);
}
function monitor(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  return errors;
}

test.beforeAll(async () => {
  await mkdir(dir, { recursive: true });
  await writeFile(
    `${dir}/natural-catalogue.json`,
    JSON.stringify(
      {
        note: "Natural generator; time seeks only in TEST host. NOT an accelerated production schedule.",
        examples,
        firstHour: catalogue.filter((e) => e.birth <= 3600),
        catalogue,
      },
      null,
      2,
    ),
  );
});

for (const [name, example] of Object.entries(examples)) {
  test(`production WebGL pixels: ${name} natural meteor`, async ({ page }) => {
    test.skip(
      !test.info().config.metadata.meteorFixture,
      "Isolated fixture: use evidence/meteor-revision/playwright.config.mjs; never ship it in public/",
    );
    expect(example, name).toBeTruthy();
    const errors = monitor(page);
    await openFixture(page);
    await seek(page, example.birth + example.duration * 0.4);
    const result = await page.evaluate(() => window.meteorTest.compare());
    await writeFile(`${dir}/${name}.json`, JSON.stringify(result, null, 2));
    await page.locator("canvas").screenshot({ path: `${dir}/${name}.png` });
    await page.evaluate(() => window.meteorTest.baseline());
    await page
      .locator("canvas")
      .screenshot({ path: `${dir}/${name}-baseline.png` });
    expect(result.onStats.meteors.active[0].id).toBe(example.id);
    expect(result.onStats.meteors.active[0].age).toBeCloseTo(
      example.duration * 0.4,
      6,
    );
    expect(result.onStats.backend).toBe("webgl2");
    expect(result.onStats.meteors.rendered).toBe(1);
    expect(result.onStats.drawCalls - result.offStats.drawCalls).toBe(2);
    expect(result.onStats.triangles - result.offStats.triangles).toBe(4);
    expect(result.changed).toBeGreaterThan(0);
    expect(result.changed).toBeLessThan(400);
    expect(result.headPixel[0]).toBeGreaterThan(0);
    expect(result.headPixel[0]).toBeLessThan(1440);
    expect(result.headPixel[1]).toBeGreaterThan(0);
    expect(result.headPixel[1]).toBeLessThan(405);
    if (name === "visible") expect(result.max).toBeGreaterThan(20);
    if (name === "warm")
      expect(result.strongest.delta[0]).toBeGreaterThan(
        result.strongest.delta[2],
      );
    if (name === "blue-green")
      expect(result.strongest.delta[1]).toBeGreaterThan(
        result.strongest.delta[0],
      );
    if (name === "faint" || name === "near-moon")
      expect(result.max).toBeLessThan(30);
    expect(await page.evaluate(() => window.meteorTest.events.length)).toBe(0);
    expect(await page.evaluate(() => window.meteorTest.errors)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("active/idle draw cost and repeated natural events have stable GPU resources", async ({
  page,
}) => {
  test.skip(
    !test.info().config.metadata.meteorFixture,
    "Requires the isolated production fixture, not the application's public build",
  );
  const errors = monitor(page);
  await openFixture(page);
  await seek(page, examples.visible.birth + examples.visible.duration * 0.4);
  const result = await page.evaluate(() => {
    const t = window.meteorTest,
      e = t.engine;
    const mesh = e.scene.getObjectByName(
      "Silent background meteors / bounded ribbon batch",
    );
    const gl = e.renderer.getContext();
    const sample = (active) => {
      const start = performance.now();
      for (let i = 0; i < 25; i++) {
        mesh.visible = active;
        e.renderer.info.reset();
        e.composer.render(0);
        gl.finish();
      }
      return (performance.now() - start) / 25;
    };
    const timings = [];
    for (let i = 0; i < 4; i++)
      timings.push(
        i % 2
          ? { active: sample(true), idle: sample(false) }
          : { idle: sample(false), active: sample(true) },
      );
    const warm = e.getStats();
    for (let i = 0; i < 120; i++) {
      const s = e.getStats().meteors;
      t.frame(e.simulation.time + s.nextAt - s.time + 0.1);
    }
    const after = e.getStats();
    e.setOptions({ reflections: false });
    e.render();
    const activeNoReflection = e.getStats().drawCalls;
    mesh.visible = false;
    e.renderer.info.reset();
    e.composer.render(0);
    const idleNoReflection = e.getStats().drawCalls;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      timings,
      warm,
      after,
      activeNoReflection,
      idleNoReflection,
      renderer: info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      userAgent: navigator.userAgent,
      viewport: [e.width, e.height, e.dpr],
      method:
        "25 full compositor renders/sample with gl.finish; CPU+GPU wall time, not isolated GPU timing",
    };
  });
  await writeFile(`${dir}/performance.json`, JSON.stringify(result, null, 2));
  expect(result.after.geometries).toBe(result.warm.geometries);
  expect(result.after.textures).toBe(result.warm.textures);
  expect(result.after.meteors.recent.length).toBe(16);
  expect(result.activeNoReflection - result.idleNoReflection).toBe(1);
  expect(errors).toEqual([]);
});

test("app natural clock: pause, reset, hidden and live reduced motion stay silent", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("/?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    const a = window.__afterlight;
    a.setTestClock(true);
    a.clear();
    let target = a.stats().engine.meteors.nextAt + 0.13;
    while (target > 120) {
      a.step(120);
      target -= 120;
    }
    a.step(target);
  });
  const original = await page.evaluate(
    () => window.__afterlight.stats().engine.meteors,
  );
  expect(original.generated).toBe(1);
  expect(original.active.length).toBe(1);
  await page.evaluate(() => {
    const a = window.__afterlight;
    a.pause(true);
    a.step(15);
  });
  expect(
    await page.evaluate(() => window.__afterlight.stats().engine.meteors),
  ).toEqual(original);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(() => window.__afterlight.stats().engine.meteors.rendered),
    )
    .toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => window.__afterlight.step(0));
  expect(
    (await page.evaluate(() => window.__afterlight.stats().engine.meteors))
      .active.length,
  ).toBe(0);
  await page.evaluate(() => {
    const a = window.__afterlight;
    a.pause(false);
    a.setTestClock(false);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await page.evaluate(
    () => window.__afterlight.stats().engine.meteors,
  );
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => window.__afterlight.stats().engine.meteors),
  ).toEqual(hidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
    const a = window.__afterlight;
    a.setTestClock(true);
    a.clear();
    a.step(0);
  });
  const reset = await page.evaluate(() => window.__afterlight.stats());
  expect(reset.engine.meteors.generated).toBe(0);
  expect(reset.engine.meteors.rendered).toBe(0);
  expect(reset.engine.meteors.nextAt).toBe(catalogue[0].birth);
  expect(reset.engine.activeParticles).toBe(0);
  await page.screenshot({ path: `${dir}/app-preserved.png` });
  await writeFile(
    `${dir}/app-lifecycle.json`,
    JSON.stringify(
      {
        original,
        hidden,
        reset,
        hiddenMethod:
          "synthetic document.hidden lifecycle; not physical background throttling",
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});

for (const width of [700, 390]) {
  test(`canonical 16:9 sky and thin meteor survive ${width}px resize`, async ({
    page,
  }) => {
    test.skip(
      !test.info().config.metadata.meteorFixture,
      "Requires the isolated production fixture, not the application's public build",
    );
    await page.setViewportSize({ width, height: 844 });
    await openFixture(page);
    await seek(page, examples.visible.birth + examples.visible.duration * 0.4);
    const result = await page.evaluate(() => window.meteorTest.compare());
    await page.screenshot({ path: `${dir}/fixture-${width}.png` });
    expect(result.changed).toBeGreaterThan(0);
    expect(result.changed).toBeLessThan(160);
    expect(result.onStats.width / result.onStats.height).toBeCloseTo(16 / 9, 1);
    expect(await page.evaluate(() => window.meteorTest.errors)).toEqual([]);
  });
}
