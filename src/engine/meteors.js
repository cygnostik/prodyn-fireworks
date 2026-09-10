import * as THREE from "three";
import { seededRandom } from "./simulation.js";
import {
  DEG,
  SKY_REFERENCE,
  GEMINID_RADIANT,
  APPARENT_MOON_DIRECTION,
  angleDeg,
  dot,
  unit,
  slantRangeKm,
  heightKm,
  toSkyPoint,
} from "./sky-reference.js";

export const METEOR_LIMITS = Object.freeze({
  capacity: 2,
  history: 16,
  meanIntervalSeconds: 150,
  minimumIntervalSeconds: 18,
  minDuration: 0.24,
  maxDuration: 0.68,
  maxCatchUp: 128,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const COLOURS = Object.freeze({
  pale: Object.freeze([0.91, 0.95, 1]),
  warm: Object.freeze([1, 0.91, 0.76]),
  "blue-green": Object.freeze([0.77, 1, 0.94]),
});

// Display-contrast proxy, not a calibrated limiting-magnitude/extinction law.
// Extinction follows elevation; local glare follows the ACTUAL authored Moon.
export function meteorVisibility(direction) {
  const altitude = Math.asin(clamp(direction[1], -1, 1)) / DEG;
  const separation = angleDeg(direction, APPARENT_MOON_DIRECTION);
  const airMass = 1 / Math.max(0.08, direction[1]);
  const horizon = smooth(3, 12, altitude);
  const atmosphere = Math.exp(-0.14 * (airMass - 1));
  const moon =
    (1 - 0.88 * Math.exp(-0.5 * (separation / 8) ** 2)) *
    smooth(0.65, 1.4, separation);
  return {
    altitude,
    separation,
    horizon,
    atmosphere,
    moon,
    transmission: 0.62 * horizon * atmosphere * moon,
  };
}

function audienceDirection(rng) {
  // Fixed canonical audience frustum, not an emitter following a dragged camera.
  const x = ((rng() * 2 - 1) * 0.92 * Math.tan(24 * DEG) * 16) / 9;
  const y = (0.34 + rng() * 0.6) * Math.tan(24 * DEG);
  const pitch = Math.atan2(22, 510);
  return unit([
    x,
    y * Math.cos(pitch) + Math.sin(pitch),
    y * Math.sin(pitch) - Math.cos(pitch),
  ]);
}

export function createMeteor(rng, birth = 0, id = 0) {
  const startDirection = audienceDirection(rng);
  const height = 100 + rng() * 12;
  const range = slantRangeKm(Math.asin(startDirection[1]) / DEG, height);
  const position = startDirection.map((v) => v * range);
  const velocity = GEMINID_RADIANT.map(
    (v) => -v * SKY_REFERENCE.speedKmSeconds,
  );
  // Truncated candidate magnitudes biased toward the faint end (population r).
  const r = SKY_REFERENCE.populationIndex;
  const magnitude =
    Math.log(r ** -0.5 + rng() * (r ** 3.8 - r ** -0.5)) / Math.log(r);
  const duration =
    METEOR_LIMITS.minDuration +
    (METEOR_LIMITS.maxDuration - METEOR_LIMITS.minDuration) * rng() ** 1.7;
  const tint = rng();
  const colourName =
    magnitude > 2.8 || tint < 0.78
      ? "pale"
      : tint < 0.94
        ? "warm"
        : "blue-green";
  const end = position.map((v, i) => v + velocity[i] * duration);
  const visibility = meteorVisibility(startDirection);
  const intrinsicIntensity = Math.min(
    0.95,
    0.42 * 10 ** (-0.4 * (magnitude - 0.5)),
  );
  return {
    id,
    birth,
    duration,
    position,
    velocity,
    startDirection,
    endDirection: unit(end),
    colourName,
    colour: [...COLOURS[colourName]],
    magnitude,
    intrinsicIntensity,
    peakIntensity: intrinsicIntensity * visibility.transmission,
    visibility,
    heightStartKm: height,
    heightEndKm: heightKm(end),
    rangeKm: range,
    pathDegrees: angleDeg(position, end),
    initialDegreesPerSecond:
      (SKY_REFERENCE.speedKmSeconds *
        Math.sqrt(Math.max(0, 1 - dot(startDirection, GEMINID_RADIANT) ** 2))) /
      range /
      DEG,
    wakeSeconds: 0.065 + rng() * 0.055,
  };
}

export function meteorDirection(event, age, out = [0, 0, 0]) {
  const t = clamp(age, 0, event.duration);
  let squared = 0;
  for (let i = 0; i < 3; i++) {
    out[i] = event.position[i] + event.velocity[i] * t;
    squared += out[i] * out[i];
  }
  const length = Math.sqrt(squared);
  for (let i = 0; i < 3; i++) out[i] /= length;
  return out;
}
export function meteorEnvelope(event, age) {
  if (age <= 0 || age >= event.duration) return 0;
  const life = age / event.duration;
  return smooth(0, 0.18, life) * (1 - smooth(0.52, 1, life));
}

/** Silent CPU model. Only simulation seconds enter; never Date/RAF/audio RNG. */
export class MeteorField {
  constructor({ seed = 0x6d657465 } = {}) {
    this.seed = seed >>> 0;
    this.active = [];
    this.recent = [];
    this.reset();
  }
  interval() {
    return (
      METEOR_LIMITS.minimumIntervalSeconds -
      (METEOR_LIMITS.meanIntervalSeconds -
        METEOR_LIMITS.minimumIntervalSeconds) *
        Math.log(Math.max(Number.EPSILON, 1 - this.rng()))
    );
  }
  reset() {
    this.rng = seededRandom(this.seed);
    this.time = this.inputTime = this.generated = this.skippedClockGaps = 0;
    this.reducedMotion = false;
    this.active.length = this.recent.length = 0;
    this.nextAt = this.interval();
  }
  update(inputTime, reducedMotion = false) {
    if (!Number.isFinite(inputTime) || inputTime < 0) return;
    if (inputTime < this.inputTime) this.reset();
    const dt = inputTime - this.inputTime;
    this.inputTime = inputTime;
    if (reducedMotion) {
      // Clear, not freeze a streak; no catch-up when preference changes back.
      this.active.length = 0;
      this.reducedMotion = true;
      return;
    }
    this.reducedMotion = false;
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--)
      if (this.time >= this.active[i].birth + this.active[i].duration)
        this.active.splice(i, 1);
    let work = 0;
    while (this.nextAt <= this.time && work++ < METEOR_LIMITS.maxCatchUp) {
      const event = createMeteor(this.rng, this.nextAt, ++this.generated);
      if (
        this.time < event.birth + event.duration &&
        this.active.length < METEOR_LIMITS.capacity
      )
        this.active.push(event);
      this.recent.push(event);
      if (this.recent.length > METEOR_LIMITS.history) this.recent.shift();
      this.nextAt += this.interval();
    }
    // Defensive huge-clock-jump handling: bounded work and no overdue burst.
    if (this.nextAt <= this.time) {
      this.skippedClockGaps++;
      this.nextAt = this.time + this.interval();
    }
  }
  getStats() {
    const snapshot = (event) => {
      const age = this.time - event.birth;
      const headDirection = meteorDirection(event, age);
      return {
        ...event,
        age,
        headDirection,
        intensity:
          event.intrinsicIntensity *
          meteorVisibility(headDirection).transmission *
          meteorEnvelope(event, age),
        position: [...event.position],
        velocity: [...event.velocity],
        startDirection: [...event.startDirection],
        endDirection: [...event.endDirection],
        colour: [...event.colour],
        visibility: { ...event.visibility },
      };
    };
    return {
      reference: "Southern California / authored near-peak Geminids",
      seed: this.seed,
      time: this.time,
      nextAt: this.nextAt,
      generated: this.generated,
      skippedClockGaps: this.skippedClockGaps,
      meanIntervalSeconds: METEOR_LIMITS.meanIntervalSeconds,
      minimumIntervalSeconds: METEOR_LIMITS.minimumIntervalSeconds,
      reducedMotion: this.reducedMotion,
      capacity: METEOR_LIMITS.capacity,
      radiantDirection: [...GEMINID_RADIANT],
      active: this.active.map(snapshot),
      recent: this.recent.map(snapshot),
    };
  }
}

/** One preallocated batched ribbon path; no persistent train or GPU per event. */
export class MeteorRenderer {
  constructor(scene) {
    this.scene = scene;
    this.disposed = false;
    this.rendered = 0;
    this.geometry = new THREE.BufferGeometry();
    const count = METEOR_LIMITS.capacity * 6;
    for (const name of ["position", "aTail", "aHead", "aColour"])
      this.geometry.setAttribute(
        name,
        new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
    const corners = [];
    for (let i = 0; i < METEOR_LIMITS.capacity; i++)
      corners.push(0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1);
    this.geometry.setAttribute(
      "aCorner",
      new THREE.Float32BufferAttribute(corners, 2),
    );
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      name: "AfterlightSilentMeteors",
      depthTest: true,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uViewport: { value: new THREE.Vector2(1280, 720) } },
      vertexShader: /* glsl */ `
        attribute vec3 aTail,aHead,aColour;attribute vec2 aCorner;
        uniform vec2 uViewport;varying vec2 vRibbon;varying vec3 vColour;
        void main(){
          vec4 t=projectionMatrix*viewMatrix*vec4(aTail,1.);
          vec4 h=projectionMatrix*viewMatrix*vec4(aHead,1.);
          vec2 delta=(h.xy/h.w-t.xy/t.w)*uViewport;
          vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),.0001);
          vec4 p=mix(t,h,aCorner.x);
          // Unresolved point-spread width in drawing-buffer pixels, not metres.
          float halfWidth=max(.72,uViewport.y*.00065);
          p.xy+=normal*aCorner.y*halfWidth*2./uViewport*p.w;
          gl_Position=p;vRibbon=aCorner;vColour=aColour;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vRibbon;varying vec3 vColour;
        void main(){
          float crossProfile=exp(-vRibbon.y*vRibbon.y*4.5);
          float tail=smoothstep(0.,.75,vRibbon.x);
          float cap=1.-smoothstep(.91,1.,vRibbon.x);
          gl_FragColor=vec4(vColour,crossProfile*tail*cap);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Silent background meteors / bounded ribbon batch";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -90;
    this.mesh.visible = false;
    this.viewport = new THREE.Vector4();
    this.mesh.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(this.viewport);
      this.material.uniforms.uViewport.value.set(
        this.viewport.z,
        this.viewport.w,
      );
    };
    this.headDirection = [0, 0, 0];
    this.tailDirection = [0, 0, 0];
    this.headPoint = [0, 0, 0];
    this.tailPoint = [0, 0, 0];
    scene.add(this.mesh);
  }
  sync(field) {
    if (this.disposed) return;
    const attrs = this.geometry.attributes;
    let slot = 0;
    for (const event of field.active) {
      const age = field.time - event.birth;
      meteorDirection(event, age, this.headDirection);
      meteorDirection(event, age - event.wakeSeconds, this.tailDirection);
      const intensity =
        event.intrinsicIntensity *
        meteorVisibility(this.headDirection).transmission *
        meteorEnvelope(event, age);
      if (intensity <= 0) continue;
      toSkyPoint(this.headDirection, this.headPoint);
      toSkyPoint(this.tailDirection, this.tailPoint);
      for (let j = 0; j < 6; j++) {
        const index = slot * 6 + j;
        attrs.aHead.setXYZ(index, ...this.headPoint);
        attrs.aTail.setXYZ(index, ...this.tailPoint);
        attrs.aColour.setXYZ(
          index,
          event.colour[0] * intensity,
          event.colour[1] * intensity,
          event.colour[2] * intensity,
        );
      }
      if (++slot === METEOR_LIMITS.capacity) break;
    }
    this.rendered = slot;
    this.mesh.visible = slot > 0;
    this.geometry.setDrawRange(0, slot * 6);
    if (slot)
      for (const name of ["aTail", "aHead", "aColour"])
        attrs[name].needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
