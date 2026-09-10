// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { FireworksAudio } from "../src/audio/audio.js";
import { signatureForEvent, propagation } from "../src/audio/synthesis.js";
import { FireworkSimulation } from "../src/engine/simulation.js";
import { synthesizeSizzle } from "../src/audio/sizzle.js";

class Param {
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
}
class Node {
  constructor() {
    for (const key of [
      "gain",
      "frequency",
      "Q",
      "pan",
      "playbackRate",
      "threshold",
      "knee",
      "ratio",
      "attack",
      "release",
    ])
      this[key] = new Param(1);
    this.connected = [];
    this.loop = false;
  }
  connect(node) {
    this.connected.push(node);
    return node;
  }
  disconnect() {
    this.connected.length = 0;
  }
  start(when) {
    this.when = when;
  }
  stop(when) {
    this.stopped = true;
    this.stopAt = when;
  }
}
class Context {
  constructor() {
    this.state = "suspended";
    this.currentTime = 10;
    this.sampleRate = 48000;
    this.destination = new Node();
    this.sources = [];
  }
  createGain() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createStereoPanner() {
    return new Node();
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createWaveShaper() {
    return new Node();
  }
  createBufferSource() {
    const node = new Node();
    this.sources.push(node);
    return node;
  }
  createBuffer(numberOfChannels, length, sampleRate) {
    const channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
    return {
      length,
      sampleRate,
      numberOfChannels,
      duration: length / sampleRate,
      getChannelData: (i) => channels[i],
      copyToChannel: (a, i) => channels[i].set(a),
    };
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
}
globalThis.AudioContext = Context;
const cue = (kind, effectId, time = 0, extra = {}) => ({
  kind,
  effectId,
  time,
  power: 1,
  position: [0, 3, -125],
  ...extra,
});

function trace(effectId) {
  const events = [];
  const simulation = new FireworkSimulation({
    onEvent: (event) => events.push(event),
    density: 0.25,
  });
  simulation.launch({ effectId, seed: 7349 });
  for (let i = 0; i < 1200; i++) simulation.update(1 / 120);
  return events;
}

test("actual crossette core and later split remain different cues; Roman launches select lift", () => {
  const cross = trace("crossette");
  const core = cross.find((e) => e.kind === "burst");
  const secondary = cross.filter((e) => e.kind === "crackle");
  assert.ok(core && secondary.length > 0);
  assert.ok(secondary.every((e) => e.time > core.time));
  assert.equal(signatureForEvent(core), "burst");
  assert.ok(secondary.every((e) => signatureForEvent(e) === "crackle"));
  const roman = trace("roman-candle").filter((e) => e.kind === "comet");
  assert.equal(roman.length, 7);
  assert.ok(
    roman.every((e) => signatureForEvent(e) === "launch"),
    "Roman's existing comet events must use the selected lift, not the ordinary comet timbre",
  );
  assert.equal(signatureForEvent(cue("comet", "comet")), "comet");
  assert.equal(signatureForEvent(cue("burst", "salute")), "salute");
  assert.equal(signatureForEvent(cue("whistle", "bees")), "whistle");
});

for (const [effectId, duration] of [
  ["fountain", 6.5],
  ["waterfall", 6],
]) {
  test(`${effectId}: actual renewal does not restart or loop the full-duration sizzle`, async () => {
    const events = trace(effectId);
    assert.equal(events.length, 2);
    assert.equal(events[0].time, 0);
    assert.ok(events[1].time >= 3.25 && events[1].time < 3.27);
    const audio = new FireworksAudio();
    await audio.enable();
    const context = audio._context;
    audio.setListener([0, 0, 0]);
    const first = audio.emit(events[0]);
    const source = context.sources[0];
    assert.equal(first.delay, propagation(events[0].position, [0, 0, 0]).delay);
    assert.equal(first.when, 10 + first.delay);
    assert.equal(
      source.buffer.duration,
      duration,
      "one finite texture must cover the emitter, not replay the old 3.6-second attack",
    );
    assert.equal(
      source.playbackRate.value,
      1,
      "pitch jitter must not move the emitter end",
    );
    assert.equal(source.loop, false);
    context.currentTime += events[1].time;
    audio.emit(events[1]);
    assert.equal(
      context.sources.length,
      1,
      "3.25s renewal must not retrigger an attack",
    );
    assert.equal(audio.getStats().activeVoices, 1);
    const a = source.buffer.getChannelData(0).slice();
    audio.stop();
    context.currentTime += 10;
    audio.emit({ ...events[0], time: 20 });
    assert.notDeepEqual(
      context.sources.at(-1).buffer.getChannelData(0),
      a,
      "independent effects need new noise, not one cached pattern",
    );
    await audio.dispose();
    assert.ok(context.sources.every((s) => s.stopped));
  });
}

test("emitter identity separates overlapping sources and age bounds a missed initial cue", async () => {
  const audio = new FireworksAudio();
  await audio.enable();
  const event = cue("fountain", "waterfall", 0, {
    emitterId: 1,
    emitterAge: 0,
    emitterDuration: 6,
  });
  const first = audio.emit(event);
  const second = audio.emit({ ...event, emitterId: 2 });
  assert.notEqual(first.id, second.id);
  audio._context.currentTime += 3.25;
  const renew = audio.emit({ ...event, time: 3.25, emitterAge: 3.25 });
  assert.equal(renew.id, first.id);
  assert.equal(renew.continued, true);
  assert.equal(audio.getStats().activeVoices, 2);
  audio.stop();
  const remainder = audio.emit({ ...event, time: 3.25, emitterAge: 3.25 });
  assert.equal(remainder.endsAt - remainder.when, 2.75);
  assert.equal(audio.emit({ ...event, emitterId: 3, emitterAge: 6 }), false);
  assert.equal(
    audio.emit({ ...event, emitterId: 3, emitterDuration: 1e9 }),
    false,
  );
  await audio.dispose();
});

test("continuous PCM resources have their own cap and release on natural end, stop and mute", async () => {
  const audio = new FireworksAudio();
  await audio.enable();
  for (let i = 0; i < 30; i++)
    audio.emit(
      cue("fountain", "fountain", i, {
        emitterId: i,
        emitterAge: 0,
        emitterDuration: 6.5,
      }),
    );
  const stats = audio.getStats();
  assert.equal(stats.continuousVoices, 8);
  assert.equal(stats.maxContinuousVoices, 8);
  assert.equal(stats.continuousBytes, 8 * 6.5 * 48000 * 4);
  assert.equal(
    stats.cachedBuffers,
    0,
    "continuous random beds must not accumulate in the cache",
  );
  assert.ok(stats.activeVoices <= stats.maxVoices);
  const last = audio._context.sources.at(-1);
  last.onended();
  assert.equal(audio.getStats().continuousVoices, 7);
  assert.equal(last.buffer, null);
  audio.setEnabled(false);
  assert.equal(audio.getStats().continuousBytes, 0);
  assert.equal(audio._continuous.size, 0);
  assert.equal(audio._voices.size, 0);
  await audio.dispose();
});

test("both sizzles suppress old metronomic envelope lines and remain quiet finite varied PCM", () => {
  const rms = (values) =>
    Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0) / values.length,
    );
  for (const effectId of ["fountain", "waterfall"]) {
    for (const seed of [7349, 83, 145]) {
      const pcm = synthesizeSizzle(effectId, { seed });
      const channel = pcm.channels[0],
        envelope = [];
      assert.equal(channel[0], 0);
      assert.equal(channel.at(-1), 0);
      assert.ok(
        channel.every(
          (value) => Number.isFinite(value) && Math.abs(value) < 0.23,
        ),
      );
      assert.ok(rms(channel) > 0.035 && rms(channel) < 0.075);
      for (let at = 16800; at + 480 < channel.length - 16800; at += 480)
        envelope.push(rms(channel.subarray(at, at + 480)));
      const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
      for (const radians of [13.3, 39.1]) {
        let sin = 0,
          cos = 0;
        envelope.forEach((value, i) => {
          sin += (value - mean) * Math.sin(i * 0.01 * radians);
          cos += (value - mean) * Math.cos(i * 0.01 * radians);
        });
        assert.ok(
          (2 * Math.hypot(sin, cos)) / envelope.length / mean < 0.035,
          `${effectId}: no old flutter line`,
        );
      }
      assert.ok(
        Math.max(...envelope) / Math.min(...envelope) < 1.5,
        "no repeated attack/dip cycle within the bed",
      );
      const other = synthesizeSizzle(effectId, { seed: seed + 1 });
      let xy = 0,
        xx = 0,
        yy = 0;
      for (let i = 0; i < channel.length; i++) {
        xy += channel[i] * other.channels[0][i];
        xx += channel[i] ** 2;
        yy += other.channels[0][i] ** 2;
      }
      assert.ok(
        Math.abs(xy / Math.sqrt(xx * yy)) < 0.02,
        "independent burns must not repeat waveform samples",
      );
    }
  }
});

test("only the approved three signatures choose local recordings without changing delay", async () => {
  const audio = new FireworksAudio();
  await audio.enable();
  // Inject distinguishable decoded buffers here. Real MP3 decoding is a browser test.
  for (const [signature, file] of [
    ["launch", "lift1.mp3"],
    ["burst", "burst1.mp3"],
    ["crackle", "crackle-sm-1.mp3"],
  ]) {
    const buffer = audio._context.createBuffer(1, 48, 48000);
    buffer.fixture = file;
    audio._samples?.buffers.set(signature, buffer);
  }
  for (const [kind, effectId, expected] of [
    ["launch", "peony", "lift1.mp3"],
    ["comet", "roman-candle", "lift1.mp3"],
    ["burst", "crossette", "burst1.mp3"],
    ["crackle", "crossette", "crackle-sm-1.mp3"],
    ["crackle", "crackle", "crackle-sm-1.mp3"],
    ["burst", "salute", null],
    ["comet", "comet", null],
    ["whistle", "bees", null],
  ]) {
    audio.stop();
    const event = cue(kind, effectId);
    const schedule = audio.emit(event);
    assert.equal(
      schedule.when,
      audio._context.currentTime + propagation(event.position).delay,
    );
    assert.equal(schedule.sample, expected);
    if (expected)
      assert.equal(audio._context.sources.at(-1).buffer.fixture, expected);
  }
  await audio.dispose();
});
