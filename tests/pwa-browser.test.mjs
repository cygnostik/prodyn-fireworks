import assert from "node:assert/strict";
import { once } from "node:events";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { build, createServer } from "vite";

const helper = fileURLToPath(new URL("../src/pwa/pwa.js", import.meta.url));
const builderURL = new URL("../scripts/build-pwa.mjs", import.meta.url);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};
const nestedScope = "/exhibits/afterlight/";

async function poll(
  fn,
  predicate = Boolean,
  description = "condition",
  timeout = 15000,
) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await fn();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < end);
  assert.fail(`Timed out waiting for ${description}: ${JSON.stringify(value)}`);
}

async function launch() {
  const edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
  let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) {
    try {
      await access(edge);
      executablePath = edge;
    } catch {
      /* Use the installed Playwright Chromium on other platforms. */
    }
  }
  return chromium.launch({ executablePath, headless: true });
}

async function fixture(t, { scope = nestedScope } = {}) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "afterlight-pwa-browser-"));
  let browser;
  let server;
  let context;
  const releases = new Map();
  const requests = [];
  let current;
  let intercept = () => false;
  t.after(async () => {
    await context?.close();
    await browser?.close();
    server?.closeAllConnections();
    if (server?.listening)
      await new Promise((resolve) => server.close(resolve));
    await rm(tmp, { recursive: true, force: true });
  });

  async function compile(label) {
    const root = path.join(tmp, `source-${label}`);
    const outDir = path.join(tmp, `dist-${label}`);
    await mkdir(path.join(root, "public", "assets"), { recursive: true });
    await writeFile(
      path.join(root, "index.html"),
      '<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./assets/icon.svg"><title>AFTERLIGHT PWA fixture</title></head><body><main id="app">Loading</main><script type="module" src="/main.js"></script></body></html>',
    );
    await writeFile(
      path.join(root, "main.js"),
      `import { setupPWA } from ${JSON.stringify(helper)};\nwindow.pwa = setupPWA({ onStatus(state) { window.statuses ||= []; window.statuses.push(state); window.controllerStates ||= []; window.controllerStates.push(navigator.serviceWorker?.controller?.state || 'none'); window.pwaState = state; } });\nconst payload = await (await fetch('./assets/payload.json')).json();\nconst { render } = await import('./feature.js');\nconst icon = new Image(); icon.src = './assets/icon.svg'; await icon.decode();\nrender(payload);\nwindow.booted = ${JSON.stringify(label)};\n`,
    );
    await writeFile(
      path.join(root, "feature.js"),
      `export function render(payload) { document.querySelector('#app').textContent = 'Running ${label}: ' + payload.instrument; }`,
    );
    await writeFile(
      path.join(root, "public", "manifest.webmanifest"),
      JSON.stringify({
        name: "AFTERLIGHT",
        short_name: "Afterlight",
        id: "./",
        start_url: "./",
        scope: "./",
        display: "standalone",
        icons: [
          { src: "./assets/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      }),
    );
    await writeFile(
      path.join(root, "public", "assets", "icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="#050A0F"/></svg>',
    );
    await writeFile(
      path.join(root, "public", "assets", "payload.json"),
      JSON.stringify({ instrument: "fireworks", release: label }),
    );
    await writeFile(
      path.join(root, "public", "assets", "late.txt"),
      `Only precache loads this late asset: ${label}.`.repeat(80),
    );
    await writeFile(
      path.join(root, "public", ".htaccess"),
      "PRIVATE SERVER CONFIGURATION",
    );
    await writeFile(
      path.join(root, "public", "robots.txt"),
      "User-agent: *\nAllow: /\n",
    );
    const oldNodeEnv = process.env.NODE_ENV;
    try {
      await build({
        root,
        configFile: false,
        envFile: false,
        base: "./",
        cacheDir: path.join(tmp, "vite-cache"),
        logLevel: "silent",
        build: { outDir, emptyOutDir: true, minify: false },
      });
    } finally {
      if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldNodeEnv;
    }
    const { buildPWA } = await import(builderURL);
    const inventory = await buildPWA({
      distDir: outDir,
      version: "1.0.0",
      release: label,
    });
    const result = { root, outDir, inventory };
    releases.set(label, result);
    return result;
  }
  current = await compile("first");
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      requests.push({
        method: req.method,
        path: url.pathname,
        release: current.inventory.release,
      });
      if (!url.pathname.startsWith(scope)) {
        res.writeHead(404);
        res.end("Outside this fixture");
        return;
      }
      const relative =
        decodeURIComponent(url.pathname.slice(scope.length)) || "index.html";
      if (relative.split("/").includes("..")) {
        res.writeHead(403);
        res.end();
        return;
      }
      const bytes = await readFile(path.join(current.outDir, relative));
      if (await intercept({ req, res, relative, bytes, current })) return;
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(relative)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Length": bytes.length,
      });
      res.end(bytes);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await launch();
  context = await browser.newContext({ serviceWorkers: "allow" });
  return {
    tmp,
    browser,
    context,
    origin,
    scope,
    url: `${origin}${scope}`,
    requests,
    compile,
    current: () => current,
    use: (label) => {
      current = releases.get(label);
    },
    intercept: (fn) => {
      intercept = fn;
    },
  };
}

async function boot(f, context = f.context) {
  const page = await context.newPage();
  await page.goto(f.url);
  await page.waitForFunction(() => Boolean(window.booted));
  return page;
}
async function ready(page) {
  try {
    await page.waitForFunction(
      () => window.pwa?.getState().offlineReady === true,
      null,
      { timeout: 10000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(async () => ({
      statuses: window.statuses,
      controllerHistory: window.controllerStates,
      controller: navigator.serviceWorker.controller?.state,
      active: (await navigator.serviceWorker.getRegistration())?.active?.state,
      caches: await caches.keys(),
    }));
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic)}`);
  }
  return page.evaluate(() => window.pwa.getState());
}
async function cacheNames(page) {
  return page.evaluate(() => caches.keys());
}
async function triggerUpdate(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
}

test(
  "real generated worker waits for full precache, then cold-boots offline in a relative subdirectory",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    let releaseLate;
    let lateRequested = false;
    const gate = new Promise((resolve) => {
      releaseLate = resolve;
    });
    t.after(() => releaseLate());
    f.intercept(async ({ relative }) => {
      if (relative === "assets/late.txt") {
        lateRequested = true;
        await gate;
      }
      return false;
    });
    const page = await boot(f);
    await poll(() => lateRequested, Boolean, "late precache request");
    assert.equal(
      await page.evaluate(() => window.pwa.getState().offlineReady),
      false,
    );
    assert.equal(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      false,
    );
    releaseLate();
    assert.equal((await ready(page)).online, true);
    assert.ok(
      f.requests.every((request) => request.path.startsWith(f.scope)),
      "all application requests stay inside the deployed subdirectory",
    );
    assert.equal(
      f.requests.some((request) => request.path.endsWith(".htaccess")),
      false,
    );
    await page.close();
    await f.context.setOffline(true);
    const offline = await boot(f);
    const state = await ready(offline);
    assert.equal(
      state.online,
      await offline.evaluate(() => navigator.onLine),
      "online mirrors the browser connection hint, not a connectivity guarantee",
    );
    assert.equal(
      await offline.evaluate(async (url) => {
        try {
          await fetch(url, { cache: "no-store" });
          return false;
        } catch {
          return true;
        }
      }, `${f.origin}/uncached-network-probe`),
      true,
      "real network is unavailable; no offline response is mocked",
    );
    assert.equal(await offline.textContent("#app"), "Running first: fireworks");
    for (const entry of f.current().inventory.entries) {
      const actual = await offline.evaluate(async (url) => {
        const response = await fetch(url);
        return {
          ok: response.ok,
          bytes: [...new Uint8Array(await response.arrayBuffer())],
        };
      }, `${f.url}${entry.url}`);
      assert.equal(actual.ok, true, entry.url);
      assert.deepEqual(
        Buffer.from(actual.bytes),
        await readFile(
          path.join(f.current().outDir, decodeURIComponent(entry.url)),
        ),
        entry.url,
      );
    }
  },
);

test(
  "a waiting update needs consent, reloads only its caller, and preserves peer assets and foreign caches",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const first = await boot(f);
    const peer = await boot(f);
    await ready(first);
    await ready(peer);
    const foreignNames = [
      "unrelated-app-cache",
      `afterlight:pwa:${encodeURIComponent(`${f.origin}/exhibits/afterlight-other/`)}:release:foreign`,
    ];
    await first.evaluate(async (names) => {
      for (const name of names) {
        const cache = await caches.open(name);
        await cache.put("./foreign-sentinel", new Response("Do not delete"));
      }
      window.showToken = "first-show";
    }, foreignNames);
    await peer.evaluate(() => {
      window.showToken = "peer-show";
    });
    const oldFeature = f
      .current()
      .inventory.entries.find((entry) => /assets\/feature-/.test(entry.url));
    const oldFeatureBytes = await readFile(
      path.join(f.current().outDir, oldFeature.url),
    );
    let firstNavigations = 0;
    let peerNavigations = 0;
    first.on("framenavigated", (frame) => {
      if (frame === first.mainFrame()) firstNavigations++;
    });
    peer.on("framenavigated", (frame) => {
      if (frame === peer.mainFrame()) peerNavigations++;
    });
    await f.compile("second");
    f.use("second");
    await triggerUpdate(first);
    await first.waitForFunction(() => window.pwa.getState().updateAvailable);
    await peer.waitForFunction(() => window.pwa.getState().updateAvailable);
    await first.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const channel = new MessageChannel();
      registration.waiting.postMessage(
        { type: "AFTERLIGHT_ACTIVATE", consent: false },
        [channel.port2],
      );
      setTimeout(() => channel.port1.close(), 1000);
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(firstNavigations, 0);
    assert.equal(peerNavigations, 0);
    assert.equal(await first.evaluate(() => window.showToken), "first-show");
    assert.equal(
      await first.evaluate(
        async () =>
          (await navigator.serviceWorker.getRegistration()).waiting.state,
      ),
      "installed",
    );
    await Promise.all([
      first.waitForEvent(
        "framenavigated",
        (frame) => frame === first.mainFrame(),
      ),
      first.evaluate(() => {
        void window.pwa.applyUpdate();
      }),
    ]);
    await first.waitForFunction(() => window.booted === "second");
    await ready(first);
    await peer.waitForFunction(() => !window.pwa.getState().updateAvailable);
    assert.equal(firstNavigations, 1);
    assert.equal(peerNavigations, 0);
    assert.equal(await peer.evaluate(() => window.showToken), "peer-show");
    assert.equal(await peer.evaluate(() => window.booted), "first");
    await f.context.setOffline(true);
    assert.equal(
      await peer.evaluate(
        async () =>
          (await (await fetch("./assets/payload.json")).json()).release,
      ),
      "first",
      "open peers keep same-name assets from their own release",
    );
    assert.deepEqual(
      Buffer.from(
        await peer.evaluate(
          async (url) => [
            ...new Uint8Array(await (await fetch(url)).arrayBuffer()),
          ],
          `${f.url}${oldFeature.url}`,
        ),
      ),
      oldFeatureBytes,
    );
    const retained = await cacheNames(first);
    assert.ok(retained.some((name) => name.endsWith(":first")));
    for (const name of foreignNames) assert.ok(retained.includes(name));
    await peer.close();
    // A real visibility event requests controller/precache status and safely prunes dead document pins.
    await first.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await poll(
      () => cacheNames(first),
      (names) => !names.some((name) => name.endsWith(":first")),
      "retirement of unused old release",
    );
    const after = await cacheNames(first);
    for (const name of foreignNames) assert.ok(after.includes(name));
    await first.close();
    const offline = await boot(f);
    await ready(offline);
    assert.equal(await offline.evaluate(() => window.booted), "second");
  },
);

test(
  "failed initial precaches reject 404, HTML substitution, truncation, and redirects atomically",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const failures = [
      "404",
      "html-mime",
      "html-same-length",
      "truncated",
      "redirect",
    ];
    for (const kind of failures) {
      await t.test(kind, async (t) => {
        const context = await f.browser.newContext({ serviceWorkers: "allow" });
        t.after(() => context.close());
        f.intercept(({ relative, bytes, res }) => {
          if (relative !== "assets/late.txt") return false;
          if (kind === "404") {
            res.writeHead(404);
            res.end("Missing asset");
          }
          if (kind === "html-mime" || kind === "html-same-length") {
            res.writeHead(200, {
              "Content-Type": kind === "html-mime" ? "text/html" : "text/plain",
            });
            res.end(Buffer.from("<!doctype html>".padEnd(bytes.length, " ")));
          }
          if (kind === "truncated") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(bytes.subarray(0, bytes.length - 1));
          }
          if (kind === "redirect") {
            res.writeHead(302, { Location: "./payload.json" });
            res.end();
          }
          return true;
        });
        const page = await boot(f, context);
        await page.waitForFunction(() =>
          window.statuses.some((state) =>
            /could not be prepared/i.test(state.message),
          ),
        );
        assert.equal(
          await page.evaluate(() => window.pwa.getState().offlineReady),
          false,
        );
        assert.equal(
          await page.evaluate(() =>
            Boolean(navigator.serviceWorker.controller),
          ),
          false,
        );
        assert.deepEqual(await cacheNames(page), []);
        await page.close();
        await context.setOffline(true);
        const cold = await context.newPage();
        await assert.rejects(
          cold.goto(f.url),
          /ERR_INTERNET_DISCONNECTED|ERR_FAILED/,
        );
      });
    }
  },
);

test(
  "a failed update keeps the previous production release cold-bootable offline",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t, { scope: "/" });
    const page = await boot(f);
    await ready(page);
    await f.compile("broken-update");
    f.use("broken-update");
    f.intercept(({ relative, res }) => {
      if (relative !== "assets/late.txt") return false;
      res.writeHead(503);
      res.end("Unavailable");
      return true;
    });
    await triggerUpdate(page);
    await page.waitForFunction(() =>
      window.statuses.some((state) =>
        /existing offline copy is still available/i.test(state.message),
      ),
    );
    assert.equal(
      await page.evaluate(() => window.pwa.getState().updateAvailable),
      false,
    );
    assert.equal(
      await page.evaluate(() => window.pwa.getState().offlineReady),
      true,
    );
    assert.equal(
      (await cacheNames(page)).some((name) => name.endsWith(":broken-update")),
      false,
    );
    await page.close();
    await f.context.setOffline(true);
    const offline = await boot(f);
    await ready(offline);
    assert.equal(await offline.evaluate(() => window.booted), "first");
  },
);

test(
  "actual browser quota exhaustion cannot produce an offline-ready partial install",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.context.newPage();
    const session = await f.context.newCDPSession(page);
    await session.send("Storage.overrideQuotaForOrigin", {
      origin: f.origin,
      quotaSize: 1024,
    });
    await page.goto(f.url);
    await page.waitForFunction(() => Boolean(window.booted));
    const quota = await session.send("Storage.getUsageAndQuota", {
      origin: f.origin,
    });
    assert.equal(quota.quota, 1024, JSON.stringify(quota));
    assert.equal(
      quota.overrideActive,
      true,
      "browser quota is genuinely constrained, not a mocked Cache API",
    );
    await page.waitForFunction(() =>
      window.statuses.some((state) =>
        /could not be prepared|storage or registration is unavailable/i.test(
          state.message,
        ),
      ),
    );
    assert.equal(
      await page.evaluate(() => window.pwa.getState().offlineReady),
      false,
    );
    assert.deepEqual(await cacheNames(page), []);
    await page.close();
    await f.context.setOffline(true);
    const offline = await f.context.newPage();
    await assert.rejects(
      offline.goto(f.url),
      /ERR_INTERNET_DISCONNECTED|ERR_FAILED/,
    );
  },
);

test(
  "readiness is revoked when an actual precached asset is evicted",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const page = await boot(f);
    await ready(page);
    await page.evaluate(async () => {
      const name = (await caches.keys()).find((value) =>
        value.endsWith(":first"),
      );
      const cache = await caches.open(name);
      await cache.delete("./assets/late.txt");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(
      () => window.pwa.getState().offlineReady === false,
    );
    assert.equal(
      await page.evaluate(() => navigator.serviceWorker.controller.state),
      "activated",
      "a live controller alone is not readiness",
    );
  },
);

test(
  "install capability is consent-gated; iOS guidance, unsupported browsers, and disposal do not claim installation",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const page = await boot(f);
    await ready(page);
    const initialChildren = await page.locator("body > *").count();
    assert.equal(
      await page.evaluate(() => window.pwa.getState().installable),
      false,
    );
    // Synthetic prompt events exercise capability/UI policy, not OS install certification.
    await page.evaluate(() => {
      window.promptCalls = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = () => {
        window.promptCalls++;
        return Promise.resolve({ outcome: "accepted" });
      };
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
      window.promptWasPrevented = event.defaultPrevented;
    });
    assert.equal(
      await page.evaluate(() => window.pwa.getState().installable),
      true,
    );
    assert.equal(await page.evaluate(() => window.promptCalls), 0);
    assert.equal(await page.evaluate(() => window.promptWasPrevented), true);
    assert.equal(await page.evaluate(() => window.pwa.install()), "accepted");
    assert.equal(await page.evaluate(() => window.promptCalls), 1);
    assert.equal(
      await page.evaluate(() => window.pwa.getState().installed),
      false,
      "accepting a prompt is not proof of OS installation",
    );
    assert.equal(
      await page.evaluate(() => window.pwa.install()),
      "unavailable",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    assert.equal(
      await page.evaluate(() => window.pwa.getState().installed),
      true,
    );
    assert.equal(
      await page.locator("body > *").count(),
      initialChildren,
      "helper adds no visible DOM",
    );
    const beforeDispose = await page.evaluate(() => {
      window.pwa.dispose();
      return window.statuses.length;
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("appinstalled"));
    });
    assert.equal(
      await page.evaluate(() => window.statuses.length),
      beforeDispose,
    );
    assert.equal(await page.evaluate(() => window.pwa.applyUpdate()), false);

    const iosContext = await f.browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      serviceWorkers: "allow",
    });
    t.after(() => iosContext.close());
    const iosPage = await boot(f, iosContext);
    assert.equal(await iosPage.evaluate(() => window.pwa.getState().ios), true);
    assert.equal(await iosPage.evaluate(() => window.pwa.install()), "ios");
    // Download and connectivity updates must not erase requested installation help.
    await iosPage.evaluate(() => window.dispatchEvent(new Event("online")));
    await ready(iosPage);
    assert.match(
      await iosPage.evaluate(() => window.pwa.getState().message),
      /Safari.*Share.*Add to Home Screen/,
    );
    assert.equal(
      await iosPage.evaluate(() => window.pwa.getState().installed),
      false,
    );

    const unsupported = await f.browser.newContext();
    t.after(() => unsupported.close());
    await unsupported.addInitScript(() => {
      delete Navigator.prototype.serviceWorker;
    });
    const unsupportedPage = await boot(f, unsupported);
    assert.equal(
      await unsupportedPage.evaluate(() => window.pwa.getState().supported),
      false,
    );
    assert.equal(
      await unsupportedPage.evaluate(() => window.pwa.getState().offlineReady),
      false,
    );
    assert.equal(
      await unsupportedPage.evaluate(() => window.pwa.getState().installable),
      false,
    );
  },
);

test(
  "synchronous registration denial leaves the online application usable without claiming readiness",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    await f.context.addInitScript(() => {
      // Exercise an API-denial branch only; no registration, cache, or offline success is faked.
      navigator.serviceWorker.register = () => {
        throw new DOMException(
          "Registration disabled by browser policy",
          "SecurityError",
        );
      };
    });
    const page = await f.context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(f.url);
    try {
      await page.waitForFunction(() => Boolean(window.booted), null, {
        timeout: 2000,
      });
    } catch {
      assert.fail(
        `Online app failed after registration denial: ${JSON.stringify(errors)}`,
      );
    }
    assert.equal(
      await page.evaluate(() => window.pwa.getState().offlineReady),
      false,
    );
    assert.match(
      await page.evaluate(() => window.pwa.getState().message),
      /storage or registration is unavailable/i,
    );
    assert.deepEqual(errors, []);
  },
);

test(
  "Vite development mode never registers a service worker",
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t);
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    let server;
    t.after(async () => {
      await server?.close();
      server?.httpServer?.closeAllConnections();
      if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldNodeEnv;
    });
    server = await createServer({
      root: f.current().root,
      configFile: false,
      envFile: false,
      base: "./",
      cacheDir: path.join(f.tmp, "dev-cache"),
      logLevel: "silent",
      server: {
        host: "127.0.0.1",
        port: 0,
        fs: { allow: [f.tmp, await realpath(f.tmp), path.dirname(helper)] },
      },
    });
    await server.listen();
    const page = await f.context.newPage();
    const swRequests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("request", (request) => {
      if (request.url().endsWith("/sw.js")) swRequests.push(request.url());
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    try {
      await page.waitForFunction(() => Boolean(window.booted), null, {
        timeout: 5000,
      });
    } catch (error) {
      throw new Error(`${error.message}\n${JSON.stringify(errors)}`);
    }
    assert.equal(
      await page.evaluate(() => window.pwa.getState().supported),
      false,
    );
    assert.match(
      await page.evaluate(() => window.pwa.getState().message),
      /production build.*development server/,
    );
    assert.deepEqual(
      await page.evaluate(async () =>
        (await navigator.serviceWorker.getRegistrations()).map(
          (registration) => registration.scope,
        ),
      ),
      [],
    );
    assert.deepEqual(swRequests, []);
  },
);
