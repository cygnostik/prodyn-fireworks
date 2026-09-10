// SPDX-License-Identifier: MIT
// Optional: AUDIO_BROWSER_TEST=1 node --test tests/audio-browser.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const enabled = process.env.AUDIO_BROWSER_TEST === "1";
const root = new URL("../", import.meta.url);

test(
  "real Chromium: trusted opt-in, audio scheduling, rendered limiter, lifecycle",
  { skip: !enabled, timeout: 60000 },
  async () => {
    const { chromium } = await import("playwright");
    const temp = new URL("evidence/audio-revision/browser-temp/", root);
    await mkdir(temp, { recursive: true });
    const oldTemp = process.env.TMPDIR;
    process.env.TMPDIR = fileURLToPath(temp);
    const errors = [],
      networkFailures = [],
      externalRequests = [];
    const server = createServer(async (req, res) => {
      const modules = {
        "/audio.js": "src/audio/audio.js",
        "/synthesis.js": "src/audio/synthesis.js",
        "/samples.js": "src/audio/samples.js",
        "/sizzle.js": "src/audio/sizzle.js",
        "/audio/lift1.mp3": "public/audio/lift1.mp3",
        "/audio/burst1.mp3": "public/audio/burst1.mp3",
        "/audio/crackle-sm-1.mp3": "public/audio/crackle-sm-1.mp3",
      };
      if (modules[req.url]) {
        res.writeHead(200, {
          "Content-Type": req.url.endsWith(".mp3")
            ? "audio/mpeg"
            : "text/javascript",
        });
        res.end(await readFile(new URL(modules[req.url], root)));
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!doctype html><meta charset="utf-8"><title>Afterlight audio verification</title>
        <button id="enable">Enable test sound</button><output id="status">Disabled</output>
        <script type="module">
          import { FireworksAudio } from '/audio.js';
          window.audio = new FireworksAudio();
          window.initial = (async () => ({ stats: audio.getStats(), resume: await audio.resume(), enable: await audio.enable() }))();
          document.querySelector('#enable').onclick = async () => {
            window.result = await audio.enable();
            document.querySelector('#status').textContent = result ? 'Enabled' : 'Blocked';
          };
        </script>`);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
      const options = {
        headless: true,
        args: ["--mute-audio", "--autoplay-policy=user-gesture-required"],
      };
      if (process.env.AUDIO_CHROMIUM_PATH)
        options.executablePath = process.env.AUDIO_CHROMIUM_PATH;
      browser = await chromium.launch(options);
      const page = await browser.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) => networkFailures.push(r.url()));
      page.on("request", (r) => {
        if (!r.url().startsWith("http://127.0.0.1:"))
          externalRequests.push(r.url());
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.audio);
      const initial = await page.evaluate(() => window.initial);
      assert.equal(initial.stats.contextState, "uninitialized");
      assert.equal(initial.resume, false);
      assert.equal(
        initial.enable,
        false,
        "no gesture is rejected by the engine",
      );
      await page.click("#enable");
      await page.waitForFunction(() => window.result === true);
      assert.equal(await page.evaluate(() => audio.whenSamplesReady()), true);
      const runtime = await page.evaluate(() => {
        audio.setListener([0, 0, 0]);
        const now = audio._context.currentTime;
        const voice = audio.emit({
          kind: "burst",
          effectId: "peony",
          position: [0, 0, 343],
          power: 1,
          time: 99,
        });
        return { now, voice, stats: audio.getStats() };
      });
      assert.equal(runtime.stats.contextState, "running");
      assert.ok(Math.abs(runtime.voice.when - runtime.now - 1) < 1e-6);
      assert.equal(runtime.voice.lateBy, 0);
      const liveSignal = await page.evaluate(async () => {
        const context = audio._context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        audio._master.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const target = audio.getStats().lastSchedule.when;
        let peak = 0,
          beforeArrivalPeak = 0,
          readings = 0;
        const deadline = performance.now() + 4000;
        while (
          context.currentTime < target + 0.28 &&
          performance.now() < deadline
        ) {
          analyser.getFloatTimeDomainData(samples);
          const value = samples.reduce((n, x) => Math.max(n, Math.abs(x)), 0);
          peak = Math.max(peak, value);
          if (context.currentTime < target - 0.03)
            beforeArrivalPeak = Math.max(beforeArrivalPeak, value);
          readings++;
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        audio._master.disconnect(analyser);
        analyser.disconnect();
        return {
          peak,
          beforeArrivalPeak,
          readings,
          contextTime: context.currentTime,
          scheduledAt: target,
        };
      });
      assert.ok(
        liveSignal.peak > 0.001,
        "real running AudioContext produced nonzero samples",
      );
      assert.equal(liveSignal.beforeArrivalPeak, 0);

      // Silent OfflineAudioContext readback through the EXACT production bus graph.
      // This proves nonzero signal and limiter/delay behavior, not human hearing.
      const offline = await page.evaluate(async () => {
        const { synthesize } = await import("/synthesis.js");
        const { FireworksAudio } = await import("/audio.js");
        const rate = 48000;
        const context = new OfflineAudioContext(2, rate * 6, rate);
        const engine = new FireworksAudio({ volume: 1 });
        engine._context = context;
        engine._buildGraph();
        const pcm = synthesize("salute", { sampleRate: rate });
        const buffer = context.createBuffer(2, pcm.channels[0].length, rate);
        pcm.channels.forEach((c, i) => buffer.copyToChannel(c, i));
        // Deliberate overload beyond the live voice cap tests the limiter margin.
        for (let i = 0; i < 80; i++) {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(engine._input);
          source.start(1);
        }
        const rendered = await context.startRendering();
        let peak = 0,
          nonFinite = 0,
          clipped = 0,
          energy = 0,
          preEnergy = 0,
          first = null;
        for (let c = 0; c < rendered.numberOfChannels; c++) {
          const samples = rendered.getChannelData(c);
          for (let i = 0; i < samples.length; i++) {
            const v = samples[i];
            if (!Number.isFinite(v)) nonFinite++;
            peak = Math.max(peak, Math.abs(v));
            energy += v * v;
            if (Math.abs(v) >= 1) clipped++;
            if (i < rate) preEnergy += v * v;
            if (c === 0 && first === null && Math.abs(v) > 1e-7)
              first = i / rate;
          }
        }
        return {
          peak,
          clipped,
          nonFinite,
          rms: Math.sqrt(energy / (rate * 6 * 2)),
          preEnergy,
          firstNonzeroSeconds: first,
          frames: rendered.length,
          sampleRate: rendered.sampleRate,
          voicesMixed: 80,
        };
      });
      assert.equal(offline.nonFinite, 0);
      assert.equal(offline.clipped, 0);
      assert.ok(offline.peak > 0.05 && offline.peak <= 0.920001);
      assert.equal(offline.preEnergy, 0);
      assert.ok(
        offline.firstNonzeroSeconds >= 1 && offline.firstNonzeroSeconds < 1.02,
      );
      assert.ok(offline.rms > 0.001);
      const lifecycle = await page.evaluate(async () => {
        const event = {
          kind: "burst",
          effectId: "salute",
          position: [0, 0, 343],
          power: 2,
          time: 10,
        };
        for (let i = 0; i < 70; i++) audio.emit({ ...event, time: i });
        const finale = audio.getStats();
        await audio.suspend();
        const suspended = audio.getStats();
        const explicitResume = await audio.resume();
        audio.setEnabled(false);
        const mutedResume = await audio.resume();
        await audio.dispose();
        return {
          finale,
          suspended,
          explicitResume,
          mutedResume,
          disposed: audio.getStats(),
        };
      });
      assert.equal(lifecycle.finale.activeVoices, lifecycle.finale.maxVoices);
      assert.equal(lifecycle.suspended.activeVoices, 0);
      assert.equal(lifecycle.suspended.contextState, "suspended");
      assert.equal(lifecycle.explicitResume, true);
      assert.equal(lifecycle.mutedResume, false);
      assert.equal(lifecycle.disposed.contextState, "closed");
      assert.equal(lifecycle.disposed.cachedBuffers, 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(networkFailures, []);
      assert.deepEqual(externalRequests, []);
      const report = {
        command:
          "AUDIO_BROWSER_TEST=1 node --test tests/audio-browser.test.mjs",
        browser: await browser.version(),
        backend: "Chromium headless on host; speaker output muted by test flag",
        initial,
        runtime,
        liveSignal,
        offline,
        lifecycle,
        errors,
        networkFailures,
        externalRequests,
        humanListening: "not performed",
        limits:
          "Chromium only. Offline rendering verifies samples, not perceived realism, hardware latency, Safari/iOS, speaker output, or bfcache.",
      };
      await writeFile(
        new URL("evidence/audio-revision/legacy-browser.json", root),
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(
        JSON.stringify(
          {
            browser: report.browser,
            scheduledDelay: runtime.voice.delay,
            liveSignal,
            offline,
            highWaterVoices: lifecycle.finale.highWaterVoices,
            errors,
            externalRequests,
          },
          null,
          2,
        ),
      );
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
      if (oldTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = oldTemp;
    }
  },
);
