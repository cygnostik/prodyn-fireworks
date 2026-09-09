// Original procedural choreography; metres, seconds, seeded synthetic physics.
// No pyrotechnic construction parameters or calibrated chemistry are implied.
import { SMILEY_COLOURS, resolveLook } from "./colours.js";
export { PALETTES } from "./colours.js";
export const EFFECT_IDS = Object.freeze([
  "peony",
  "chrysanthemum",
  "dahlia",
  "diadem",
  "pistil",
  "double-pistil",
  "willow",
  "brocade",
  "kamuro",
  "nishiki",
  "palm",
  "spider",
  "ring",
  "saturn",
  "heart",
  "star",
  "spiral",
  "smiley",
  "crossette",
  "crackle",
  "strobe",
  "glitter",
  "falling-leaves",
  "bees",
  "fish",
  "tourbillon",
  "ghost",
  "color-change",
  "shell-of-shells",
  "comet",
  "mine",
  "fan",
  "fountain",
  "waterfall",
  "roman-candle",
  "salute",
  "multi-pistil",
  "horsetail",
  "wheel",
  "set-piece",
]);
const TAU = Math.PI * 2,
  STEP = 1 / 120;
const EMITTER_DURATIONS = Object.freeze({
  mine: 0.5,
  fan: 0.5,
  fountain: 6.5,
  waterfall: 6,
  "roman-candle": 6.4,
  wheel: 7.2,
  "set-piece": 8.5,
});
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const number = (v, fallback) => (Number.isFinite(v) ? v : fallback);
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function integrateParticle(p, dt, wind = 0) {
  const k = Math.max(0, p.drag || 0),
    g = p.gravity ?? 9.81;
  if (k < 1e-8) {
    p.x += p.vx * dt;
    p.y += p.vy * dt - (g * dt * dt) / 2;
    p.z += p.vz * dt;
    p.vy -= g * dt;
  } else {
    const e = Math.exp(-k * dt),
      a = (1 - e) / k;
    p.x += wind * dt + (p.vx - wind) * a;
    p.y += (p.vy + g / k) * a - (g * dt) / k;
    p.z += p.vz * a;
    p.vx = wind + (p.vx - wind) * e;
    p.vy = (p.vy + g / k) * e - g / k;
    p.vz *= e;
  }
  return p;
}

export class ParticlePool {
  constructor(capacity, fields) {
    this.capacity = capacity;
    this.count = 0;
    this.fields = fields;
    for (const f of fields) this[f] = new Float32Array(capacity);
  }
  add(values) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    for (const f of this.fields) this[f][i] = values[f] ?? 0;
    return i;
  }
  remove(i) {
    const last = --this.count;
    if (i !== last) for (const f of this.fields) this[f][i] = this[f][last];
  }
  clear() {
    this.count = 0;
  }
}
const STAR_FIELDS = [
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "age",
  "life",
  "r",
  "g",
  "b",
  "r2",
  "g2",
  "b2",
  "trailR",
  "trailG",
  "trailB",
  "fixedTrailColor",
  "size",
  "drag",
  "gravity",
  "trail",
  "trailLife",
  "trailClock",
  "lastX",
  "lastY",
  "lastZ",
  "seed",
  "mode",
  "splitAt",
  "brightness",
  "effect",
  "phase",
  "layer",
];
const SPARK_FIELDS = [
  "x",
  "y",
  "z",
  "px",
  "py",
  "pz",
  "vx",
  "vy",
  "vz",
  "age",
  "life",
  "r",
  "g",
  "b",
  "size",
  "seed",
  "brightness",
  "glitter",
];
const SMOKE_FIELDS = [
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "age",
  "life",
  "size",
  "seed",
  "opacity",
];
// mode: plain, strobe, glitter, ghost, bees, fish, tourbillon,
// crossette, satellite, crackle, two-stage color.
const MODES = {
  strobe: 1,
  glitter: 2,
  ghost: 3,
  bees: 4,
  fish: 5,
  tourbillon: 6,
  crossette: 7,
  "shell-of-shells": 8,
  crackle: 9,
  "color-change": 10,
};

export class FireworkSimulation {
  constructor({
    onEvent = () => {},
    starCapacity = 6000,
    sparkCapacity = 56000,
    smokeCapacity = 360,
    density = 1,
    reducedMotion = false,
  } = {}) {
    this.onEvent = onEvent;
    this.density = density;
    this.reducedMotion = reducedMotion;
    this.wind = 1.8;
    this.launchHalfWidth = 220;
    this.stars = new ParticlePool(starCapacity, STAR_FIELDS);
    this.sparks = new ParticlePool(sparkCapacity, SPARK_FIELDS);
    this.smoke = new ParticlePool(smokeCapacity, SMOKE_FIELDS);
    this.shells = [];
    this.emitters = [];
    this.pending = [];
    this.flashes = [];
    this.reset();
  }
  reset() {
    this.time = 0;
    this.accumulator = 0;
    this.sequence = 0;
    this.lookCounters = Object.create(null);
    this.launchDepth = -125;
    this.lastLaunch = null;
    this.smokeClock = 0;
    this.stars.clear();
    this.sparks.clear();
    this.smoke.clear();
    this.shells.length =
      this.emitters.length =
      this.pending.length =
      this.flashes.length =
        0;
    this.metrics = {
      launched: 0,
      bursts: 0,
      secondaryBursts: 0,
      droppedParticles: 0,
    };
  }
  emit(kind, effectId, x, y, z, power = 1) {
    this.onEvent({
      kind,
      effectId,
      position: [x, y, z],
      power: clamp(power, 0.5, 2),
      time: this.time,
    });
  }
  skyEmpty() {
    return !(
      this.shells.length ||
      this.emitters.length ||
      this.pending.length ||
      this.stars.count ||
      this.sparks.count
    );
  }
  launch({
    effectId = "chrysanthemum",
    palette = "signature",
    position = 0,
    scale = 1,
    seed,
    loft = 1,
    variation,
  } = {}) {
    if (!EFFECT_IDS.includes(effectId))
      return { ok: false, reason: "unknown-effect", effectId };
    if (
      this.shells.length + this.emitters.length + this.pending.length >= 48 ||
      this.stars.count > this.stars.capacity * 0.93
    )
      return { ok: false, reason: "capacity", effectId };
    position = clamp(number(position, 0), -1, 1);
    scale = clamp(number(scale, 1), 0.55, 1.6);
    loft = clamp(number(loft, 1), 0.65, 1.35);
    seed = Number.isInteger(seed) ? seed >>> 0 : (++this.sequence * 7919) >>> 0;
    if (this.skyEmpty()) this.launchDepth = -125;
    const automaticLook = !Number.isInteger(variation);
    variation = automaticLook ? this.lookCounters[effectId] || 0 : variation;
    if (palette === "signature" && automaticLook)
      this.lookCounters[effectId] = variation + 1;
    const rng = seededRandom(seed),
      look = resolveLook(effectId, palette, variation),
      x = position * this.launchHalfWidth,
      z = this.launchDepth;
    // A continuing show approaches the audience without jumping behind it.
    this.launchDepth += (15 - this.launchDepth) * 0.085;
    const s = {
      effectId,
      palette,
      ...look,
      variation,
      scale,
      seed,
      rng,
      x,
      y: 3,
      z,
      vx: (rng() - 0.5) * 3,
      vy: (70 + rng() * 6) * Math.sqrt(loft),
      vz: 0,
      drag: 0.047,
      gravity: 9.81,
      age: 0,
      fuse: (2.65 + rng() * 0.32) * Math.sqrt(loft),
      trailClock: 0,
      smokeClock: 0,
      lastX: x,
      lastY: 3,
      lastZ: z,
      loft,
    };
    this.metrics.launched++;
    if (effectId === "wheel") s.y = 26;
    if (effectId === "set-piece") s.y = 34 * scale;
    s.lastY = s.y;
    this.lastLaunch = {
      id: this.metrics.launched,
      effectId,
      palette,
      variation,
      seed,
      position,
      x: s.x,
      y: s.y,
      z: s.z,
      scale,
      loft,
      colors: s.colors.map((c) => [...c]),
      trailColor: s.trailColor ? [...s.trailColor] : null,
    };
    if (EMITTER_DURATIONS[effectId]) {
      this.emitters.push({
        ...s,
        duration: EMITTER_DURATIONS[effectId],
        clock: 0,
        shot: 0,
        rotation: 0,
      });
      if (effectId !== "roman-candle")
        this.emit(
          ["fountain", "waterfall", "wheel", "set-piece"].includes(effectId)
            ? "fountain"
            : "launch",
          effectId,
          s.x,
          effectId === "waterfall" ? 103 : s.y,
          s.z,
          effectId === "set-piece" ? 0.5 : scale,
        );
    } else {
      if (effectId === "comet") {
        s.fuse = 4.3;
        this.emit("comet", effectId, s.x, s.y, s.z, scale);
      } else this.emit("launch", effectId, s.x, s.y, s.z, scale);
      s.lastZ = s.z;
      this.shells.push(s);
    }
    return {
      ok: true,
      id: this.metrics.launched,
      effectId,
      seed,
      position,
      scale,
      loft,
      variation,
    };
  }
  star(s, d, options = {}) {
    const rng = s.rng,
      c = options.color || s.colors[Math.floor(rng() * s.colors.length)],
      c2 = options.color2 || s.color2 || c,
      trailColor = options.trailColor || s.trailColor,
      trail = trailColor || c;
    const life =
        options.fixedLife ?? (options.life ?? 3) * (0.84 + rng() * 0.3),
      size = (options.size ?? 0.63) * (0.7 + rng() * 0.55);
    const i = this.stars.add({
      x: s.x,
      y: s.y,
      z: s.z,
      vx: d[0],
      vy: d[1],
      vz: d[2],
      life,
      r: c[0],
      g: c[1],
      b: c[2],
      r2: c2[0],
      g2: c2[1],
      b2: c2[2],
      trailR: trail[0],
      trailG: trail[1],
      trailB: trail[2],
      fixedTrailColor: trailColor ? 1 : 0,
      size,
      drag: options.drag ?? 0.32,
      gravity: options.gravity ?? 8.2,
      trail: options.trail ?? 0,
      trailLife: options.trailLife ?? 1.2,
      trailClock: rng() / 30,
      lastX: s.x,
      lastY: s.y,
      lastZ: s.z,
      seed: rng() * 500,
      mode: options.mode ?? MODES[s.effectId] ?? 0,
      splitAt: options.splitAt ?? 1.15,
      brightness: options.brightness ?? 1,
      effect: EFFECT_IDS.indexOf(s.effectId),
    });
    if (i < 0) this.metrics.droppedParticles++;
    else {
      this.stars.phase[i] = options.phase ?? 0.5;
      this.stars.layer[i] = options.layer ?? 0;
    }
    return i;
  }
  puff(x, y, z, rng, size = 8, opacity = 0.16) {
    this.smoke.add({
      x,
      y,
      z,
      vx: this.wind * (0.7 + rng() * 0.8),
      vy: 0.7 + rng() * 1.8,
      vz: (rng() - 0.5) * 1.2,
      life: 8 + rng() * 10,
      size,
      opacity,
      seed: rng() * 200,
    });
  }
  flash(s, strength = 1) {
    const c = s.colors[0];
    this.flashes.push({
      x: s.x,
      y: s.y,
      z: s.z,
      age: 0,
      life: 0.7,
      power: strength,
      color: c,
    });
    if (this.flashes.length > 24) this.flashes.shift();
  }
  burst(s, secondary = false) {
    const id = s.effectId,
      rng = s.rng,
      scale = s.scale;
    this.metrics.bursts++;
    if (secondary) this.metrics.secondaryBursts++;
    this.emit(
      "burst",
      s.sourceEffectId || id,
      s.x,
      s.y,
      s.z,
      scale * (id === "salute" ? 1.55 : 1),
    );
    this.flash(s, id === "salute" ? 2 : 0.75);
    for (let i = 0; i < (id === "salute" ? 9 : 5); i++)
      this.puff(
        s.x + (rng() - 0.5) * 12,
        s.y + (rng() - 0.5) * 10,
        s.z + (rng() - 0.5) * 12,
        rng,
        10 + rng() * 9,
        0.2,
      );
    let n = 240,
      speed = 40,
      config = { life: 2.5, drag: 0.36, gravity: 8.2, trail: 0 };
    switch (id) {
      case "peony":
        n = 330;
        config.life = 2.4;
        break;
      case "chrysanthemum":
        n = 300;
        config = {
          ...config,
          life: 3.65,
          trail: 1,
          trailLife: 1.32,
          drag: 0.32,
        };
        break;
      case "dahlia":
        n = 78;
        speed = 44;
        config = { ...config, life: 4.2, size: 1.03, drag: 0.3 };
        break;
      case "diadem":
        n = 185;
        config = {
          ...config,
          life: 4.4,
          trail: 1,
          trailLife: 1.6,
          color2: s.color2,
          mode: 10,
          splitAt: 1.9,
        };
        break;
      case "pistil":
        n = 230;
        config = { ...config, life: 3.2, trail: 0.6, trailLife: 0.85 };
        break;
      case "double-pistil":
        n = 240;
        config = { ...config, life: 3.5, trail: 0.7, trailLife: 1.05 };
        break;
      case "multi-pistil":
        n = 270;
        speed = 44;
        config = {
          ...config,
          life: 4.1,
          trail: 0.4,
          trailLife: 0.35,
          color: s.colors[0],
        };
        break;
      case "horsetail":
        n = 145;
        speed = 24;
        config = {
          ...config,
          life: 6.3,
          trail: 0.9,
          trailLife: 2.1,
          drag: 0.34,
          gravity: 8.8,
          size: 0.37,
          brightness: 0.68,
        };
        break;
      case "willow":
        n = 270;
        speed = 43;
        config = {
          ...config,
          life: 7.4,
          trail: 1.3,
          trailLife: 2.65,
          drag: 0.33,
          gravity: 6,
          size: 0.49,
        };
        break;
      case "brocade":
        n = 400;
        speed = 40;
        config = {
          ...config,
          life: 5.8,
          trail: 1.5,
          trailLife: 2.05,
          drag: 0.34,
          gravity: 6.1,
          size: 0.6,
        };
        break;
      case "kamuro":
        n = 170;
        speed = 37;
        config = {
          ...config,
          life: 8.6,
          trail: 0.8,
          trailLife: 2.8,
          drag: 0.47,
          gravity: 4.6,
          size: 0.42,
          brightness: 0.73,
        };
        break;
      case "nishiki":
        n = 460;
        speed = 43;
        config = {
          ...config,
          life: 7.9,
          trail: 1.1,
          trailLife: 2.6,
          drag: 0.38,
          gravity: 5.2,
          mode: 2,
          size: 0.47,
          brightness: 1.15,
        };
        break;
      case "palm":
        n = 9;
        speed = 47;
        config = {
          ...config,
          life: 4.5,
          trail: 2.6,
          trailLife: 1.9,
          drag: 0.24,
          gravity: 9.3,
          size: 1.4,
          brightness: 1.5,
        };
        break;
      case "spider":
        n = 24;
        speed = 74;
        config = {
          ...config,
          life: 2.8,
          trail: 1.7,
          trailLife: 1.0,
          drag: 0.85,
          gravity: 5.2,
          size: 0.85,
        };
        break;
      case "ring":
        n = 120;
        speed = 39;
        config.life = 3.5;
        break;
      case "saturn":
        n = 145;
        speed = 49;
        config.life = 3.3;
        break;
      case "heart":
        n = 150;
        speed = 40;
        config.life = 3.7;
        config.gravity = 4.2;
        break;
      case "star":
        n = 140;
        speed = 43;
        config.life = 3.7;
        config.gravity = 4.2;
        break;
      case "spiral":
        n = 180;
        speed = 42;
        config = {
          ...config,
          life: 3.8,
          trail: 0.4,
          trailLife: 0.45,
          gravity: 4.2,
        };
        break;
      case "smiley":
        n = 160;
        speed = 41;
        config.life = 3.8;
        config.gravity = 4.2;
        break;
      case "crossette":
        n = 28;
        speed = 33;
        config = {
          ...config,
          life: 4,
          trail: 1.4,
          trailLife: 0.8,
          splitAt: 1.05,
          size: 0.9,
        };
        break;
      case "crackle":
        n = 130;
        speed = 36;
        config = {
          ...config,
          life: 3.2,
          trail: 0.7,
          trailLife: 0.5,
          splitAt: 1.1,
        };
        break;
      case "strobe":
        n = 245;
        config = { ...config, life: 4.4, size: 0.8, color: s.colors[0] };
        break;
      case "glitter":
        n = 215;
        config = { ...config, life: 4.8, trail: 1, trailLife: 1.7, size: 0.55 };
        break;
      case "falling-leaves":
        n = 95;
        speed = 44;
        config = {
          ...config,
          life: 7.5,
          drag: 0.85,
          gravity: 2.6,
          size: 0.78,
          brightness: 0.85,
        };
        break;
      case "bees":
        n = 62;
        speed = 31;
        config = {
          ...config,
          life: 4.9,
          trail: 0.8,
          trailLife: 0.55,
          drag: 0.72,
          gravity: 3,
          size: 0.7,
        };
        break;
      case "fish":
        n = 54;
        speed = 25;
        config = {
          ...config,
          life: 4.5,
          trail: 1.4,
          trailLife: 0.95,
          drag: 0.56,
          gravity: 4,
          size: 0.63,
        };
        break;
      case "tourbillon":
        n = 20;
        speed = 28;
        config = {
          ...config,
          life: 4.5,
          trail: 2,
          trailLife: 0.8,
          drag: 0.6,
          gravity: 4,
          size: 0.78,
        };
        break;
      case "ghost":
        n = 260;
        config = {
          ...config,
          life: 4.5,
          size: 0.68,
          color2: s.color2,
        };
        break;
      case "color-change":
        n = 280;
        config = {
          ...config,
          life: 4.4,
          color2: s.color2,
          splitAt: 1.65,
        };
        break;
      case "shell-of-shells":
        n = 9;
        speed = 29;
        config = {
          ...config,
          life: 3.3,
          trail: 1.2,
          trailLife: 0.85,
          splitAt: 1.1,
          size: 0.9,
        };
        break;
      case "salute":
        n = 56;
        speed = 24;
        config = {
          ...config,
          life: 0.48,
          size: 1.2,
          brightness: 1.8,
        };
        break;
    }
    const preserveCount = [
      "palm",
      "spider",
      "crossette",
      "shell-of-shells",
    ].includes(id);
    n = Math.max(
      8,
      Math.round(
        n * (preserveCount ? 1 : this.density) * (secondary ? 0.47 : 1),
      ),
    );
    // Allocate complete features rather than clipping fractional ranges of n.
    // Eye holes must survive low-density quality settings.
    const faceCounts =
      id === "smiley"
        ? [
            Math.max(40, Math.round(n * 0.63)),
            Math.max(16, Math.round(n * 0.11)),
            Math.max(16, Math.round(n * 0.11)),
            Math.max(18, Math.round(n * 0.15)),
          ]
        : null;
    if (faceCounts) n = faceCounts.reduce((sum, count) => sum + count, 0);
    const rotation = (rng() - 0.5) * 0.24,
      yaw = (rng() - 0.5) * 0.35;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n,
        a = i * 2.399963229728653 + rng() * 0.07;
      let y = 1 - 2 * u,
        r = Math.sqrt(Math.max(0, 1 - y * y)),
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      let radial = 0.89 + rng() * 0.16;
      let facePart = 0;
      if (
        ["ring", "saturn", "heart", "star", "spiral", "smiley"].includes(id)
      ) {
        const t = u * TAU;
        x = Math.cos(t);
        y = Math.sin(t);
        z = (rng() - 0.5) * 0.025;
        radial = 0.992 + rng() * 0.016;
        if (id === "saturn") {
          y *= 0.45;
          z += Math.sin(t) * 0.52;
        }
        if (id === "heart") {
          x = Math.pow(Math.sin(t), 3);
          y =
            (13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)) /
            16;
        }
        if (id === "star") {
          const v = u * 10,
            k = Math.floor(v),
            f = v - k,
            t0 = Math.PI / 2 + (k * TAU) / 10,
            t1 = t0 + TAU / 10;
          const r0 = k % 2 ? 0.43 : 1,
            r1 = k % 2 ? 1 : 0.43;
          x = Math.cos(t0) * r0 * (1 - f) + Math.cos(t1) * r1 * f;
          y = Math.sin(t0) * r0 * (1 - f) + Math.sin(t1) * r1 * f;
        }
        if (id === "spiral") {
          const t = u * TAU * 2.2;
          x = Math.cos(t) * u;
          y = Math.sin(t) * u;
          z = (u - 0.5) * 0.3;
        }
        if (id === "smiley") {
          let point = i;
          while (point >= faceCounts[facePart]) point -= faceCounts[facePart++];
          const u = (point + 0.5) / faceCounts[facePart];
          if (facePart === 0) {
            x = Math.cos(u * TAU);
            y = Math.sin(u * TAU);
          } else if (facePart < 3) {
            x = (facePart === 1 ? -0.34 : 0.34) + Math.cos(u * TAU) * 0.13;
            y = 0.29 + Math.sin(u * TAU) * 0.15;
          } else {
            const t = u * Math.PI;
            x = -0.51 * Math.cos(t);
            y = -0.12 - Math.sin(t) * 0.4;
          }
        }
        const xx = x * Math.cos(rotation) - y * Math.sin(rotation),
          yy = x * Math.sin(rotation) + y * Math.cos(rotation);
        x = xx * Math.cos(yaw);
        y = yy;
        z += xx * Math.sin(yaw);
      }
      if (id === "palm") {
        const t = (i / n) * TAU + 0.3;
        x = Math.cos(t) * 0.88;
        y = Math.sin(t) * 0.69 + 0.3;
        z = Math.sin(t * 2) * 0.38;
      }
      if (id === "falling-leaves") y = y * 0.3 + 0.15;
      if (id === "horsetail") {
        x = (rng() - 0.5) * 0.45;
        y = 0.18 + rng() * 0.25;
        z = (rng() - 0.5) * 0.25;
        radial = 0.75 + rng() * 0.25;
      }
      this.star(
        s,
        [
          x * speed * scale * radial,
          y * speed * scale * radial + 2.2,
          z * speed * scale * radial,
        ],
        id === "crackle"
          ? { ...config, splitAt: 0.7 + rng() * 1.35 }
          : id === "ghost"
            ? { ...config, phase: (x + 1) * 0.5 }
            : id === "smiley"
              ? {
                  ...config,
                  layer: facePart,
                  color:
                    facePart === 0
                      ? SMILEY_COLOURS.ring
                      : facePart < 3
                        ? SMILEY_COLOURS.eyes
                        : SMILEY_COLOURS.mouth,
                  size: facePart === 1 || facePart === 2 ? 0.6 : 0.63,
                }
              : config,
      );
    }
    if (id === "diadem") {
      const count = Math.round(82 * this.density);
      for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count,
          r = Math.sqrt(1 - y * y),
          t = i * 2.399963;
        this.star(
          s,
          [
            r * Math.cos(t) * 11 * scale,
            y * 11 * scale + 2,
            r * Math.sin(t) * 11 * scale,
          ],
          {
            life: 1.15,
            color: s.coreColors?.[0] || s.colors[0],
            size: 0.75,
            brightness: 1.2,
            mode: 0,
            drag: 0.6,
            gravity: 6,
          },
        );
      }
    }
    if (["pistil", "double-pistil", "multi-pistil", "saturn"].includes(id)) {
      const layers =
        id === "multi-pistil"
          ? [0.68, 0.43, 0.21]
          : id === "double-pistil"
            ? [0.58, 0.27]
            : [id === "saturn" ? 0.42 : 0.48];
      for (let layer = 0; layer < layers.length; layer++) {
        const coreColors = s.coreColors || s.colors,
          color = coreColors[layer % coreColors.length];
        const count = Math.round(
          (id === "multi-pistil" ? [125, 88, 50][layer] : layer ? 70 : 125) *
            this.density,
        );
        for (let i = 0; i < count; i++) {
          const y = 1 - (2 * (i + 0.5)) / count,
            r = Math.sqrt(1 - y * y),
            t = i * 2.399963;
          this.star(
            s,
            [
              r * Math.cos(t) * speed * scale * layers[layer],
              y * speed * scale * layers[layer] + 2.2,
              r * Math.sin(t) * speed * scale * layers[layer],
            ],
            {
              life: id === "multi-pistil" ? 3.9 : 3.3,
              color,
              size: id === "multi-pistil" ? 0.66 - layer * 0.06 : 0.72,
              gravity: 8.2,
              drag: 0.36,
              layer: layer + 1,
            },
          );
        }
      }
    }
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-10 >= STEP) {
      this.step(STEP);
      this.accumulator -= STEP;
    }
  }
  step(dt) {
    this.time += dt;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.age += dt;
      integrateParticle(s, dt, this.wind * 0.2);
      s.trailClock += dt;
      s.smokeClock += dt;
      const trunk = s.effectId === "comet" || s.effectId === "palm";
      const interval = 1 / (trunk ? 85 : 55);
      while (s.trailClock >= interval) {
        s.trailClock -= interval;
        const color = trunk
          ? s.colors[Math.floor(s.rng() * s.colors.length)]
          : [1, 0.5, 0.1];
        this.spark({
          x: s.x,
          y: s.y,
          z: s.z,
          px: s.lastX,
          py: s.lastY,
          pz: s.lastZ,
          vx: (s.rng() - 0.5) * 2,
          vy: -1 - s.rng() * 2,
          vz: (s.rng() - 0.5) * 2,
          life: trunk ? 2.8 : 1.1,
          r: color[0],
          g: color[1],
          b: color[2],
          size: trunk ? 0.6 : 0.5,
          brightness: trunk ? 1.5 : 0.75,
          seed: s.rng() * 500,
          glitter: 0,
        });
        s.lastX = s.x;
        s.lastY = s.y;
        s.lastZ = s.z;
      }
      if (s.smokeClock > 0.18) {
        s.smokeClock = 0;
        this.puff(s.x, s.y, s.z, s.rng, 2.5, 0.1);
      }
      if (s.age >= s.fuse || s.vy < 2) {
        this.shells.splice(i, 1);
        if (s.effectId !== "comet") this.burst(s);
      }
    }
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.age += dt;
      e.clock += dt;
      this.updateEmitter(e);
      if (e.age >= e.duration) this.emitters.splice(i, 1);
    }
    for (let i = this.pending.length - 1; i >= 0; i--)
      if (this.pending[i].at <= this.time) {
        const p = this.pending.splice(i, 1)[0];
        this.burst(p.shell, true);
      }
    this.updateStars(dt);
    this.updateSparks(dt);
    if (this.skyEmpty()) this.launchDepth = -125;
    this.smokeClock += dt;
    if (this.smokeClock >= 0.25 && this.stars.count) {
      this.smokeClock = 0;
      const rng = seededRandom(Math.round(this.time * 120) * 104729),
        p = this.stars;
      const count = Math.min(15, Math.ceil(p.count / 35));
      for (let j = 0; j < count; j++) {
        const i = Math.floor(rng() * p.count);
        this.puff(p.x[i], p.y[i], p.z[i], rng, 4 + rng() * 4, 0.2);
      }
    }
    const m = this.smoke;
    for (let i = m.count - 1; i >= 0; i--) {
      m.age[i] += dt;
      if (m.age[i] >= m.life[i]) {
        m.remove(i);
        continue;
      }
      m.x[i] += m.vx[i] * dt;
      m.y[i] += m.vy[i] * dt;
      m.z[i] += m.vz[i] * dt;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].age += dt;
      if (this.flashes[i].age >= this.flashes[i].life)
        this.flashes.splice(i, 1);
    }
  }
  spark(v) {
    if (this.sparks.add(v) < 0) this.metrics.droppedParticles++;
  }
  updateEmitter(e) {
    const rng = e.rng,
      id = e.effectId;
    if (
      ["fountain", "waterfall", "wheel"].includes(id) &&
      !e.soundRenewed &&
      e.age >= 3.25
    ) {
      e.soundRenewed = true;
      this.emit(
        "fountain",
        id,
        e.x,
        id === "waterfall" ? 103 : e.y,
        e.z,
        e.scale,
      );
    }
    if (id === "set-piece") {
      if (e.shot) return;
      e.shot = 1;
      // Sixty stationary lances describe one original low five-point figure.
      for (let i = 0; i < 60; i++) {
        const v = (i / 60) * 10,
          k = Math.floor(v),
          f = v - k,
          t0 = Math.PI / 2 + (k * TAU) / 10,
          t1 = t0 + TAU / 10,
          r0 = k % 2 ? 0.45 : 1,
          r1 = k % 2 ? 1 : 0.45;
        const x =
          e.x +
          (Math.cos(t0) * r0 * (1 - f) + Math.cos(t1) * r1 * f) * 28 * e.scale;
        const y =
          e.y +
          (Math.sin(t0) * r0 * (1 - f) + Math.sin(t1) * r1 * f) * 28 * e.scale;
        this.star({ ...e, x, y }, [0, 0, 0], {
          fixedLife: e.duration,
          mode: 11,
          trail: 0,
          gravity: 0,
          drag: 1,
          size: 0.87,
          color: e.colors[Math.floor(i / 12) % e.colors.length],
          brightness: 1.4,
        });
      }
      return;
    }
    if (id === "wheel") {
      e.rotation = e.age * 4.3;
      const interval = 1 / (135 * this.density);
      while (e.clock >= interval && e.age < e.duration) {
        e.clock -= interval;
        const arm = e.shot++ % 3,
          angle = e.rotation + (arm * TAU) / 3,
          radius = 7.5 * e.scale;
        const x = e.x + Math.cos(angle) * radius,
          y = e.y + Math.sin(angle) * radius,
          speed = (17 + rng() * 11) * e.scale;
        const tangent = angle + Math.PI * 0.41;
        this.star(
          { ...e, x, y },
          [
            Math.cos(tangent) * speed,
            Math.sin(tangent) * speed,
            (rng() - 0.5) * 5,
          ],
          {
            life: 1.25 + rng() * 0.5,
            trail: 1.2,
            trailLife: 0.48,
            drag: 0.5,
            gravity: 9.81,
            size: 0.44,
            color: e.colors[arm % e.colors.length],
          },
        );
      }
      return;
    }
    if (id === "roman-candle") {
      if (e.age >= e.shot * 0.85 && e.shot < 7) {
        const s = {
          ...e,
          y: 3,
          age: 0,
          vy: (47 + e.shot * 3) * e.scale,
          vx: (rng() - 0.5) * 5,
          vz: 0,
          fuse: 3.4,
          trailClock: 0,
          smokeClock: 0,
          effectId: "comet",
          lastX: e.x,
          lastY: 3,
          lastZ: e.z,
        };
        s.colors = [e.colors[e.shot % e.colors.length]];
        this.shells.push(s);
        this.emit("comet", "roman-candle", e.x, 3, e.z, e.scale * 0.75);
        e.shot++;
      }
      return;
    }
    if (id === "mine" || id === "fan") {
      if (e.shot) return;
      e.shot++;
      const count = Math.round((id === "mine" ? 210 : 175) * this.density);
      for (let i = 0; i < count; i++) {
        const lane =
            id === "fan" ? ((i % 7) - 3) * 0.185 : (rng() - 0.5) * 0.95,
          speed = (34 + rng() * 44) * e.scale;
        const x = id === "fan" ? e.x + ((i % 7) - 3) * 9 : e.x;
        this.star(
          { ...e, x },
          [Math.sin(lane) * speed, Math.cos(lane) * speed, (rng() - 0.5) * 17],
          {
            life: 2.0 + rng(),
            trail: id === "fan" ? 1.4 : 0.5,
            trailLife: 1.0,
            size: 0.7,
            drag: 0.18,
            gravity: 9.81,
          },
        );
      }
      this.flash({ ...e, y: 7 }, 0.4);
      this.puff(e.x, 7, e.z, rng, 9, 0.2);
      return;
    }
    const rate = (id === "waterfall" ? 155 : 115) * this.density,
      interval = 1 / rate;
    while (e.clock >= interval && e.age < e.duration) {
      e.clock -= interval;
      if (id === "waterfall") {
        const x = e.x + (rng() - 0.5) * 172 * e.scale,
          y = 103 + (rng() - 0.5) * 0.8;
        this.star(
          { ...e, x, y },
          [(rng() - 0.5) * 2, -2 - rng() * 5, (rng() - 0.5) * 2],
          {
            life: 4 + rng(),
            trail: 1.1,
            trailLife: 1.1,
            drag: 0.3,
            gravity: 7,
            size: 0.35,
            color: e.colors[Math.floor(rng() * e.colors.length)],
          },
        );
      } else {
        const theta = rng() * TAU,
          r = rng() * 4.7,
          speed = (14 + rng() * 22) * e.scale,
          taper = Math.min(1, e.age * 2, (e.duration - e.age) * 1.5);
        this.star(
          e,
          [Math.cos(theta) * r, speed * taper, Math.sin(theta) * r],
          {
            life: 1.3 + rng() * 1.3,
            trail: 1.3,
            trailLife: 0.65,
            drag: 0.22,
            gravity: 9.81,
            size: 0.42,
          },
        );
      }
    }
    if (Math.floor(e.age * 4) > e.shot) {
      e.shot = Math.floor(e.age * 4);
      this.puff(e.x, id === "waterfall" ? 98 : 5, e.z, rng, 4, 0.14);
    }
  }
  updateStars(dt) {
    const p = this.stars;
    for (let i = p.count - 1; i >= 0; i--) {
      p.age[i] += dt;
      const age = p.age[i],
        mode = p.mode[i],
        seed = p.seed[i];
      if (age >= p.life[i] || p.y[i] < 0.3) {
        p.remove(i);
        continue;
      }
      if (mode === 11) continue; // Mounted lancework stays fixed even in strong wind.
      const k = p.drag[i],
        g = p.gravity[i],
        e = Math.exp(-k * dt),
        a = k > 1e-6 ? (1 - e) / k : dt;
      if (mode === 4 || mode === 5 || mode === 6) {
        const f = mode === 4 ? 6.5 : mode === 5 ? 5 : 7.5,
          force = mode === 6 ? 105 : mode === 4 ? 32 : 25;
        p.vx[i] += Math.sin(age * f + seed) * force * dt;
        p.vy[i] += Math.cos(age * f * 0.87 + seed) * force * 0.63 * dt;
        p.vz[i] += Math.cos(age * f * 0.72 + seed) * force * 0.72 * dt;
      }
      if (EFFECT_IDS[p.effect[i]] === "falling-leaves") {
        p.vx[i] += Math.sin(age * 2.1 + seed) * 3 * dt;
        p.vz[i] += Math.cos(age * 1.7 + seed) * 3 * dt;
      }
      p.x[i] += this.wind * dt + (p.vx[i] - this.wind) * a;
      p.y[i] += (p.vy[i] + g / k) * a - (g * dt) / k;
      p.z[i] += p.vz[i] * a;
      p.vx[i] = this.wind + (p.vx[i] - this.wind) * e;
      p.vy[i] = (p.vy[i] + g / k) * e - g / k;
      p.vz[i] *= e;
      if ((mode === 7 || mode === 8 || mode === 9) && age >= p.splitAt[i]) {
        const rng = seededRandom(Math.floor(seed * 100003)),
          id = EFFECT_IDS[p.effect[i]],
          s = {
            x: p.x[i],
            y: p.y[i],
            z: p.z[i],
            rng,
            colors: [[p.r[i], p.g[i], p.b[i]]],
            trailColor: p.fixedTrailColor[i]
              ? [p.trailR[i], p.trailG[i], p.trailB[i]]
              : undefined,
            color2: [p.r2[i], p.g2[i], p.b2[i]],
            effectId: id,
            scale: 0.6,
          };
        this.metrics.secondaryBursts++;
        if (mode === 8) {
          // Satellites travel outward first, then each becomes a separate small shell.
          s.sourceEffectId = "shell-of-shells";
          s.effectId = "chrysanthemum";
          s.scale = 0.5;
          this.pending.push({ at: this.time + rng() * 0.34, shell: s });
        } else {
          const n = mode === 7 ? 4 : Math.round(9 * this.density),
            base = rng() * TAU;
          for (let j = 0; j < n; j++) {
            const t = base + (j / n) * TAU,
              sp = mode === 7 ? 18 : 5 + rng() * 7;
            this.star(
              s,
              [
                p.vx[i] * 0.25 + Math.cos(t) * sp,
                p.vy[i] * 0.25 + Math.sin(t) * sp,
                (rng() - 0.5) * sp * 0.35,
              ],
              {
                mode: 0,
                life: mode === 7 ? 1.7 : 0.2 + rng() * 0.35,
                trail: mode === 7 ? 1.3 : 0,
                trailLife: 0.6,
                size: mode === 7 ? 0.63 : 0.52,
                color: s.colors[0],
                brightness: 1.3,
              },
            );
          }
          if ((mode === 9 && i % 11 === 0) || (mode === 7 && i % 7 === 0))
            this.emit("crackle", id, s.x, s.y, s.z, mode === 7 ? 0.65 : 0.55);
        }
        p.remove(i);
        continue;
      }
      if (p.trail[i] > 0) {
        p.trailClock[i] += dt;
        const interval = 1 / (29 * this.density * Math.min(1.8, p.trail[i]));
        while (p.trailClock[i] >= interval) {
          p.trailClock[i] -= interval;
          const fade = clamp((p.life[i] - age) / 1.0, 0, 1),
            hash = Math.sin(seed * 12.93 + age * 73.1) * 43758.54,
            noise = hash - Math.floor(hash);
          const life = p.trailLife[i] * (0.67 + noise * 0.6),
            glitter = mode === 2 ? 1 : 0,
            changed =
              !p.fixedTrailColor[i] && mode === 10 && age > p.splitAt[i];
          // Filaments remain in world space; their hot residue drifts and settles.
          this.spark({
            x: p.x[i],
            y: p.y[i],
            z: p.z[i],
            px: p.lastX[i],
            py: p.lastY[i],
            pz: p.lastZ[i],
            vx: p.vx[i] * 0.022 + (noise - 0.5) * 0.7,
            vy: p.vy[i] * 0.024,
            vz: p.vz[i] * 0.024,
            life,
            r: changed ? p.r2[i] : p.trailR[i],
            g: changed ? p.g2[i] : p.trailG[i],
            b: changed ? p.b2[i] : p.trailB[i],
            size: 0.22 + noise * 0.2,
            brightness: p.brightness[i] * fade * Math.min(1.6, p.trail[i]),
            seed: seed + age * 31,
            glitter,
          });
          p.lastX[i] = p.x[i];
          p.lastY[i] = p.y[i];
          p.lastZ[i] = p.z[i];
        }
      }
    }
  }
  updateSparks(dt) {
    const p = this.sparks;
    for (let i = p.count - 1; i >= 0; i--) {
      p.age[i] += dt;
      if (p.age[i] >= p.life[i] || p.y[i] < 0.2) {
        p.remove(i);
        continue;
      }
      const dx = (p.vx[i] + this.wind * 0.32) * dt,
        dy = p.vy[i] * dt,
        dz = p.vz[i] * dt;
      p.x[i] += dx;
      p.px[i] += dx;
      p.y[i] += dy;
      p.py[i] += dy;
      p.z[i] += dz;
      p.pz[i] += dz;
      p.vy[i] -= 2.0 * dt;
      p.vx[i] *= 1 - 0.5 * dt;
      p.vz[i] *= 1 - 0.5 * dt;
    }
  }
}
