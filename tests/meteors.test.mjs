import test from "node:test";
import assert from "node:assert/strict";
import {
  MeteorField,
  MeteorRenderer,
  METEOR_LIMITS,
  createMeteor,
  meteorDirection,
  meteorEnvelope,
  meteorVisibility,
} from "../src/engine/meteors.js";
import {
  SKY_REFERENCE,
  GEMINID_RADIANT,
  APPARENT_MOON_DIRECTION,
  angleDeg,
  dot,
  horizontalDirection,
  slantRangeKm,
  heightKm,
  equatorialDirection,
} from "../src/engine/sky-reference.js";
import { FireworkSimulation, seededRandom } from "../src/engine/simulation.js";
import * as THREE from "three";
import { createEnvironment } from "../src/engine/environment.js";

test("environment uses simulation seconds, clears reset and disposes its single meteor batch", () => {
  const scene = new THREE.Scene();
  const environment = createEnvironment(scene, { reflectionSize: 32 });
  const first = environment.getMeteorStats().nextAt;
  environment.update(first + 0.15, false);
  assert.equal(environment.getMeteorStats().generated, 1);
  assert.equal(environment.getMeteorStats().rendered, 1);
  const frozen = environment.getMeteorStats();
  environment.update(first + 0.15, false);
  assert.deepEqual(environment.getMeteorStats(), frozen);
  environment.update(first + 0.15, true);
  assert.equal(environment.getMeteorStats().rendered, 0);
  environment.reset();
  assert.equal(environment.getMeteorStats().generated, 0);
  assert.equal(environment.getMeteorStats().nextAt, first);
  environment.dispose();
  assert.equal(scene.children.length, 0);
});

test("natural meteor schedule is independent, irregular, bounded and repeatable on reset", () => {
  const field = new MeteorField({ seed: 731 });
  assert.equal(field.getStats().meanIntervalSeconds, 150);
  const sequence = [];
  for (let i = 0; i < 40; i++) {
    const at = field.getStats().nextAt;
    field.update(at + 0.15, false);
    const s = field.getStats();
    assert.equal(s.generated, i + 1);
    assert.ok(s.active.length <= METEOR_LIMITS.capacity);
    assert.ok(s.recent.length <= METEOR_LIMITS.history);
    sequence.push(s.recent.at(-1));
  }
  for (let i = 1; i < sequence.length; i++)
    assert.ok(sequence[i].birth - sequence[i - 1].birth >= 18);
  assert.ok(new Set(sequence.map((e) => e.duration)).size > 30);
  field.reset();
  for (const e of sequence) {
    field.update(e.birth + 0.15, false);
    assert.deepEqual(field.getStats().recent.at(-1), e);
  }
});

const near = (a, b, eps = 1e-8) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("local radiant, preserved apparent Moon and spherical altitude are consistent", () => {
  near((Math.asin(GEMINID_RADIANT[1]) * 180) / Math.PI, 45.70342311466718);
  near(
    (Math.atan2(GEMINID_RADIANT[0], -GEMINID_RADIANT[2]) * 180) / Math.PI +
      SKY_REFERENCE.forwardAzimuthDeg,
    284.4428813174575,
  );
  near(
    (Math.asin(APPARENT_MOON_DIRECTION[1]) * 180) / Math.PI,
    17.270548058961097,
  );
  // Independent ecliptic-to-equatorial opposition construction. Checking only
  // lunar declination would miss an impossible ecliptic latitude.
  const lambda = (82.2 * Math.PI) / 180,
    epsilon = (23.4393 * Math.PI) / 180;
  const moonRA =
    (Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)) * 180) /
    Math.PI;
  const moonDec =
    (Math.asin(Math.sin(epsilon) * Math.sin(lambda)) * 180) / Math.PI;
  const moon = equatorialDirection(moonRA, moonDec);
  moon.forEach((v, i) => near(v, APPARENT_MOON_DIRECTION[i]));
  near(angleDeg(APPARENT_MOON_DIRECTION, GEMINID_RADIANT), 28.49755371023708);
  for (const alt of [3, 8, 20, 40, 90]) {
    const d = horizontalDirection(70, alt);
    const range = slantRangeKm(alt, 105);
    near(heightKm(d.map((v) => v * range)), 105);
  }
});

test("straight parallel 35 km/s paths diverge from the radiant with derived angular motion", () => {
  const rng = seededRandom(182);
  for (let i = 0; i < 3000; i++) {
    const e = createMeteor(rng, 0, i);
    near(Math.hypot(...e.velocity), 35);
    near(dot(e.velocity, GEMINID_RADIANT), -35);
    assert.ok(e.duration >= 0.24 && e.duration <= 0.68);
    assert.ok(e.heightStartKm >= 100 && e.heightStartKm <= 112);
    assert.ok(e.heightEndKm > 80 && e.heightEndKm < 112);
    assert.ok(e.pathDegrees > 0.3 && e.pathDegrees < 5);
    assert.ok(e.initialDegreesPerSecond > 1 && e.initialDegreesPerSecond < 8);
    let previous = angleDeg(e.startDirection, GEMINID_RADIANT);
    const normal = new THREE.Vector3()
      .fromArray(e.startDirection)
      .cross(new THREE.Vector3().fromArray(GEMINID_RADIANT))
      .normalize();
    for (const t of [0.01, e.duration / 2, e.duration]) {
      const d = meteorDirection(e, t);
      near(normal.dot(new THREE.Vector3().fromArray(d)), 0);
      const separation = angleDeg(d, GEMINID_RADIANT);
      assert.ok(
        separation > previous,
        "outward, never steering back to radiant",
      );
      previous = separation;
    }
    const measured =
      angleDeg(e.startDirection, meteorDirection(e, 0.001)) / 0.001;
    near(measured, e.initialDegreesPerSecond, 0.01);
  }
});

test("Moon glare, horizon and atmosphere reduce contrast without recolouring events", () => {
  const atMoon = meteorVisibility(APPARENT_MOON_DIRECTION);
  assert.equal(atMoon.transmission, 0);
  const sameAlt = 17.270548058961097;
  const nearMoon = meteorVisibility(horizontalDirection(289, sameAlt));
  const away = meteorVisibility(horizontalDirection(15, sameAlt));
  assert.ok(nearMoon.transmission < away.transmission * 0.3);
  const elevations = [2, 5, 8, 12, 25, 45, 80].map(
    (alt) => meteorVisibility(horizontalDirection(100, alt)).transmission,
  );
  assert.equal(elevations[0], 0);
  assert.ok(elevations.every((v, i) => i === 0 || v > elevations[i - 1]));
});

test("population is predominantly pale and faint, with restrained warm/blue-green exceptions", () => {
  const rng = seededRandom(49);
  const events = Array.from({ length: 10000 }, (_, i) =>
    createMeteor(rng, 0, i),
  );
  const count = (fn) => events.filter(fn).length;
  assert.ok(count((e) => e.colourName === "pale") > 8800);
  assert.ok(count((e) => e.colourName === "warm") > 250);
  assert.ok(count((e) => e.colourName === "blue-green") > 70);
  assert.ok(count((e) => e.peakIntensity < 0.014) > 2500);
  assert.ok(count((e) => e.peakIntensity > 0.06) > 400);
  for (const e of events) {
    assert.ok(e.magnitude >= -0.5 && e.magnitude <= 3.8);
    assert.ok(e.peakIntensity >= 0 && e.peakIntensity < 0.6);
    assert.ok(Math.min(...e.colour) / Math.max(...e.colour) >= 0.75);
    if (e.magnitude > 2.8) assert.equal(e.colourName, "pale");
  }
});

test("natural cadence averages 24 candidates/hour with lulls, never a periodic shower loop", () => {
  const field = new MeteorField({ seed: 89 });
  const gaps = [];
  let previous = 0;
  for (let i = 0; i < 10000; i++) {
    const at = field.nextAt;
    gaps.push(at - previous);
    field.update(at);
    previous = at;
  }
  const mean = gaps.reduce((a, b) => a + b) / gaps.length;
  assert.ok(mean > 145 && mean < 155);
  assert.ok(Math.min(...gaps) >= 18);
  assert.ok(Math.max(...gaps) > 600);
  assert.ok(gaps.filter((g) => g > 300).length > 500);
  const before = field.generated;
  field.update(1e12);
  assert.ok(field.generated - before <= METEOR_LIMITS.maxCatchUp);
  assert.equal(field.getStats().skippedClockGaps, 1);
  assert.equal(field.active.length, 0);
});

test("pause/invalid time/reduced motion/reset cannot age, resurrect or accumulate streaks", () => {
  const field = new MeteorField({ seed: 31 });
  const at = field.nextAt + 0.1;
  field.update(at);
  assert.equal(field.active.length, 1);
  const unchanged = field.getStats();
  for (const t of [at, NaN, Infinity, -1]) field.update(t);
  assert.deepEqual(field.getStats(), unchanged);
  const event = field.active[0];
  assert.equal(meteorEnvelope(event, -1), 0);
  assert.equal(meteorEnvelope(event, event.duration), 0);
  assert.ok(meteorEnvelope(event, event.duration * 0.4) > 0.9);
  field.update(at, true);
  field.update(at + 900, true);
  assert.equal(field.active.length, 0);
  assert.equal(field.time, at);
  assert.equal(field.generated, 1);
  field.update(at + 900, false);
  assert.equal(field.active.length, 0, "suppressed meteor never returns");
  assert.equal(field.time, at);
  field.update(0, false);
  assert.equal(field.generated, 0);
  assert.equal(field.recent.length, 0);
});

test("diagnostics are copied and CPU/GPU ownership stays bounded without consuming firework RNG", () => {
  const scene = new THREE.Scene();
  const renderer = new MeteorRenderer(scene);
  const field = new MeteorField();
  const a = new FireworkSimulation(),
    b = new FireworkSimulation();
  const buffers = Object.values(renderer.geometry.attributes).map(
    (v) => v.array,
  );
  let disposals = 0;
  renderer.geometry.addEventListener("dispose", () => disposals++);
  for (let i = 0; i < 50; i++) {
    field.update(field.nextAt + 0.1);
    renderer.sync(field);
    assert.equal(scene.children.length, 1);
    assert.ok(renderer.geometry.drawRange.count <= 12);
    const snapshot = field.getStats();
    snapshot.active[0].colour[0] = 500;
    snapshot.active[0].velocity[0] = 500;
    snapshot.recent[0].visibility.moon = 500;
    assert.notEqual(field.getStats().active[0].colour[0], 500);
    assert.notEqual(field.getStats().active[0].velocity[0], 500);
    assert.notEqual(field.getStats().recent[0].visibility.moon, 500);
    if (i < 8) {
      a.launch({ effectId: "peony", seed: 100 + i });
      b.launch({ effectId: "peony", seed: 100 + i });
      assert.deepEqual(a.lastLaunch, b.lastLaunch);
    }
  }
  assert.ok(
    Object.values(renderer.geometry.attributes).every(
      (v, i) => v.array === buffers[i],
    ),
  );
  assert.ok(field.recent.length <= 16);
  renderer.dispose();
  renderer.dispose();
  assert.equal(disposals, 1);
  assert.equal(scene.children.length, 0);
});
