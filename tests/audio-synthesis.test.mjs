// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import {
  synthesize,
  SIGNATURES,
  analyzePCM,
  propagation,
  signatureForEvent,
  encodeWav,
} from "../src/audio/synthesis.js";

test("deterministic layered burst is finite, decays, and leaves headroom", () => {
  const a = synthesize("burst", { seed: 314, sampleRate: 24000 });
  const b = synthesize("burst", { seed: 314, sampleRate: 24000 });
  assert.deepEqual(a.channels, b.channels);
  assert.equal(a.sampleRate, 24000);
  assert.equal(a.channels.length, 2);
  assert.equal(
    a.channels[0].length,
    Math.round(SIGNATURES.burst.duration * a.sampleRate),
  );
  const stats = analyzePCM(a);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0);
  assert.ok(stats.peak > 0.3 && stats.peak <= 0.900001);
  assert.ok(stats.rms > 0.005);
  assert.ok(Math.abs(stats.dc) < 0.002);
  assert.ok(stats.earlyRms > stats.lateRms * 2);
  assert.equal(a.channels[0][0], 0);
  assert.equal(a.channels[0].at(-1), 0);
});

test("propagation uses world meters and Euclidean distance / 343", () => {
  const p = propagation([0, 0, 343], [0, 0, 0]);
  assert.equal(p.distance, 343);
  assert.equal(p.delay, 1);
  assert.equal(p.pan, 0);
  assert.ok(propagation([100, 0, 343], [0, 0, 0]).pan > 0);
  assert.ok(propagation([0, 0, 686], [0, 0, 0]).gain < p.gain);
  assert.ok(propagation([0, 0, 686], [0, 0, 0]).lowpassHz < p.lowpassHz);
  assert.throws(() => propagation([NaN, 0, 0], [0, 0, 0]), /position|finite/i);
});

for (const signature of Object.keys(SIGNATURES)) {
  test(`${signature}: exact duration, finite bounded PCM and zero edges at both rates`, () => {
    for (const sampleRate of [24000, 48000]) {
      const pcm = synthesize(signature, { sampleRate, seed: 2718 });
      const stats = analyzePCM(pcm);
      assert.equal(stats.duration, SIGNATURES[signature].duration);
      assert.equal(stats.nonFinite, 0);
      assert.equal(stats.clipped, 0);
      assert.ok(stats.peak <= SIGNATURES[signature].peak + 1e-6);
      assert.ok(stats.rms > 0.003, "non-silent signal");
      assert.ok(Math.abs(stats.dc) < 0.002, "negligible DC");
      for (const c of pcm.channels) {
        assert.equal(c[0], 0);
        assert.equal(c.at(-1), 0);
      }
    }
  });
}

function rms(array) {
  return Math.sqrt(array.reduce((n, x) => n + x * x, 0) / array.length);
}

test("burst is a short attack, substantial bass body, faint air, and a diffuse stereo tail", () => {
  const settings = { sampleRate: 24000, seed: 314 };
  const get = (layer) => synthesize("burst", { ...settings, layers: [layer] });
  const body = get("body"),
    transient = get("transient"),
    air = get("air"),
    tail = get("tail");
  assert.ok(
    rms(transient.channels[0].subarray(0, 480)) >
      rms(transient.channels[0].subarray(4800, 9600)) * 10,
  );
  assert.ok(rms(body.channels[0].subarray(0, 7200)) > 0.08);
  assert.ok(analyzePCM(air).rms < analyzePCM(body).rms * 0.2);
  assert.ok(tail.channels[0].subarray(0, 1000).every((x) => x === 0));
  assert.ok(rms(tail.channels[0].subarray(7200, 36000)) > 0.001);
  assert.notDeepEqual(tail.channels[0], tail.channels[1]);
  assert.ok(analyzePCM(tail).earlyRms > analyzePCM(tail).lateRms * 3);
});

test("salute has a brighter transient than ordinary burst; no automatic whistle", () => {
  const a = analyzePCM(
    synthesize("salute", { sampleRate: 48000, layers: ["transient"] }),
  );
  const b = analyzePCM(
    synthesize("burst", { sampleRate: 48000, layers: ["transient"] }),
  );
  assert.ok(a.brightness > b.brightness);
  for (const [signature, settings] of Object.entries(SIGNATURES))
    assert.equal(settings.layers.includes("whistle"), signature === "whistle");
  assert.equal(
    signatureForEvent({ kind: "burst", effectId: "white-salute" }),
    "salute",
  );
  assert.equal(
    signatureForEvent({ kind: "launch", effectId: "salute" }),
    "launch",
  );
  assert.equal(
    signatureForEvent({ kind: "comet", effectId: "roman-candle" }),
    "launch",
  );
  assert.equal(
    signatureForEvent({ kind: "launch", effectId: "bees" }),
    "launch",
  );
  assert.equal(
    signatureForEvent({ kind: "whistle", effectId: "bees" }),
    "whistle",
  );
  assert.equal(signatureForEvent({ kind: "not-a-sound" }), null);
});

test("crackle consists of many irregular short grains, separate from the core burst", () => {
  const pcm = synthesize("crackle", { seed: 1009, sampleRate: 24000 });
  const times = pcm.markers.grains;
  assert.ok(times.length > 70 && times.length < 260);
  assert.ok(times[0] > 0.012 && times.at(-1) < 2.4);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  assert.ok(Math.max(...gaps) > Math.min(...gaps) * 5);
  assert.equal(
    synthesize("burst", { sampleRate: 24000 }).markers.grains.length,
    0,
  );
});

test("signature waveforms are distinct; changed seeds vary noise but preserve timing", () => {
  const pcms = Object.keys(SIGNATURES).map((s) =>
    synthesize(s, { seed: 1009, sampleRate: 24000 }),
  );
  for (let a = 0; a < pcms.length; a++)
    for (let b = a + 1; b < pcms.length; b++) {
      const x = pcms[a].channels[0],
        y = pcms[b].channels[0];
      let xy = 0,
        xx = 0,
        yy = 0;
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        xy += x[i] * y[i];
        xx += x[i] ** 2;
        yy += y[i] ** 2;
      }
      assert.ok(
        Math.abs(xy / Math.sqrt(xx * yy)) < 0.94,
        `${pcms[a].signature} vs ${pcms[b].signature}`,
      );
    }
  const changed = synthesize("burst", { seed: 1010, sampleRate: 24000 });
  assert.notDeepEqual(changed.channels, pcms[1].channels);
  assert.equal(changed.duration, pcms[1].duration);
});

test("WAV encoding writes a real PCM header and rejects bad inputs", () => {
  const pcm = synthesize("launch", { sampleRate: 24000 });
  const wav = encodeWav(pcm),
    view = new DataView(wav.buffer);
  const magic = (offset) =>
    String.fromCharCode(...wav.slice(offset, offset + 4));
  assert.equal(magic(0), "RIFF");
  assert.equal(magic(8), "WAVE");
  assert.equal(magic(36), "data");
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(wav.length, 44 + pcm.channels[0].length * 4);
  assert.throws(
    () => encodeWav({ channels: [new Float32Array([1.1])], sampleRate: 24000 }),
    /unclipped/,
  );
  assert.throws(
    () => encodeWav({ channels: [new Float32Array([NaN])], sampleRate: 24000 }),
    /finite/,
  );
  assert.throws(() => synthesize("unknown"), /Unknown/);
  assert.throws(() => synthesize("burst", { sampleRate: 1 }), /sampleRate/);
  assert.throws(() => synthesize("burst", { seed: NaN }), /seed/);
  assert.throws(() => synthesize("burst", { layers: ["whistle"] }), /layer/);
});
