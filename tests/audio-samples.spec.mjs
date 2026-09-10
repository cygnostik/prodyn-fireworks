// SPDX-License-Identifier: MIT
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const prefix = "/nested/afterlight/";
let server, origin;
const html = `<!doctype html><meta charset="utf-8"><title>Local audio sample verification</title><button id="enable">Enable</button>
<script type="module">
import { FireworksAudio } from './src/audio/audio.js';
window.audio = new FireworksAudio();
window.ready = false;
window.withoutConsent = (async () => ({ stats: audio.getStats(), enable: await audio.enable(), resume: await audio.resume() }))();
document.querySelector('#enable').onclick = async () => { window.ready = await audio.enable(); };
</script>`;

test.beforeAll(async () => {
  await mkdir(new URL("evidence/audio-revision/", root), { recursive: true });
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === prefix || pathname === `${prefix}index.html`) {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(html);
        return;
      }
      const relative = pathname.slice(prefix.length);
      const file = /^src\/audio\/[a-z-]+\.js$/.test(relative)
        ? relative
        : /^audio\/[a-z0-9-]+\.mp3$/.test(relative)
          ? `public/${relative}`
          : null;
      if (!pathname.startsWith(prefix) || !file) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = await readFile(new URL(file, root));
      response.writeHead(200, {
        "Content-Type": file.endsWith(".mp3")
          ? "audio/mpeg"
          : "text/javascript",
        "Content-Length": bytes.length,
      });
      response.end(bytes);
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
  await new Promise((resolve) => server?.close(resolve));
});

async function open(page) {
  await page.goto(origin + prefix);
  await page.waitForFunction(() => window.audio);
}
async function enable(page) {
  await page.click("#enable");
  await expect.poll(() => page.evaluate(() => window.ready)).toBe(true);
}
async function report(name, data) {
  await writeFile(
    new URL(`evidence/audio-revision/${name}.json`, root),
    JSON.stringify(data, null, 2) + "\n",
  );
}

test("real local MP3 decoding, exact routing/delay, and cached offline playback", async ({
  page,
  context,
  browser,
}) => {
  const requests = [],
    external = [],
    errors = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp3")) requests.push(request.url());
    if (!request.url().startsWith(origin)) external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  const initial = await page.evaluate(() => window.withoutConsent);
  expect(initial.stats.contextState).toBe("uninitialized");
  expect(initial.enable).toBe(false);
  expect(initial.resume).toBe(false);
  expect(requests).toHaveLength(0);
  await enable(page);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(true);
  expect(new Set(requests).size).toBe(3);
  expect(
    requests.every((url) => url.startsWith(origin + prefix + "audio/")),
  ).toBe(true);
  const decoded = await page.evaluate(async () => {
    const { analyzePCM } = await import("./src/audio/synthesis.js");
    return Object.fromEntries(
      [...audio._samples.buffers].map(([signature, buffer]) => {
        const channels = Array.from(
          { length: buffer.numberOfChannels },
          (_, i) => buffer.getChannelData(i),
        );
        const firstAudibleFrame = channels[0].findIndex(
          (value) => Math.abs(value) > 0.0001,
        );
        return [
          signature,
          {
            ...analyzePCM({ channels, sampleRate: buffer.sampleRate }),
            firstAudibleSeconds: firstAudibleFrame / buffer.sampleRate,
          },
        ];
      }),
    );
  });
  for (const value of Object.values(decoded)) {
    expect(value.nonFinite).toBe(0);
    expect(value.channels).toBe(2);
    expect(value.duration).toBeGreaterThan(0.3);
    expect(value.duration).toBeLessThan(2);
    expect(value.rms).toBeGreaterThan(0.01);
  }
  await context.setOffline(true);
  const offlineCached = await page.evaluate(() => {
    audio.setListener([0, 0, 0]);
    const schedules = [];
    for (const [kind, effectId] of [
      ["launch", "peony"],
      ["comet", "roman-candle"],
      ["burst", "peony"],
      ["burst", "crossette"],
      ["crackle", "crossette"],
      ["crackle", "crackle"],
      ["comet", "comet"],
      ["burst", "salute"],
      ["whistle", "bees"],
    ]) {
      const event = {
        kind,
        effectId,
        position: [0, 0, 343],
        power: 1,
        time: schedules.length,
      };
      const now = audio._context.currentTime;
      schedules.push({ now, ...audio.emit(event) });
    }
    const stats = audio.getStats();
    audio.stop();
    return { schedules, stats, stopped: audio.getStats() };
  });
  expect(offlineCached.schedules.map((value) => value.sample)).toEqual([
    "lift1.mp3",
    "lift1.mp3",
    "burst1.mp3",
    "burst1.mp3",
    "crackle-sm-1.mp3",
    "crackle-sm-1.mp3",
    null,
    null,
    null,
  ]);
  for (const voice of offlineCached.schedules) {
    expect(voice.when - voice.now).toBeCloseTo(1, 5);
    expect(voice.delay).toBe(1);
    expect(voice.lateBy).toBe(0);
  }
  expect(offlineCached.stopped.activeVoices).toBe(0);
  expect(requests).toHaveLength(3);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await report("browser-decode", {
    browser: browser.version(),
    initial,
    decoded,
    offlineCached,
    requests,
    external,
    errors,
    listening:
      "Not performed; browser speaker output muted. Offline here means cached buffers after consent, not a fresh uncached offline installation.",
  });
  await page.evaluate(() => audio.dispose());
});

test("real production graph renders continuous finite textures and cancelled sources stay silent", async ({
  page,
}) => {
  await open(page);
  await enable(page);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(true);
  const result = await page.evaluate(async () => {
    const { FireworksAudio } = await import("./src/audio/audio.js");
    const { analyzePCM, encodeWav } = await import("./src/audio/synthesis.js");
    const render = async (effectId, cancelled = false) => {
      const rate = 48000,
        duration = effectId === "fountain" ? 6.5 : 6;
      const context = new OfflineAudioContext(2, rate * 9, rate);
      // Offline contexts do not have the live consent/clock state. Only that seam
      // is controlled here; emit(), AudioNodes and production bus render for real.
      let clock = 0;
      const clocked = new Proxy(context, {
        get(target, key) {
          if (key === "state") return "running";
          if (key === "currentTime") return clock;
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const engine = new FireworksAudio({ volume: 1 });
      engine._context = clocked;
      engine._enabled = true;
      engine._buildGraph();
      engine.setListener([0, 0, 0]);
      const cue = {
        kind: "fountain",
        effectId,
        position: [0, 0, 343],
        power: 1,
        time: 0,
        emitterId: 1,
        emitterAge: 0,
        emitterDuration: duration,
      };
      const first = engine.emit(cue);
      const texture = [...engine._voices.values()][0].source.buffer;
      const source = {
        duration: texture.duration,
        loop: [...engine._voices.values()][0].source.loop,
        playbackRate: first.playbackRate,
      };
      clock = 3.2583333333333244;
      const renewed = engine.emit({ ...cue, time: clock, emitterAge: clock });
      const before = engine.getStats();
      if (cancelled) engine.stop();
      const rendered = await context.startRendering();
      const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
      const metrics = analyzePCM({ channels, sampleRate: rate });
      const windowRms = (start, end) => {
        const part = channels[0].subarray(
          Math.round(start * rate),
          Math.round(end * rate),
        );
        return Math.sqrt(
          part.reduce((sum, value) => sum + value * value, 0) / part.length,
        );
      };
      const continuity = {
        beforeRenewal: windowRms(4.05, 4.2),
        afterRenewal: windowRms(4.3, 4.45),
        atEnd: windowRms(first.endsAt - 0.04, first.endsAt),
        afterEnd: windowRms(first.endsAt + 0.08, 8.9),
        beforeStart: windowRms(0, 1),
      };
      let base64 = "";
      if (!cancelled) {
        const wav = encodeWav({ channels, sampleRate: rate });
        for (let at = 0; at < wav.length; at += 16384)
          base64 += String.fromCharCode(...wav.subarray(at, at + 16384));
        base64 = btoa(base64);
      }
      engine.stop();
      return {
        first,
        renewed,
        source,
        before,
        after: engine.getStats(),
        metrics,
        continuity,
        base64,
      };
    };
    return {
      fountain: await render("fountain"),
      waterfall: await render("waterfall"),
      cancelled: await render("fountain", true),
    };
  });
  for (const [effectId, duration] of [
    ["fountain", 6.5],
    ["waterfall", 6],
  ]) {
    const value = result[effectId];
    expect(value.first.when).toBe(1);
    expect(value.first.endsAt).toBe(1 + duration);
    expect(value.source).toEqual({ duration, loop: false, playbackRate: 1 });
    expect(value.renewed.continued).toBe(true);
    expect(value.before.emitted).toBe(1);
    expect(value.metrics.peak).toBeGreaterThan(0.01);
    expect(value.metrics.peak).toBeLessThan(0.920001);
    expect(value.metrics.nonFinite).toBe(0);
    expect(value.metrics.clipped).toBe(0);
    expect(value.continuity.beforeStart).toBe(0);
    expect(value.continuity.afterEnd).toBeLessThan(1e-7);
    expect(
      value.continuity.afterRenewal / value.continuity.beforeRenewal,
    ).toBeGreaterThan(0.7);
    expect(
      value.continuity.afterRenewal / value.continuity.beforeRenewal,
    ).toBeLessThan(1.3);
    expect(value.after.activeVoices).toBe(0);
    expect(value.after.continuousBytes).toBe(0);
    await writeFile(
      new URL(`evidence/audio-revision/${effectId}-browser-render.wav`, root),
      Buffer.from(value.base64, "base64"),
    );
    delete value.base64;
  }
  expect(result.cancelled.metrics.peak).toBe(0);
  delete result.cancelled.base64;
  await report("browser-render", result);
  await page.evaluate(() => audio.dispose());
});

test("selected recordings render through the production bus with cancellation and finale bounds", async ({
  page,
}) => {
  await open(page);
  await enable(page);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(true);
  const results = await page.evaluate(async () => {
    const { FireworksAudio } = await import("./src/audio/audio.js");
    const { analyzePCM } = await import("./src/audio/synthesis.js");
    const render = async (kind, effectId, count = 1, cancel = false) => {
      const context = new OfflineAudioContext(2, 48000 * 4, 48000);
      const clocked = new Proxy(context, {
        get(target, key) {
          if (key === "state") return "running";
          if (key === "currentTime") return 0;
          const value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const engine = new FireworksAudio({ volume: 1 });
      engine._context = clocked;
      engine._enabled = true;
      engine._samples.buffers = new Map(audio._samples.buffers);
      engine._buildGraph();
      engine.setListener([0, 0, 0]);
      let schedule;
      for (let i = 0; i < count; i++)
        schedule = engine.emit({
          kind,
          effectId,
          time: i,
          power: count > 1 ? 2 : 1,
          position: [0, 0, 343],
        });
      const before = engine.getStats();
      if (cancel) engine.stop();
      const rendered = await context.startRendering();
      const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
      const beforeArrival = channels[0]
        .subarray(0, 48000)
        .reduce((sum, value) => sum + value * value, 0);
      const metrics = analyzePCM({ channels, sampleRate: 48000 });
      engine.stop();
      return {
        schedule,
        before,
        after: engine.getStats(),
        metrics,
        beforeArrival,
      };
    };
    return {
      lift: await render("comet", "roman-candle"),
      burst: await render("burst", "crossette"),
      crackle: await render("crackle", "crossette"),
      finale: await render("burst", "peony", 60),
      cancelled: await render("burst", "peony", 60, true),
    };
  });
  for (const key of ["lift", "burst", "crackle", "finale"]) {
    const value = results[key];
    expect(value.schedule.when).toBe(1);
    expect(value.schedule.delay).toBe(1);
    expect(value.metrics.nonFinite).toBe(0);
    expect(value.metrics.clipped).toBe(0);
    expect(value.metrics.peak).toBeGreaterThan(0.01);
    expect(value.metrics.peak).toBeLessThan(0.920001);
    expect(value.beforeArrival).toBe(0);
    expect(value.after.activeVoices).toBe(0);
  }
  expect(results.finale.before.activeVoices).toBe(40);
  expect(results.finale.before.stolen).toBe(20);
  expect(results.cancelled.metrics.peak).toBe(0);
  await report("browser-recording-render", results);
  await page.evaluate(() => audio.dispose());
});

async function holdNativeDecode(page) {
  await page.addInitScript(() => {
    const native = AudioContext.prototype.decodeAudioData;
    window.decodeReleases = [];
    AudioContext.prototype.decodeAudioData = function (data) {
      return native
        .call(this, data)
        .then(
          (buffer) =>
            new Promise((resolve) =>
              decodeReleases.push(() => resolve(buffer)),
            ),
        );
    };
  });
}

test("mute/re-enable and disposal win over late real MP3 decodes without stale sound", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await holdNativeDecode(page);
  await open(page);
  await enable(page);
  await expect.poll(() => page.evaluate(() => decodeReleases.length)).toBe(3);
  const fallback = await page.evaluate(async () => {
    audio.setListener([0, 0, 0]);
    const now = audio._context.currentTime;
    const voice = audio.emit({
      kind: "burst",
      effectId: "peony",
      position: [0, 0, 343],
      power: 1,
      time: 0,
    });
    audio.setEnabled(false);
    return {
      now,
      voice,
      ready: await audio.whenSamplesReady(),
      stats: audio.getStats(),
    };
  });
  expect(fallback.voice.sample).toBe(null);
  expect(fallback.voice.when - fallback.now).toBeCloseTo(1, 5);
  expect(fallback.ready).toBe(false);
  expect(fallback.stats.activeVoices).toBe(0);
  expect(fallback.stats.enabled).toBe(false);
  await enable(page);
  await expect.poll(() => page.evaluate(() => decodeReleases.length)).toBe(6);
  const stale = await page.evaluate(async () => {
    decodeReleases.slice(0, 3).forEach((release) => release());
    await new Promise((resolve) => setTimeout(resolve, 0));
    return audio.getStats();
  });
  expect(stale.samples.ready).toBe(0);
  expect(stale.enabled).toBe(true);
  expect(stale.contextState).toBe("running");
  const fresh = await page.evaluate(async () => {
    decodeReleases.slice(3).forEach((release) => release());
    await audio.whenSamplesReady();
    return audio.getStats();
  });
  expect(fresh.samples.ready).toBe(3);
  expect(fresh.activeVoices).toBe(0);
  // A second real context is disposed while its native decodes are held.
  await page.evaluate(async () => {
    await audio.dispose();
    const { FireworksAudio } = await import("./src/audio/audio.js");
    window.audio = new FireworksAudio();
  });
  await enable(page);
  await expect.poll(() => page.evaluate(() => decodeReleases.length)).toBe(9);
  const disposed = await page.evaluate(async () => {
    await audio.dispose();
    decodeReleases.slice(6).forEach((release) => release());
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      stats: audio.getStats(),
      enable: await audio.enable(),
      resume: await audio.resume(),
    };
  });
  expect(disposed.stats.contextState).toBe("closed");
  expect(disposed.stats.cachedBuffers).toBe(0);
  expect(disposed.stats.samples.ready).toBe(0);
  expect(disposed.enable).toBe(false);
  expect(disposed.resume).toBe(false);
  expect(errors).toEqual([]);
  await report("browser-cancellation", {
    fallback,
    stale,
    fresh,
    disposed,
    errors,
  });
});

test("missing/corrupt local assets use immediate procedural fallback, never delayed replay", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/audio/*.mp3", async (route) => {
    const url = route.request().url();
    if (url.endsWith("lift1.mp3"))
      await route.fulfill({ status: 404, body: "Missing fixture" });
    else if (url.endsWith("burst1.mp3"))
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: "Not an MP3 fixture",
      });
    else await route.continue();
  });
  await open(page);
  await enable(page);
  expect(await page.evaluate(() => audio.whenSamplesReady())).toBe(false);
  const result = await page.evaluate(async () => {
    audio.setListener([0, 0, 0]);
    const now = audio._context.currentTime;
    const first = audio.emit({
      kind: "burst",
      effectId: "peony",
      position: [0, 0, 343],
      power: 1,
      time: 0,
    });
    const stats = audio.getStats();
    await audio.suspend();
    const resumed = await audio.resume();
    await audio.whenSamplesReady();
    const after = audio.getStats();
    await audio.dispose();
    return { now, first, stats, resumed, after };
  });
  expect(result.first.sample).toBe(null);
  expect(result.first.when - result.now).toBeCloseTo(1, 5);
  expect(result.stats.samples.ready).toBe(1);
  expect(result.stats.samples.state.launch).toBe("fallback");
  expect(result.stats.samples.state.burst).toBe("fallback");
  expect(result.stats.samples.state.crackle).toBe("ready");
  expect(result.resumed).toBe(true);
  expect(result.after.emitted).toBe(1);
  expect(result.after.activeVoices).toBe(0);
  expect(errors).toEqual([]);
  await report("browser-fallback", { ...result, errors });
});
