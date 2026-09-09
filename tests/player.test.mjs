import test from "node:test";
import assert from "node:assert/strict";
import {
  ShowPlayer,
  createLayer,
  readSaved,
  saveShow,
  validateShow,
  buildFinale,
} from "../src/show.js";

test("the player dispatches every cue once, then becomes idle", () => {
  const fired = [];
  let finished = 0;
  const player = new ShowPlayer(
    (c) => fired.push(c),
    () => finished++,
  );
  const layers = [
    createLayer("fountain", "gold"),
    createLayer("shell-of-shells", "multicolor"),
  ];
  const count = player.start(layers, { duration: 12, seed: 3 });
  for (let i = 0; i < 720; i++) player.update(1 / 30);
  assert.equal(fired.length, count);
  assert.equal(finished, 1);
  assert.equal(player.running, false);
  player.update(100);
  assert.equal(fired.length, count);
  player.stop();
  assert.equal(player.progress, 0);
});

test("cancelling a show leaves no pending launch dispatches", () => {
  const fired = [];
  const player = new ShowPlayer((c) => fired.push(c));
  player.start([createLayer("peony")], { duration: 12 });
  player.update(2);
  player.stop();
  const count = fired.length;
  player.update(100);
  assert.equal(fired.length, count);
});

test("browser storage denial is handled without losing the in-memory show", () => {
  const storage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  const show = {
    version: 1,
    title: "Mine",
    duration: 22,
    layers: [createLayer("willow")],
  };
  assert.equal(readSaved(storage).show, null);
  assert.ok(readSaved(storage).error);
  assert.equal(saveShow(storage, show), false);
  assert.equal(show.layers.length, 1);
});

test("untrusted inheritance, duplicate IDs and extreme densities are rejected", () => {
  const base = {
    version: 1,
    title: "",
    duration: 22,
    layers: [createLayer("peony")],
  };
  assert.throws(() =>
    validateShow({
      ...base,
      layers: [{ ...base.layers[0], effectId: "constructor" }],
    }),
  );
  assert.throws(() =>
    validateShow({ ...base, layers: [base.layers[0], base.layers[0]] }),
  );
  assert.throws(() =>
    validateShow({ ...base, layers: [{ ...base.layers[0], density: 99 }] }),
  );
  assert.deepEqual(buildFinale([], { duration: 22 }), []);
});
