import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { AfterlightEngine } from "../src/engine/engine.js";
import { FireworkSimulation, EFFECT_IDS } from "../src/engine/simulation.js";
import { buildFinale } from "../src/show.js";

// Exercise the real engine camera/launch/resize/orbit methods, without a GPU.
// Only render-target sizing is stubbed; projection and simulation are real.
function instrument(view = "audience", width = 1600, height = 900) {
  const events = [];
  const engine = Object.create(AfterlightEngine.prototype);
  Object.assign(engine, {
    camera: new THREE.PerspectiveCamera(48, width / height, 1, 3600),
    target: new THREE.Vector3(),
    simulation: new FireworkSimulation({
      onEvent: (e) => events.push(e),
      density: 0.52,
    }),
    renderer: { setPixelRatio() {}, setSize() {} },
    composer: { setPixelRatio() {}, setSize() {} },
    environment: { resize() {} },
    particles: { resize() {} },
    bloom: { compositeMaterial: { uniforms: { bloomFactors: {} } } },
    profile: { dpr: 1.25, reflection: 640 },
  });
  engine.setView(view);
  engine.resize(width, height, 1);
  return { engine, events };
}
const project = (engine, xyz) =>
  new THREE.Vector3(...xyz).project(engine.camera).toArray();
function shot(engine, events, position, options = {}) {
  engine.simulation.reset();
  events.length = 0;
  if (options.depth !== undefined) {
    engine.simulation.pending.push({ at: 10000 });
    engine.simulation.launchDepth = options.depth;
  }
  assert.ok(
    engine.launch({
      effectId: "chrysanthemum",
      seed: 932,
      position,
      scale: 1.6,
      ...options,
    }).ok,
  );
  const s = engine.simulation.lastLaunch;
  const launch = project(engine, [s.x, s.y, s.z]);
  for (let i = 0; i < 480; i++) engine.update(1 / 120);
  const burst = events.find((e) => e.kind === "burst");
  assert.ok(burst, "measure the actual main break, not the lift trail");
  assert.ok(engine.simulation.stars.count > 100);
  return { launch, burst: project(engine, burst.position) };
}

for (const view of ["audience", "close", "wide"]) {
  test(`${view}: taps and automatic extremes use the visible field with a bloom margin`, () => {
    const { engine, events } = instrument(view);
    for (const amplitude of [1, 0.78]) {
      const left = shot(engine, events, -amplitude);
      const right = shot(engine, events, amplitude);
      const centre = shot(engine, events, 0);
      for (const phase of ["launch", "burst"]) {
        const span = (right[phase][0] - left[phase][0]) / 2;
        assert.ok(
          span >= amplitude * 0.72,
          `${view} ${phase} amplitude ${amplitude}: covers ${(span * 100).toFixed(2)}% of viewport; needs >= ${(amplitude * 72).toFixed(2)}%`,
        );
        assert.ok(
          left[phase][0] >= -0.82 && right[phase][0] <= 0.82,
          "centres retain a lateral inset",
        );
        assert.ok(
          Math.abs(centre[phase][0]) < 0.035,
          "centre tap remains centred",
        );
      }
    }
  });
}

test("far-to-near progression keeps all 42 accepted launch and actual burst centres inside the field", () => {
  for (const view of ["audience", "close", "wide"]) {
    const { engine, events } = instrument(view);
    const legacy = new FireworkSimulation(),
      inputs = [];
    for (let i = 0; i < 42; i++) {
      const position = [-1, 0, 1][i % 3];
      const cue = { effectId: "chrysanthemum", seed: 932, position };
      assert.ok(legacy.launch(cue).ok);
      assert.ok(engine.launch(cue).ok);
      const s = engine.simulation.lastLaunch;
      assert.equal(s.z, legacy.lastLaunch.z, "depth sequence is unchanged");
      inputs.push({ position, z: s.z });
      assert.ok(Math.abs(project(engine, [s.x, s.y, s.z])[0]) <= 0.80001);
    }
    for (let i = 0; i < 420; i++) engine.update(1 / 120);
    const bursts = events.filter((e) => e.kind === "burst");
    assert.equal(bursts.length, inputs.length);
    for (const [i, burst] of bursts.entries()) {
      // Equal seeded fuses break in reverse live-shell iteration order.
      const input = inputs.at(-1 - i),
        x = project(engine, burst.position)[0];
      assert.equal(burst.position[2], input.z);
      assert.ok(Math.abs(x) <= 0.80001, `${view} depth ${input.z}: ${x}`);
      if (input.position)
        assert.ok(
          x * input.position >= 0.72,
          "near shots remain laterally spread",
        );
      else assert.ok(Math.abs(x) < 0.0001);
    }
  }
});

test("resize, both orbit limits, loft limits and near depth use the live camera rather than stale preset widths", () => {
  for (const view of ["audience", "close", "wide"]) {
    const { engine, events } = instrument(view);
    for (const [width, height] of [
      [390, 219],
      [420, 900],
      [2400, 900],
    ]) {
      engine.resize(width, height, 2);
      for (const orbit of [
        [0, 0],
        [10000, 10000],
        [-10000, -10000],
      ]) {
        engine.setView(view);
        engine.orbit(...orbit);
        for (const depth of [-125, 14.9]) {
          for (const loft of [0.65, 1.35]) {
            for (const position of [-1, 0, 1]) {
              const s = shot(engine, events, position, { depth, loft });
              for (const phase of ["launch", "burst"]) {
                const x = s[phase][0];
                assert.ok(
                  Number.isFinite(x) && Math.abs(x) <= 0.8001,
                  `${view} ${width}/${height} orbit ${orbit} depth ${depth} loft ${loft} ${phase}: ${x}`,
                );
              }
              if (position)
                assert.ok(
                  s.burst[0] * position > 0.6,
                  "edge remains on the requested side",
                );
              else
                assert.ok(
                  Math.abs(s.burst[0]) < 0.0001,
                  "centre tap aims at the burst centre",
                );
            }
          }
        }
      }
    }
  }
});

test("extreme ultrawide orbit never selects the part of the depth plane behind the camera", () => {
  for (const view of ["audience", "close", "wide"]) {
    const { engine, events } = instrument(view, 6400, 900);
    for (const dx of [-10000, 10000]) {
      engine.setView(view);
      engine.orbit(dx, 0);
      for (const position of [-1, 0, 1]) {
        const s = shot(engine, events, position);
        for (const p of [s.launch, s.burst]) {
          assert.ok(
            Math.abs(p[0]) <= 0.8001 && p[2] > -1 && p[2] < 1,
            `${view}: ${p}`,
          );
        }
      }
    }
  }
});

test("view changes and DPR-only resize do not teleport active effects or alter camera composition", () => {
  const { engine } = instrument();
  const presets = {
    audience: [[0, 90, 455], [0, 112, -55], 48],
    close: [[12, 89, 342], [0, 160, -55], 48],
    wide: [[35, 95, 680], [0, 138, -55], 46],
  };
  for (const [view, [position, target, fov]] of Object.entries(presets)) {
    engine.setView(view);
    assert.deepEqual(engine.camera.position.toArray(), position);
    assert.deepEqual(engine.target.toArray(), target);
    assert.equal(engine.camera.fov, fov);
    engine.launch({ effectId: "willow", position: 0.92, seed: 17 });
    const shell = engine.simulation.shells.at(-1),
      x = shell.x;
    engine.resize(1600, 900, 2);
    engine.orbit(240, 80);
    engine.setView(view === "close" ? "wide" : "close");
    assert.equal(shell.x, x, "only future launches follow the new camera");
  }
  const s = new FireworkSimulation();
  s.launch({ position: 1 });
  assert.equal(
    s.lastLaunch.x,
    220,
    "direct simulation API retains its metre-based fallback",
  );
});

test("seeded automatic positions and authored Finale cues retain their order and spread across the frustum", () => {
  const cues = buildFinale(
    [
      { id: "a", effectId: "peony", palette: "guatemala", density: 2 },
      { id: "b", effectId: "willow", palette: "signature", density: 2 },
    ],
    { seed: 42 },
  );
  const snapshot = structuredClone(cues);
  for (const view of ["audience", "close", "wide"]) {
    const { engine, events } = instrument(view);
    for (const cue of [
      ...cues,
      ...Array.from({ length: 12 }, (_, i) => ({
        position: Math.sin(i + 1) * 0.92,
      })),
    ]) {
      const result = shot(engine, events, cue.position, { ...cue, depth: -25 });
      assert.ok(Math.abs(result.burst[0] - cue.position * 0.8) < 0.04);
    }
  }
  assert.deepEqual(
    cues,
    snapshot,
    "the renderer must not rewrite stored cue fields",
  );
});

test("all 40 effects preserve seeded timing, colours, velocities and non-X physics under camera placement", () => {
  const stripX = (e) => ({ ...e, position: e.position.slice(1) });
  for (const effectId of EFFECT_IDS) {
    const { engine, events } = instrument("wide");
    const legacyEvents = [];
    const legacy = new FireworkSimulation({
      density: 0.52,
      onEvent: (e) => legacyEvents.push(e),
    });
    const cue = {
      effectId,
      position: -0.92,
      palette: "signature",
      seed: 17,
      variation: 3,
      scale: 1.3,
    };
    assert.deepEqual(engine.launch(cue), legacy.launch(cue));
    const offset = engine.simulation.lastLaunch.x - legacy.lastLaunch.x;
    for (let i = 0; i < 780; i++) {
      engine.update(1 / 120);
      legacy.update(1 / 120);
      // Check live lift, short bursts, mature blooms and late branches rather
      // than accepting equality only after short-lived stars have expired.
      if ((i + 1) % 120 !== 0 && i !== 407 && i !== 779) continue;
      assert.deepEqual(
        events.map(stripX),
        legacyEvents.map(stripX),
        effectId + " event time/power/height/depth",
      );
      assert.deepEqual(
        engine.simulation.metrics,
        legacy.metrics,
        effectId + " counts",
      );
      for (const pool of ["stars", "sparks", "smoke"]) {
        const a = engine.simulation[pool],
          b = legacy[pool];
        assert.equal(a.count, b.count);
        for (const field of a.fields) {
          if (["x", "px", "lastX"].includes(field)) {
            for (let i = 0; i < a.count; i++)
              assert.ok(
                Math.abs(a[field][i] - b[field][i] - offset) < 0.03,
                `${effectId} ${pool}.${field} keeps its shape (Float32 translation tolerance)`,
              );
          } else
            assert.deepEqual(
              a[field].slice(0, a.count),
              b[field].slice(0, b.count),
              effectId + " " + field,
            );
        }
      }
    }
  }
});
