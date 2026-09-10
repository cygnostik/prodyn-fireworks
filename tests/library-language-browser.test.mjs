import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { chromium } from "@playwright/test";
const root = new URL("../public/", import.meta.url);
const types = {
  html: "text/html",
  js: "text/javascript",
  css: "text/css",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  woff2: "font/woff2",
  svg: "image/svg+xml",
};
test("generated docs: nested deployment, native playback, Spanish and persistence", async (t) => {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ).replace(/^\/nested\//, "");
      if (path.includes("..") || path.startsWith("/"))
        throw new Error("Invalid path");
      const bytes = await readFile(new URL(path, root));
      res.writeHead(200, {
        "Content-Type": types[path.split(".").pop()] || "text/plain",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const base = `http://127.0.0.1:${server.address().port}/nested/`;
    const page = await browser.newPage({
      locale: "en-US",
      viewport: { width: 390, height: 844 },
    });
    await page.goto(base + "sound-library.html");
    await page.evaluate(() => document.fonts.ready);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root: dom } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: dom.nodeId,
      selector: "h1 span",
    });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(
      fonts.some(
        (font) =>
          font.isCustomFont &&
          font.glyphCount > 0 &&
          /Oxanium/i.test(font.familyName),
      ),
      "Oxanium renders heading glyphs",
    );
    await cdp.detach();
    assert.equal(await page.locator("audio").count(), 14);
    assert.ok(
      await page
        .locator("audio")
        .evaluateAll((nodes) =>
          nodes.every((n) => n.paused && !n.autoplay && n.preload === "none"),
        ),
    );
    for (const file of [
      "lift1.mp3",
      "burst1.mp3",
      "crackle-sm-1.mp3",
      "current-fountain.wav",
      "current-waterfall.wav",
    ]) {
      const result = await page
        .locator(`audio[src="./audio/${file}"]`)
        .evaluate(async (a) => {
          await a.play();
          await new Promise((r) => setTimeout(r, 80));
          const result = {
            duration: a.duration,
            playing: !a.paused,
            error: a.error?.code ?? null,
          };
          a.pause();
          return result;
        });
      assert.equal(result.error, null, file);
      assert.ok(result.duration > 0, file);
      assert.ok(result.playing, file);
    }
    await page.screenshot({
      path: "/tmp/afterlight-docs-en-mobile.png",
      fullPage: false,
    });
    for (const width of [390, 700, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}`,
      );
    }
    let shared = true;
    try {
      await access(new URL("language.js", root));
    } catch {
      shared = false;
    }
    await t.test(
      "real shared language module integration",
      { skip: !shared && "Parent-owned public/language.js not available yet" },
      async () => {
        await page.reload();
        await page.selectOption("[data-language-switch]", "es-MX");
        await page.waitForFunction(
          () => document.documentElement.lang === "es-MX",
        );
        assert.equal(await page.title(), "Biblioteca de sonidos — Afterlight");
        assert.equal(
          await page.locator("h1").innerText(),
          "Que suene el cielo.",
        );
        for (const file of ["field-guide", "credits", "sound-library"]) {
          await page.goto(base + file + ".html");
          await page.waitForFunction(
            () => document.documentElement.lang === "es-MX",
          );
          const mismatches = await page
            .locator("[data-en][data-es-mx]")
            .evaluateAll((nodes) =>
              nodes
                .filter((n) => {
                  const attr = n.getAttribute("data-language-attribute");
                  return (
                    (attr ? n.getAttribute(attr) : n.textContent) !==
                    n.getAttribute("data-es-mx")
                  );
                })
                .map((n) => n.tagName),
            );
          assert.deepEqual(mismatches, []);
          for (const width of [390, 700]) {
            await page.setViewportSize({ width, height: 844 });
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `${file} Spanish overflow ${width}`,
            );
          }
        }
        await page.screenshot({
          path: "/tmp/afterlight-docs-es-mobile.png",
          fullPage: false,
        });
        await page.selectOption("[data-language-switch]", "en");
        await page.reload();
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        const spanish = await browser.newContext({ locale: "es-MX" });
        const fresh = await spanish.newPage();
        await fresh.goto(base + "field-guide.html");
        await fresh.waitForFunction(
          () => document.documentElement.lang === "es-MX",
        );
        await spanish.close();
      },
    );
    await page.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
