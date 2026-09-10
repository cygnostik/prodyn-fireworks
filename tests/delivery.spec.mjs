import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { encodeShow, validateShow, STORAGE_KEY } from "../src/show.js";

async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
  });
}

test("show download is valid and opening a shared copy preserves the saved original", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-add="peony"]').click();
  await page.locator("#finale-open").click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-show").click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const part of stream) chunks.push(part);
  const original = validateShow(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
  expect(original.layers).toHaveLength(1);
  expect(original.layers[0].effectId).toBe("peony");
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  const shared = {
    version: 1,
    title: "Another night",
    duration: 16,
    layers: [
      { id: "shared-one", effectId: "willow", palette: "gold", density: 2 },
    ],
  };
  await page.goto(`./#show=${encodeShow(shared)}`);
  await page.waitForFunction(() => window.__afterlight?.ready);
  expect(await page.evaluate(() => window.__afterlight.state.show.title)).toBe(
    "Another night",
  );
  await page.locator('[data-add="peony"]').click();
  expect(
    (await page.evaluate(() => window.__afterlight.state.show.layers)).length,
  ).toBe(2);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(before);
});

test("static field guide, sound library and licence links work offline at phone width", async ({
  page,
  context,
}) => {
  await ready(page);
  await page.waitForFunction(
    () => window.__afterlight.stats().pwa.offlineReady,
  );
  await context.setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    for (const route of [
      "field-guide.html",
      "sound-library.html",
      "credits.html",
    ]) {
      await page.goto(`./${route}`);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
      const missing = await page.evaluate(async () => {
        const urls = [
          ...new Set(
            [...document.querySelectorAll("a[href],link[href],audio[src]")]
              .map((n) => n.href || n.src)
              .filter((u) => u.startsWith(location.origin) && !new URL(u).hash),
          ),
        ];
        const results = await Promise.all(
          urls.map(async (url) => ({ url, ok: (await fetch(url)).ok })),
        );
        return results.filter((r) => !r.ok);
      });
      expect(missing).toEqual([]);
      if (route === "field-guide.html")
        await expect(page.locator("article")).toHaveCount(40);
      if (route === "sound-library.html") {
        await expect(page.locator("audio")).toHaveCount(14);
        const duration = await page
          .locator("#original-demonstration audio")
          .evaluate(
            (el) =>
              new Promise((resolve, reject) => {
                el.addEventListener(
                  "loadedmetadata",
                  () => resolve(el.duration),
                  { once: true },
                );
                el.addEventListener(
                  "error",
                  () => reject(new Error("Could not decode cached WAV")),
                  { once: true },
                );
                el.load();
              }),
          );
        expect(duration).toBe(24);
        const seek = await page
          .locator("#original-demonstration audio")
          .evaluate(
            (el) =>
              new Promise((resolve) => {
                el.addEventListener(
                  "seeked",
                  () => resolve({ time: el.currentTime, ready: el.readyState }),
                  { once: true },
                );
                el.currentTime = 20;
              }),
          );
        expect(seek.time).toBe(20);
        expect(seek.ready).toBeGreaterThanOrEqual(2);
      }
    }
  } finally {
    await context.setOffline(false);
  }
});

test("offline WAV byte ranges preserve exact data and reject unsatisfiable requests", async ({
  page,
  context,
}) => {
  await ready(page);
  await page.waitForFunction(
    () => window.__afterlight.stats().pwa.offlineReady,
  );
  await context.setOffline(true);
  try {
    const results = await page.evaluate(async () => {
      const url = "./audio/demonstration.wav";
      const response = await fetch(url);
      const full = new Uint8Array(await response.arrayBuffer());
      const cases = [
        { range: "bytes=0-43", status: 206, start: 0, end: 44 },
        {
          range: "bytes=-128",
          status: 206,
          start: full.length - 128,
          end: full.length,
        },
        {
          range: `bytes=${full.length - 60}-`,
          status: 206,
          start: full.length - 60,
          end: full.length,
        },
        { range: `bytes=${full.length}-`, status: 416, start: 0, end: 0 },
        { range: "bytes=-0", status: 416, start: 0, end: 0 },
      ];
      const checks = [];
      for (const item of cases) {
        const part = await fetch(url, { headers: { Range: item.range } });
        const data = new Uint8Array(await part.arrayBuffer());
        const expected = full.slice(item.start, item.end);
        checks.push({
          range: item.range,
          status: part.status === item.status,
          bytes:
            data.length === expected.length &&
            data.every((b, i) => b === expected[i]),
          length: Number(part.headers.get("Content-Length")) === data.length,
          contentRange:
            part.headers.get("Content-Range") ===
            (item.status === 416
              ? `bytes */${full.length}`
              : `bytes ${item.start}-${item.end - 1}/${full.length}`),
        });
      }
      return {
        length: Number(response.headers.get("Content-Length")) === full.length,
        checks,
      };
    });
    expect(results.length).toBe(true);
    for (const check of results.checks)
      expect(check, check.range).toMatchObject({
        status: true,
        bytes: true,
        length: true,
        contentRange: true,
      });
  } finally {
    await context.setOffline(false);
  }
});

test("real manifest artwork dimensions, social metadata and rendered DSM fonts", async ({
  page,
}) => {
  await ready(page);
  const manifest = await (
    await page.request.get("./manifest.webmanifest")
  ).json();
  expect(manifest.scope).toBe("./");
  expect(manifest.start_url).toBe("./");
  expect(manifest.screenshots).toHaveLength(2);
  for (const asset of [...manifest.icons, ...manifest.screenshots]) {
    const response = await page.request.get(asset.src);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(asset.sizes);
  }
  expect(
    await page
      .locator('meta[property="og:image:width"]')
      .getAttribute("content"),
  ).toBe("1200");
  expect(
    await page.locator('meta[name="twitter:card"]').getAttribute("content"),
  ).toBe("summary_large_image");
  const cd = await contextFonts(page);
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/rendered-fonts.json", JSON.stringify(cd, null, 2));
  expect(
    cd.some(
      (font) =>
        font.isCustomFont &&
        font.glyphCount > 0 &&
        font.familyName.includes("Oxanium"),
    ),
  ).toBe(true);
});
async function contextFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: ".wordmark",
    });
    return (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally {
    await cdp.detach();
  }
}
