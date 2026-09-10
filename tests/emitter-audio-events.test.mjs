import test from "node:test";
import assert from "node:assert/strict";
import { FireworkSimulation } from "../src/engine/simulation.js";

for (const [effectId, duration] of [
  ["fountain", 6.5],
  ["waterfall", 6],
]) {
  test(`${effectId} cues carry stable identity and actual age without moving renewal`, () => {
    const events = [];
    const simulation = new FireworkSimulation({
      density: 0.2,
      onEvent: (event) => events.push(event),
    });
    const first = simulation.launch({ effectId, seed: 419 });
    const second = simulation.launch({ effectId, seed: 421 });
    assert.equal(events.length, 2);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(
      events.map((event) => event.emitterId),
      [first.id, second.id],
    );
    for (const event of events) {
      assert.equal(event.emitterAge, 0);
      assert.equal(event.emitterDuration, duration);
      assert.equal(event.time, 0);
    }
    for (let i = 0; i < 420; i++) simulation.update(1 / 120);
    assert.equal(events.length, 4);
    for (const id of [first.id, second.id]) {
      const cues = events.filter((event) => event.emitterId === id);
      assert.equal(cues.length, 2);
      assert.equal(cues[1].emitterDuration, duration);
      assert.ok(cues[1].emitterAge >= 3.25 && cues[1].emitterAge < 3.27);
      assert.equal(cues[1].emitterAge, cues[1].time);
      assert.deepEqual(cues[1].position, cues[0].position);
    }
  });
}
