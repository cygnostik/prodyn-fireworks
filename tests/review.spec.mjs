import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { encodeShow, STORAGE_KEY } from "../src/show.js";
import { mkdir } from "node:fs/promises";
const incoming = {
  version: 1,
  title: "Imported Peony",
  duration: 12,
  layers: [
    { id: "imported-one", effectId: "peony", palette: "ruby", density: 1 },
  ],
};
const file = {
  name: "show.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(incoming)),
};
async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
  });
}
async function importFile(page) {
  await page.locator("#settings-open").click();
  await page.locator("#import-file").setInputFiles(file);
}

test("an empty shared finale cannot silently replace the saved original", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-add="peony"]').click();
  const original = await page.evaluate(
    (k) => localStorage.getItem(k),
    STORAGE_KEY,
  );
  await page.goto(
    `./?test=1#show=${encodeShow({ version: 1, title: "Empty shared", duration: 12, layers: [] })}`,
  );
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.show.title)).toBe(
    "Empty shared",
  );
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await importFile(page);
  await expect.poll(() => dialogs.length, { timeout: 3000 }).toBe(1);
  expect(dialogs[0]).toContain("saved");
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(
    original,
  );
  expect(await page.evaluate(() => window.__afterlight.state.show.title)).toBe(
    "Empty shared",
  );
});

test("an accepted import replaces the shared URL and survives a reload", async ({
  page,
}) => {
  await ready(page);
  const shared = {
    ...incoming,
    title: "Previous shared",
    layers: [{ ...incoming.layers[0], effectId: "willow" }],
  };
  await page.goto(`./?test=1#show=${encodeShow(shared)}`);
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.show.title)).toBe(
    shared.title,
  );
  page.on("dialog", (d) => d.accept());
  await importFile(page);
  await expect
    .poll(() => page.evaluate(() => window.__afterlight.state.show.title))
    .toBe(incoming.title);
  expect(new URL(page.url()).hash).toBe("");
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.show)).toEqual(
    incoming,
  );
});

test("removing a saved layer requires consent and respects cancellation", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-add="peony"]').click();
  await page.locator("#finale-open").click();
  let accept = false;
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    return accept ? d.accept() : d.dismiss();
  });
  await page
    .getByRole("button", { name: "Remove Peony layer", exact: true })
    .click();
  expect(dialogs).toHaveLength(1);
  expect(
    (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(1);
  accept = true;
  await page
    .getByRole("button", { name: "Remove Peony layer", exact: true })
    .click();
  await expect(page.locator("[data-layer]")).toHaveCount(0);
  expect(
    (
      await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)),
        STORAGE_KEY,
      )
    ).layers,
  ).toHaveLength(0);
});

for (const method of ["file", "preset"])
  test(`${method} replacement stops the old finale and queued audio`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__afterlight.addLayer("willow"));
    await page.locator("#sound-toggle").click();
    await expect(page.locator("#sound-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.locator("#finale-open").click();
    await page.locator("#finale-fire").click();
    expect(
      await page.evaluate(() => window.__afterlight.state.player.running),
    ).toBe(true);
    page.on("dialog", (d) => d.accept());
    if (method === "file") await importFile(page);
    else {
      await page.locator("#finale-open").click();
      await page.locator("#presets-open").click();
      await page.locator('[data-preset="0"]').click();
    }
    await expect
      .poll(
        () => page.evaluate(() => window.__afterlight.state.player.running),
        { timeout: 3000 },
      )
      .toBe(false);
    expect(
      (await page.evaluate(() => window.__afterlight.stats())).audio
        .activeVoices,
    ).toBe(0);
    const before = await page.evaluate(
      () => window.__afterlight.state.launches,
    );
    await page.evaluate(() => window.__afterlight.step(3));
    expect(await page.evaluate(() => window.__afterlight.state.launches)).toBe(
      before,
    );
  });

test("renderer retry reapplies the selected camera and matching audio listener", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#settings-open").click();
  await page.locator("#view").selectOption("wide");
  await page.locator("#settings [data-close-dialog]").click();
  const before = await page.evaluate(
    () => window.__afterlight.stats().audio.listener,
  );
  // A renderer-loss notification exercises the app recovery path; GPU loss itself has engine coverage.
  await page.evaluate(() =>
    document
      .querySelector("#sky")
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(page.locator("#canvas-error")).toBeVisible();
  await page.locator("#retry-renderer").click();
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.view)).toBe(
    "wide",
  );
  expect(
    await page.evaluate(() => window.__afterlight.stats().audio.listener),
  ).toEqual(before);
});

for (const width of [320, 390, 700])
  test(`${width}px controls have unobstructed hit targets and the open composer is accessible`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    const blocked = await page.evaluate(() =>
      [...document.querySelectorAll(".top-actions button,.swatch,#clear-sky")]
        .filter((n) => n.getClientRects().length)
        .flatMap((n) => {
          const r = n.getBoundingClientRect(),
            hit = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
          return r.left < 0 ||
            r.width < 24 ||
            r.right > innerWidth ||
            r.bottom > innerHeight ||
            hit?.closest("button") !== n
            ? [
                {
                  id: n.id || n.getAttribute("aria-label"),
                  right: r.right,
                  hit:
                    hit?.closest("button")?.id ||
                    hit?.getAttribute("aria-label"),
                },
              ]
            : [];
        }),
    );
    expect(blocked).toEqual([]);
    await page.locator('[data-fire="peony"]').click();
    await page.evaluate(() => window.__afterlight.step(4));
    const palette = await page.evaluate(
      () => window.__afterlight.state.palette,
    );
    const clear = await page.locator("#clear-sky").boundingBox();
    await page.mouse.click(
      clear.x + clear.width / 2,
      clear.y + clear.height / 2,
    );
    expect(
      (await page.evaluate(() => window.__afterlight.stats())).engine
        .activeParticles,
    ).toBe(0);
    expect(await page.evaluate(() => window.__afterlight.state.palette)).toBe(
      palette,
    );
    await page.locator('[data-add="peony"]').click();
    await page.locator("#finale-open").click();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await mkdir("evidence/screenshots", { recursive: true });
    await page.screenshot({
      path: `evidence/screenshots/composer-${width}.png`,
    });
  });
