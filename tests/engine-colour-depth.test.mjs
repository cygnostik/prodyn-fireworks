import test from "node:test";
import assert from "node:assert/strict";
import { FireworkSimulation, PALETTES } from "../src/engine/simulation.js";
import { PALETTES as controls } from "../src/data/catalog.js";
import {
  buildFinale,
  createLayer,
  encodeShow,
  decodeShow,
} from "../src/show.js";
const advance = (s, t) => {
  for (let i = 0; i < Math.round(t * 120); i++) s.update(1 / 120);
};
const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-5);
const colors = (p) =>
  Array.from({ length: p.count }, (_, i) => [p.r[i], p.g[i], p.b[i]]);

test("Guatemala is selectable, shareable, and renders blue and white stars", () => {
  assert.ok(controls.some((p) => p.id === "guatemala"));
  assert.ok(PALETTES.guatemala);
  const show = {
    version: 1,
    title: "Guatemala",
    duration: 20,
    layers: [createLayer("peony", "guatemala")],
  };
  assert.equal(decodeShow(encodeShow(show)).layers[0].palette, "guatemala");
  const s = new FireworkSimulation();
  s.launch({ effectId: "peony", palette: "guatemala", seed: 17 });
  advance(s, 3.5);
  const found = colors(s.stars);
  assert.ok(found.length > 100);
  assert.ok(found.every((c) => PALETTES.guatemala.some((v) => close(c, v))));
  assert.ok(found.some((c) => c[2] > c[0] * 2));
  assert.ok(found.some((c) => Math.min(...c) > 0.9));
});

test("smiley always has a yellow ring, two blue eye circles and a red mouth", () => {
  const s = new FireworkSimulation({ density: 0.52 });
  s.launch({ effectId: "smiley", palette: "violet", seed: 17 });
  advance(s, 4);
  const p = s.stars,
    parts = new Map();
  for (let i = 0; i < p.count; i++) {
    const a = parts.get(p.layer[i]) || [];
    a.push(i);
    parts.set(p.layer[i], a);
  }
  assert.deepEqual([...parts.keys()].sort(), [0, 1, 2, 3]);
  for (const i of parts.get(0))
    assert.ok(p.r[i] > 0.9 && p.g[i] > 0.7 && p.b[i] < 0.04);
  for (const k of [1, 2]) {
    const eye = parts.get(k);
    assert.ok(eye.length >= 16);
    for (const i of eye)
      assert.ok(p.b[i] > 0.9 && p.r[i] < 0.1 && p.g[i] < 0.25);
    const cx = eye.reduce((n, i) => n + p.x[i], 0) / eye.length,
      cy = eye.reduce((n, i) => n + p.y[i], 0) / eye.length;
    const radii = eye.map((i) => Math.hypot(p.x[i] - cx, p.y[i] - cy));
    assert.ok(
      Math.min(...radii) > Math.max(...radii) * 0.65,
      "eyes have open circular centres, not filled dots",
    );
  }
  for (const i of parts.get(3))
    assert.ok(p.r[i] > 0.9 && p.g[i] < 0.06 && p.b[i] < 0.06);
});

test("successive signature shots vary common colours while canopy trails remain metallic", () => {
  for (const effectId of [
    "peony",
    "chrysanthemum",
    "willow",
    "nishiki",
    "palm",
    "fountain",
  ]) {
    const s = new FireworkSimulation(),
      looks = [];
    for (let i = 0; i < 5; i++) {
      s.launch({ effectId, palette: "signature", seed: 17 });
      const shot = (effectId === "fountain" ? s.emitters : s.shells).at(-1);
      looks.push(JSON.stringify([shot.colors, shot.trailColor]));
      if (["willow", "nishiki"].includes(effectId)) {
        assert.ok(shot.trailColor[0] > 0.9);
        assert.ok(shot.trailColor[1] > 0.35);
      }
    }
    assert.ok(new Set(looks).size >= 3, effectId);
  }
  const cues = buildFinale([createLayer("peony")], { seed: 42 });
  assert.ok(cues.every((c) => c.palette === "signature"));
  assert.ok(new Set(cues.map((c) => c.variation)).size > 2);
});

test("explicit blue/white colours reach canopies, nested cores, transitions and fountains", () => {
  for (const effectId of [
    "willow",
    "brocade",
    "kamuro",
    "nishiki",
    "palm",
    "diadem",
    "multi-pistil",
    "ghost",
    "color-change",
    "crackle",
    "fountain",
  ]) {
    const s = new FireworkSimulation();
    s.launch({ effectId, palette: "guatemala", seed: 17 });
    advance(s, effectId === "fountain" ? 1 : 3.4);
    assert.ok(s.stars.count > 0, effectId);
    assert.ok(
      colors(s.stars).every((c) =>
        PALETTES.guatemala?.some((v) => close(c, v)),
      ),
      effectId,
    );
    if (["ghost", "color-change"].includes(effectId))
      for (let i = 0; i < s.stars.count; i++)
        assert.ok(
          PALETTES.guatemala.some((v) =>
            close([s.stars.r2[i], s.stars.g2[i], s.stars.b2[i]], v),
          ),
          effectId + " transition",
        );
  }
});

test("new launches advance from distant to nearer, never wrap behind an occupied sky", () => {
  const s = new FireworkSimulation(),
    depths = [];
  for (let i = 0; i < 40; i++) {
    assert.ok(s.launch({ effectId: "peony", seed: i * 53 }).ok);
    depths.push(s.shells.at(-1).z);
    assert.equal(s.shells.at(-1).vz, 0);
  }
  assert.ok(depths[0] < -100);
  assert.ok(depths.every((z, i) => z <= 20 && (i === 0 || z > depths[i - 1])));
  const before = s.launchDepth;
  s.launch({ effectId: "unknown" });
  assert.equal(s.launchDepth, before);
  advance(s, 20);
  s.launch({ effectId: "peony", seed: 2 });
  assert.equal(
    s.shells.at(-1).z,
    depths[0],
    "empty sky starts a new depth progression",
  );
  s.reset();
  s.launch({ effectId: "peony", seed: 2 });
  assert.equal(s.shells[0].z, depths[0]);
});

test("the normalized firing area allows wider lateral placement", () => {
  const s = new FireworkSimulation();
  s.launch({ effectId: "peony", position: -1, seed: 1 });
  s.launch({ effectId: "peony", position: 1, seed: 2 });
  assert.ok(s.shells[0].x <= -210 && s.shells[1].x >= 210);
  assert.equal(s.shells[0].lastX, s.shells[0].x);
  assert.equal(s.shells[1].lastX, s.shells[1].x);
});
