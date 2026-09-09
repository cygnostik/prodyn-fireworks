import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FireworkSimulation, PALETTES } from "../src/engine/simulation.js";
import { resolveLook } from "../src/engine/colours.js";
import { ParticleRenderer } from "../src/engine/particles.js";
const advance = (s, t) => {
  for (let i = 0; i < Math.round(t * 120); i++) s.update(1 / 120);
};
const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-5);
const colour = (p, i) => [p.r[i], p.g[i], p.b[i]];
const trail = (p, i) => [p.trailR[i], p.trailG[i], p.trailB[i]];

test("automatic looks are per effect, explicit variation is repeatable, and clear resets counters", () => {
  const s = new FireworkSimulation();
  for (const [effectId, variation] of [
    ["peony", 0],
    ["willow", 0],
    ["peony", 1],
  ]) {
    s.launch({ effectId, seed: 17 });
    assert.equal(s.lastLaunch.variation, variation);
    assert.deepEqual(
      s.lastLaunch.colors,
      resolveLook(effectId, "signature", variation).colors,
    );
  }
  for (let i = 0; i < 2; i++) {
    s.launch({ effectId: "peony", variation: 4, seed: 17 });
    assert.deepEqual(
      s.lastLaunch.colors,
      resolveLook("peony", "signature", 4).colors,
    );
  }
  s.launch({ effectId: "peony", seed: 17 });
  assert.equal(s.lastLaunch.variation, 2);
  advance(s, 22);
  s.launch({ effectId: "peony", seed: 17 });
  assert.equal(
    s.lastLaunch.variation,
    3,
    "natural expiry does not repeat the first colour",
  );
  s.reset();
  s.launch({ effectId: "peony", seed: 17 });
  assert.equal(s.lastLaunch.variation, 0);
  assert.equal(s.lastLaunch.z, -125);
});

test("capacity and invalid launches cannot consume depth, variation, or lastLaunch", () => {
  const s = new FireworkSimulation();
  for (let i = 0; i < 48; i++)
    assert.ok(s.launch({ effectId: "peony", seed: i }).ok);
  const before = {
    depth: s.launchDepth,
    variation: s.lookCounters.peony,
    last: structuredClone(s.lastLaunch),
  };
  for (const effectId of ["unknown", "peony"])
    assert.equal(s.launch({ effectId }).ok, false);
  assert.equal(s.launchDepth, before.depth);
  assert.equal(s.lookCounters.peony, before.variation);
  assert.deepEqual(s.lastLaunch, before.last);
});

test("depth waits for pending branches, stars and sparks, but not residual smoke", () => {
  for (const active of ["pending", "stars", "sparks"]) {
    const s = new FireworkSimulation();
    s.launchDepth = -50;
    if (active === "pending") s.pending.push({ at: 100 });
    else s[active].add({ y: 20, life: 4 });
    s.launch({ effectId: "peony", seed: 17 });
    assert.equal(s.lastLaunch.z, -50, active);
  }
  const s = new FireworkSimulation();
  s.launchDepth = -50;
  s.smoke.add({ life: 10, y: 10 });
  s.launch({ effectId: "peony", seed: 17 });
  assert.equal(s.lastLaunch.z, -125);
});

test("canopy and branch stars retain separate metallic filaments in both batches", () => {
  for (const [effectId, variation, time] of [
    ["willow", 2, 4.6],
    ["crossette", 0, 4.4],
    ["shell-of-shells", 0, 4.6],
  ]) {
    const s = new FireworkSimulation();
    s.launch({ effectId, variation, seed: 17 });
    advance(s, time);
    assert.ok(s.stars.count > 0, effectId);
    const expected = resolveLook(effectId, "signature", variation).trailColor;
    for (let i = 0; i < s.stars.count; i++)
      assert.ok(near(trail(s.stars, i), expected), effectId);
    if (effectId === "willow")
      assert.ok(s.stars.r[0] > 0.9 && s.stars.g[0] < 0.1);
    if (effectId !== "willow")
      assert.ok(s.metrics.secondaryBursts > 0, effectId);
    const renderer = new ParticleRenderer(new THREE.Scene(), s);
    renderer.sync();
    const c = Array.from(renderer.lineColors.slice(3, 6));
    const energy = c[0] / expected[0];
    assert.ok(energy > 0);
    assert.ok(
      near(
        c,
        expected.map((x) => x * energy),
      ),
      effectId + " batched connector colour",
    );
    renderer.dispose();
  }
});

test("comet, palm and roman-candle launch plumes use selected blue and white, with fixed source depth", () => {
  for (const effectId of ["comet", "palm", "roman-candle"]) {
    const s = new FireworkSimulation();
    s.launch({ effectId, palette: "guatemala", seed: 17 });
    const z = s.lastLaunch.z;
    advance(s, 0.5);
    assert.ok(s.sparks.count > 0);
    for (let i = 0; i < s.sparks.count; i++)
      assert.ok(
        PALETTES.guatemala.some((c) => near(colour(s.sparks, i), c)),
        effectId,
      );
    for (const shell of s.shells) {
      assert.equal(shell.z, z);
      assert.equal(shell.vz, 0);
    }
  }
});

test("explicit Guatemala reaches branching crackle, crossette, and shell-of-shells stars and trails", () => {
  for (const effectId of ["crackle", "crossette", "shell-of-shells"]) {
    const s = new FireworkSimulation();
    s.launch({ effectId, palette: "guatemala", seed: 17 });
    advance(s, 4.4);
    assert.ok(s.metrics.secondaryBursts > 0);
    assert.ok(s.stars.count > 0, effectId);
    for (let i = 0; i < s.stars.count; i++) {
      assert.ok(
        PALETTES.guatemala.some((c) => near(colour(s.stars, i), c)),
        effectId,
      );
      assert.ok(
        PALETTES.guatemala.some((c) => near(trail(s.stars, i), c)),
        effectId,
      );
    }
    for (let i = 0; i < s.sparks.count; i++)
      assert.ok(
        PALETTES.guatemala.some((c) => near(colour(s.sparks, i), c)),
        effectId,
      );
  }
});
