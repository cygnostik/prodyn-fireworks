import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinale,
  validateShow,
  encodeShow,
  decodeShow,
  createLayer,
  MAX_LAYERS,
} from "../src/show.js";
import { EFFECTS, GROUPS } from "../src/data/catalog.js";

test("a stacked finale overlaps layers, remains deterministic and finishes cleanly", () => {
  const layers = [
    createLayer("willow", "gold"),
    createLayer("peony", "ruby"),
    createLayer("crackle", "silver"),
  ];
  const cues = buildFinale(layers, { duration: 20, seed: 44 });
  assert.ok(cues.length > layers.length);
  assert.deepEqual(cues, buildFinale(layers, { duration: 20, seed: 44 }));
  assert.deepEqual(
    new Set(cues.map((c) => c.effectId)),
    new Set(layers.map((l) => l.effectId)),
  );
  for (const c of cues) {
    assert.ok(c.at >= 0 && c.at <= 20);
    assert.ok(Math.abs(c.position) <= 1);
  }
  const ranges = layers.map((l) =>
    cues.filter((c) => c.layerId === l.id).map((c) => c.at),
  );
  assert.ok(
    Math.max(...ranges[0]) > Math.min(...ranges[2]),
    "layers must overlap rather than play sequentially",
  );
  assert.ok(cues.every((c, i) => i === 0 || c.at >= cues[i - 1].at));
});

test("show sharing preserves a duplicate stack and rejects untrusted shape", () => {
  const show = validateShow({
    version: 1,
    title: "A night on the water",
    duration: 25,
    layers: [createLayer("peony", "ruby"), createLayer("peony", "jade")],
  });
  assert.deepEqual(decodeShow(encodeShow(show)), show);
  assert.equal(show.layers.length, 2);
  assert.throws(() =>
    validateShow({
      ...show,
      layers: [{ effectId: "<script>", palette: "gold" }],
    }),
  );
  assert.throws(() =>
    validateShow({
      ...show,
      layers: Array(MAX_LAYERS + 1).fill(show.layers[0]),
    }),
  );
  assert.throws(() => decodeShow("!not-json"));
  assert.throws(() => validateShow({ ...show, duration: Infinity }));
});

test("catalog is unique, complete, and each type belongs to one pictogram bank", () => {
  assert.equal(EFFECTS.length, 40);
  assert.equal(GROUPS.length, 6);
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length);
  assert.ok(
    EFFECTS.every(
      (e) =>
        GROUPS.some((g) => g.id === e.group) &&
        e.name &&
        e.description &&
        e.icon,
    ),
  );
  assert.equal(
    GROUPS.reduce(
      (n, g) => n + EFFECTS.filter((e) => e.group === g.id).length,
      0,
    ),
    EFFECTS.length,
  );
});
