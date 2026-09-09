import test from "node:test";
import assert from "node:assert/strict";
import {
  FireworkSimulation,
  EFFECT_IDS,
  ParticlePool,
} from "../src/engine/simulation.js";

const advance = (sim, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.update(1 / 60);
};

test("a shell climbs before bursting; events are at the visual source time", () => {
  const events = [],
    sim = new FireworkSimulation({ onEvent: (e) => events.push(e) });
  const result = sim.launch({ effectId: "chrysanthemum", seed: 81 });
  assert.equal(result.ok, true);
  assert.equal(events[0].kind, "launch");
  assert.equal(events[0].time, 0);
  assert.ok(events[0].position[1] < 10);
  advance(sim, 1);
  assert.equal(events.filter((e) => e.kind === "burst").length, 0);
  assert.ok(sim.shells[0].y > 40);
  advance(sim, 4);
  assert.equal(events.filter((e) => e.kind === "burst").length, 1);
  const burst = events.find((e) => e.kind === "burst");
  assert.ok(burst.position[1] > 100 && burst.time > 2);
  assert.ok(sim.stars.count > 100 && sim.sparks.count > 100);
});

test("seed and fixed steps reproduce physics and emissions", () => {
  const a = new FireworkSimulation(),
    b = new FireworkSimulation();
  for (const s of [a, b])
    s.launch({ effectId: "willow", seed: 932, position: 0.4 });
  advance(a, 6);
  for (let i = 0; i < 720; i++) b.update(1 / 120);
  assert.equal(a.stars.count, b.stars.count);
  assert.equal(a.sparks.count, b.sparks.count);
  for (const key of ["x", "y", "z", "vx", "vy", "life"]) {
    assert.deepEqual(
      a.stars[key].slice(0, a.stars.count),
      b.stars[key].slice(0, b.stars.count),
    );
  }
});

test("peony has clean stars while chrysanthemum has persistent filaments", () => {
  const a = new FireworkSimulation(),
    b = new FireworkSimulation();
  a.launch({ effectId: "peony", seed: 12 });
  b.launch({ effectId: "chrysanthemum", seed: 12 });
  advance(a, 5);
  advance(b, 5);
  assert.equal(
    a.stars.trail.slice(0, a.stars.count).some((v) => v > 0),
    false,
  );
  assert.equal(
    b.stars.trail.slice(0, b.stars.count).some((v) => v > 0),
    true,
  );
  assert.ok(b.sparks.count > a.sparks.count * 2);
});

test("all 40 named effects are finite, bounded and have their own dispatch", () => {
  assert.equal(EFFECT_IDS.length, 40);
  assert.equal(new Set(EFFECT_IDS).size, 40);
  for (const effectId of EFFECT_IDS) {
    const events = [],
      sim = new FireworkSimulation({
        onEvent: (e) => events.push(e),
        starCapacity: 1500,
        sparkCapacity: 2500,
      });
    assert.equal(sim.launch({ effectId, seed: 19 }).ok, true, effectId);
    advance(sim, 6);
    assert.ok(events.length > 0, effectId);
    for (const field of ["x", "y", "z", "vx", "vy"])
      assert.ok(
        sim.stars[field].slice(0, sim.stars.count).every(Number.isFinite),
        effectId + field,
      );
    assert.ok(sim.stars.count <= 1500 && sim.sparks.count <= 2500, effectId);
    advance(sim, 28);
    assert.equal(
      sim.shells.length +
        sim.emitters.length +
        sim.stars.count +
        sim.sparks.count,
      0,
      effectId + " expires",
    );
  }
});

test("crossettes split late and shell-of-shells emits satellite bursts", () => {
  for (const effectId of ["crossette", "shell-of-shells"]) {
    const events = [],
      sim = new FireworkSimulation({ onEvent: (e) => events.push(e) });
    sim.launch({ effectId, seed: 23 });
    advance(sim, 6);
    assert.ok(sim.metrics.secondaryBursts > 0, effectId);
    if (effectId === "shell-of-shells")
      assert.ok(events.filter((e) => e.kind === "burst").length > 3);
  }
});

test("diadem includes a short-lived compact contrasting core", () => {
  const sim = new FireworkSimulation();
  sim.launch({ effectId: "diadem", palette: "ruby", seed: 19 });
  advance(sim, 3);
  let inner = 0,
    outer = 0;
  for (let i = 0; i < sim.stars.count; i++) {
    if (sim.stars.life[i] < 1.5 && sim.stars.g[i] < 0.2) inner++;
    if (sim.stars.life[i] > 3 && sim.stars.trail[i] > 0) outer++;
  }
  assert.ok(inner >= 30, "compact contrasting diadem stars exist briefly");
  assert.ok(outer >= 100, "the surrounding metallic crown persists");
});

test("ghost color timing sweeps spatially rather than random blinking", () => {
  const sim = new FireworkSimulation();
  sim.launch({ effectId: "ghost", palette: "violet", seed: 19 });
  advance(sim, 3);
  const p = sim.stars;
  assert.ok(
    p.phase instanceof Float32Array,
    "ghost stars carry a spatial phase",
  );
  let meanX = 0,
    meanPhase = 0;
  for (let i = 0; i < p.count; i++) {
    meanX += p.x[i] / p.count;
    meanPhase += p.phase[i] / p.count;
  }
  let covariance = 0;
  for (let i = 0; i < p.count; i++)
    covariance += ((p.x[i] - meanX) * (p.phase[i] - meanPhase)) / p.count;
  assert.ok(
    covariance > 0.1,
    "left and right shell sections change at different times",
  );
});

test("researched additions are distinct registered effects, not aliases", () => {
  for (const effectId of ["multi-pistil", "horsetail", "wheel", "set-piece"]) {
    const sim = new FireworkSimulation();
    assert.equal(sim.launch({ effectId, seed: 19 }).ok, true, effectId);
  }
});

test("multi-pistil has one outer sphere plus three nested 3D cores", () => {
  const sim = new FireworkSimulation();
  sim.launch({ effectId: "multi-pistil", seed: 19 });
  advance(sim, 3.5);
  const p = sim.stars;
  assert.ok(p.layer instanceof Float32Array);
  const layers = new Map();
  for (let i = 0; i < p.count; i++) {
    const group = layers.get(p.layer[i]) || [];
    group.push([p.x[i], p.y[i], p.z[i]]);
    layers.set(p.layer[i], group);
  }
  assert.equal(layers.size, 4);
  const radii = [];
  for (let k = 0; k < 4; k++) {
    const a = layers.get(k),
      center = [0, 0, 0];
    for (const pos of a)
      for (let j = 0; j < 3; j++) center[j] += pos[j] / a.length;
    radii.push(
      a.reduce(
        (sum, pos) =>
          sum + Math.hypot(...pos.map((v, j) => v - center[j])) / a.length,
        0,
      ),
    );
    assert.ok(
      Math.max(...a.map((p) => p[2])) - Math.min(...a.map((p) => p[2])) > 1,
      "a sphere has real depth",
    );
  }
  assert.ok(
    radii.every((r, i) => i === 0 || r < radii[i - 1]),
    JSON.stringify(radii),
  );
});

test("horsetail is a narrow falling plume rather than a spherical willow", () => {
  const a = new FireworkSimulation(),
    b = new FireworkSimulation();
  a.launch({ effectId: "horsetail", seed: 19 });
  b.launch({ effectId: "willow", seed: 19 });
  advance(a, 6);
  advance(b, 6);
  const span = (p) =>
    Math.max(...p.x.slice(0, p.count)) - Math.min(...p.x.slice(0, p.count));
  assert.ok(a.stars.count > 50);
  assert.ok(span(a.stars) < span(b.stars) * 0.6);
  const q = a.sparks,
    height =
      Math.max(...q.y.slice(0, q.count)) - Math.min(...q.y.slice(0, q.count));
  assert.ok(
    height > span(q) * 1.15,
    "horsetail residue reads as an elongated cascade, not a bright round knot",
  );
});

test("wheel stays mounted while rotating; set-piece lights remain fixed in wind", () => {
  const wheel = new FireworkSimulation();
  wheel.launch({ effectId: "wheel", seed: 19, position: 0.3 });
  advance(wheel, 0.2);
  assert.equal(wheel.shells.length, 0);
  assert.equal(wheel.emitters.length, 1);
  const e = wheel.emitters[0],
    position = [e.x, e.y, e.z],
    rotation = e.rotation;
  advance(wheel, 1);
  assert.deepEqual([e.x, e.y, e.z], position);
  assert.ok(e.rotation !== rotation);
  assert.ok(wheel.stars.count > 10);
  const fixed = new FireworkSimulation();
  fixed.wind = 10;
  fixed.launch({ effectId: "set-piece", seed: 12 });
  advance(fixed, 0.2);
  assert.ok(fixed.stars.count >= 50);
  const p = fixed.stars;
  const before = ["x", "y", "z"].map((k) => p[k].slice(0, p.count));
  advance(fixed, 1);
  for (let i = 0; i < 3; i++)
    assert.deepEqual(p[["x", "y", "z"][i]].slice(0, p.count), before[i]);
});

test("pool saturation rejects extra storage; reset clears pending effects and time", () => {
  const p = new ParticlePool(2, ["x", "y"]);
  assert.equal(p.add({ x: 1 }), 0);
  assert.equal(p.add({ x: 2 }), 1);
  assert.equal(p.add({ x: 3 }), -1);
  p.remove(0);
  assert.equal(p.count, 1);
  assert.equal(p.x[0], 2);
  const sim = new FireworkSimulation();
  sim.launch({ effectId: "roman-candle", seed: 19 });
  advance(sim, 1);
  sim.reset();
  assert.equal(sim.time, 0);
  assert.equal(sim.stars.count, 0);
  assert.equal(sim.sparks.count, 0);
  assert.equal(sim.shells.length + sim.emitters.length + sim.pending.length, 0);
  advance(sim, 10);
  assert.equal(sim.stars.count, 0);
});

test("unknown effects fail explicitly; malformed time never poisons the simulation", () => {
  const sim = new FireworkSimulation();
  assert.deepEqual(sim.launch({ effectId: "not-real", seed: 2 }), {
    ok: false,
    reason: "unknown-effect",
    effectId: "not-real",
  });
  for (const dt of [-1, NaN, Infinity, 0]) sim.update(dt);
  assert.equal(sim.time, 0);
  sim.update(10);
  assert.ok(sim.time <= 0.101);
  const r = sim.launch({ effectId: "peony", seed: 1, position: 4, scale: 100 });
  assert.equal(r.position, 1);
  assert.equal(r.scale, 1.6);
});
