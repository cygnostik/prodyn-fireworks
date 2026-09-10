// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { FireworksAudio } from "../src/audio/audio.js";

class Param {
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v) {
    this.value = v;
  }
  setTargetAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class Node {
  constructor() {
    this.gain = new Param(1);
    this.frequency = new Param(350);
    this.Q = new Param(1);
    this.pan = new Param();
    this.playbackRate = new Param(1);
    for (const key of ["threshold", "knee", "ratio", "attack", "release"])
      this[key] = new Param();
    this.connected = [];
    this.stopped = false;
  }
  connect(n) {
    this.connected.push(n);
    return n;
  }
  disconnect() {
    this.connected.length = 0;
  }
  start(time) {
    this.startedAt = time;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeContext {
  static instances = [];
  constructor() {
    this.state = "suspended";
    this.currentTime = 10;
    this.sampleRate = 48000;
    this.destination = new Node();
    this.sources = [];
    FakeContext.instances.push(this);
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
  createBuffer(channels, length, sampleRate) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return {
      duration: length / sampleRate,
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: (c) => data[c],
      copyToChannel: (a, c) => data[c].set(a),
    };
  }
  createBufferSource() {
    const n = new Node();
    this.sources.push(n);
    return n;
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

function event(kind = "burst", extra = {}) {
  return {
    kind,
    effectId: "peony",
    position: [0, 0, 343],
    power: 1,
    time: 987,
    ...extra,
  };
}

// Globals are confined to this Node test process, not the application.
globalThis.AudioContext = FakeContext;

test("silent construction, explicit opt-in, exact audio-clock distance delay", async () => {
  const before = FakeContext.instances.length;
  const engine = new FireworksAudio();
  assert.equal(FakeContext.instances.length, before);
  assert.equal(engine.emit(event()), false);
  engine.setEnabled(true);
  assert.equal(
    FakeContext.instances.length,
    before,
    "setEnabled cannot open audio",
  );
  assert.equal(await engine.resume(), false, "no previous gesture consent");
  assert.equal(await engine.enable(), true);
  engine.setListener([0, 0, 0]);
  const voice = engine.emit(event());
  assert.equal(voice.when, 11);
  assert.equal(voice.delay, 1);
  assert.equal(voice.signature, "burst");
  assert.equal(FakeContext.instances.at(-1).sources.at(-1).startedAt, 11);
  engine.stop();
  assert.equal(engine.getStats().activeVoices, 0);
  assert.equal(FakeContext.instances.at(-1).sources.at(-1).stopped, true);
  await engine.dispose();
});

test("bounded finale, cached buffers, natural endings, and cancel all future voices", async () => {
  const engine = new FireworksAudio();
  await engine.enable();
  for (let i = 0; i < 75; i++)
    engine.emit(
      event("burst", { time: i, effectId: i % 2 ? "salute" : "peony" }),
    );
  let stats = engine.getStats();
  assert.equal(stats.activeVoices, stats.maxVoices);
  assert.equal(stats.highWaterVoices, stats.maxVoices);
  assert.ok(stats.stolen > 0 || stats.dropped > 0);
  assert.equal(stats.cachedBuffers, 2);
  const context = FakeContext.instances.at(-1);
  const live = context.sources.filter((s) => !s.stopped);
  assert.equal(live.length, stats.maxVoices);
  live.at(-1).onended();
  assert.equal(engine.getStats().activeVoices, stats.maxVoices - 1);
  engine.stop();
  assert.equal(engine.getStats().activeVoices, 0);
  assert.ok(live.slice(0, -1).every((s) => s.stopped));
  await engine.dispose();
  assert.equal(engine.getStats().cachedBuffers, 0);
  assert.equal(engine.getStats().contextState, "closed");
  assert.equal(await engine.enable(), false);
});

test("per-frame launch/fountain/whistle events do not flood voices", async () => {
  const engine = new FireworksAudio();
  await engine.enable();
  for (const kind of ["launch", "fountain", "whistle"]) {
    const before = engine.getStats().emitted;
    for (let i = 0; i < 120; i++) engine.emit(event(kind, { time: i / 60 }));
    assert.equal(engine.getStats().emitted - before, 1);
  }
  assert.ok(engine.getStats().throttled > 300);
  await engine.dispose();
});

test("mute, suspension, disposal and invalid inputs cannot create surprise sound", async () => {
  const engine = new FireworksAudio({ enabled: true });
  assert.equal(await engine.resume(), false);
  await engine.enable();
  assert.equal(engine.setListener([NaN, 0, 0]), false);
  assert.equal(engine.setVolume(NaN), false);
  assert.equal(engine.setVolume(3), 1);
  assert.equal(
    engine.emit(event("burst", { position: [Infinity, 0, 0] })),
    false,
  );
  assert.equal(engine.emit(event("burst", { time: NaN })), false);
  assert.equal(engine.emit(event("burst", { position: [0, 0, 1e9] })), false);
  assert.equal(engine.emit(event("invalid")), false);
  await engine.suspend();
  assert.equal(engine.emit(event()), false);
  assert.equal(engine.getStats().activeVoices, 0);
  assert.equal(
    await engine.resume(),
    true,
    "explicit resume allowed after prior opt-in",
  );
  engine.setEnabled(false);
  assert.equal(
    await engine.resume(),
    false,
    "explicit mute is not undone by resume",
  );
  engine.setEnabled(true);
  assert.equal(engine.emit(event()), false, "setter alone does not re-enable");
  assert.equal(await engine.enable(), true);
  engine.setVolume(0);
  assert.equal(engine.emit(event()), false);
  await engine.dispose();
  await engine.dispose();
});

test("mute while enable is awaiting browser resume wins over stale completion", async () => {
  const previous = FakeContext.prototype.resume;
  let finish;
  FakeContext.prototype.resume = function () {
    this.state = "running";
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  try {
    const engine = new FireworksAudio();
    const enabling = engine.enable();
    engine.setEnabled(false);
    finish();
    assert.equal(await enabling, false);
    assert.equal(engine.getStats().enabled, false);
    assert.notEqual(engine.getStats().contextState, "running");
    await engine.dispose();
  } finally {
    FakeContext.prototype.resume = previous;
  }
});

test("a new consent gesture after mute is not hijacked by the previous enable promise", async () => {
  const previous = FakeContext.prototype.resume;
  const finishes = [];
  FakeContext.prototype.resume = function () {
    this.state = "running";
    return new Promise((resolve) => finishes.push(resolve));
  };
  const engine = new FireworksAudio();
  try {
    const oldEnable = engine.enable();
    engine.setEnabled(false);
    const newEnable = engine.enable();
    assert.equal(
      finishes.length,
      2,
      "the fresh gesture must issue its own resume",
    );
    finishes[1]();
    assert.equal(await newEnable, true);
    finishes[0]();
    assert.equal(await oldEnable, false);
    assert.equal(engine.getStats().enabled, true);
    assert.equal(engine.getStats().contextState, "running");
  } finally {
    finishes.forEach((finish) => finish());
    await engine.dispose();
    FakeContext.prototype.resume = previous;
  }
});

test("an old resume completion cannot suspend a newer pending resume", async () => {
  const engine = new FireworksAudio();
  await engine.enable();
  await engine.suspend();
  const previous = FakeContext.prototype.resume;
  const finishes = [];
  FakeContext.prototype.resume = function () {
    this.state = "running";
    return new Promise((resolve) => finishes.push(resolve));
  };
  try {
    const oldResume = engine.resume();
    await engine.suspend();
    const newResume = engine.resume();
    finishes[0]();
    assert.equal(await oldResume, false);
    assert.equal(
      engine.getStats().contextState,
      "running",
      "stale result must not suspend the new in-flight continuation",
    );
    finishes[1]();
    assert.equal(await newResume, true);
    assert.equal(engine.getStats().suspended, false);
  } finally {
    finishes.forEach((finish) => finish());
    await engine.dispose();
    FakeContext.prototype.resume = previous;
  }
});

test("missing and rejected Web Audio are honest false results", async () => {
  delete globalThis.AudioContext;
  try {
    const engine = new FireworksAudio();
    assert.equal(await engine.enable(), false);
    assert.match(engine.getStats().lastError, /unavailable/);
  } finally {
    globalThis.AudioContext = FakeContext;
  }
  const previous = FakeContext.prototype.resume;
  FakeContext.prototype.resume = async function () {
    throw new Error("NotAllowedError: blocked fixture");
  };
  try {
    const engine = new FireworksAudio();
    assert.equal(await engine.enable(), false);
    assert.equal(engine.getStats().enabled, false);
    assert.match(engine.getStats().lastError, /blocked fixture/);
    await engine.dispose();
  } finally {
    FakeContext.prototype.resume = previous;
  }
});
