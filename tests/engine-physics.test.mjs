import test from "node:test";
import assert from "node:assert/strict";
import { integrateParticle } from "../src/engine/simulation.js";

test("gravity bends a moving star downward while drag approaches wind", () => {
  const p = {
    x: 0,
    y: 100,
    z: 0,
    vx: 40,
    vy: 0,
    vz: 0,
    drag: 0.5,
    gravity: 9.81,
  };
  integrateParticle(p, 1, 3);
  assert.ok(p.x > 25 && p.x < 40, "star travels, slowed by air");
  assert.ok(p.y < 100 && p.vy < 0, "gravity creates droop");
  assert.ok(p.vx > 3 && p.vx < 40, "drag converges toward wind, not zero");
});

test("analytic drag integration is invariant to timestep subdivision", () => {
  const initial = {
    x: -5,
    y: 180,
    z: 20,
    vx: 30,
    vy: 15,
    vz: -10,
    drag: 0.6,
    gravity: 9.81,
  };
  const whole = { ...initial },
    split = { ...initial };
  integrateParticle(whole, 0.2, 2);
  for (let i = 0; i < 20; i++) integrateParticle(split, 0.01, 2);
  for (const field of ["x", "y", "z", "vx", "vy", "vz"])
    assert.ok(Math.abs(whole[field] - split[field]) < 1e-9, field);
});
