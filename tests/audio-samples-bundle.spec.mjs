// SPDX-License-Identifier: MIT
// Private library build only; never invokes the application's shared dist build.
import { test, expect } from "@playwright/test";
import { build } from "vite";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const output = new URL("evidence/audio-revision/private-bundle/", root);
const prefix = "/offline/nested/";
let server, origin;
const html = `<!doctype html><meta charset="utf-8"><button id="enable">Enable</button><script type="module">
import { FireworksAudio } from './audio.js';
window.audio = new FireworksAudio(); window.enabledResult = false;
document.querySelector('#enable').onclick = async () => { window.enabledResult = await audio.enable(); };
</script>`;
const worker = `self.addEventListener('install', event => event.waitUntil(caches.open('audio-fixture-v1').then(cache => cache.addAll(['./', './audio.js', './audio/lift1.mp3', './audio/burst1.mp3', './audio/crackle-sm-1.mp3'])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));`;

test.beforeAll(async () => {
  await build({
    configFile: false,
    logLevel: "silent",
    base: "./",
    publicDir: false,
    build: {
      outDir: fileURLToPath(output),
      emptyOutDir: false,
      minify: true,
      lib: {
        entry: fileURLToPath(new URL("src/audio/audio.js", root)),
        formats: ["es"],
        fileName: () => "audio.js",
      },
    },
  });
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    try {
      if (pathname === prefix) {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(html);
        return;
      }
      if (pathname === prefix + "worker.js") {
        response.writeHead(200, { "Content-Type": "text/javascript" });
        response.end(worker);
        return;
      }
      const name = pathname.slice(prefix.length);
      const file =
        name === "audio.js"
          ? new URL("audio.js", output)
          : /^audio\/(lift1|burst1|crackle-sm-1)\.mp3$/.test(name)
            ? new URL(`public/${name}`, root)
            : null;
      if (!pathname.startsWith(prefix) || !file) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": name.endsWith(".mp3")
          ? "audio/mpeg"
          : "text/javascript",
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("Vite relative-base audio bundle decodes local samples after a cached offline reload without autoplay", async ({
  page,
  context,
}) => {
  const external = [],
    errors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin)) external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + prefix);
  await page.waitForFunction(() => window.audio);
  const initial = await page.evaluate(() => audio.getStats());
  expect(initial.contextState).toBe("uninitialized");
  await page.click("#enable");
  await expect.poll(() => page.evaluate(() => enabledResult)).toBe(true);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("./worker.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
    await audio.dispose();
  });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.audio);
  const reloaded = await page.evaluate(() => audio.getStats());
  expect(reloaded.contextState).toBe("uninitialized");
  expect(reloaded.samples.ready).toBe(0);
  await page.click("#enable");
  await expect.poll(() => page.evaluate(() => enabledResult)).toBe(true);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(true);
  const result = await page.evaluate(() => {
    const stats = audio.getStats();
    const cue = audio.emit({
      kind: "comet",
      effectId: "roman-candle",
      position: [0, 0, 343],
      power: 1,
      time: 5,
    });
    audio.stop();
    return { stats, cue };
  });
  expect(result.cue.sample).toBe("lift1.mp3");
  expect(result.stats.samples.ready).toBe(3);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    new URL("evidence/audio-revision/browser-bundle-offline.json", root),
    JSON.stringify(
      {
        initial,
        reloaded,
        ...result,
        external,
        errors,
        scope:
          "Real Vite relative-base library bundle with a private cache fixture; this does not claim a rebuilt/released app PWA.",
      },
      null,
      2,
    ) + "\n",
  );
  await page.evaluate(() => audio.dispose());
});
