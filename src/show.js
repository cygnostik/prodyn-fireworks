import { EFFECT_BY_ID, PALETTES } from "./data/catalog.js";

export const MAX_LAYERS = 12;
export const STORAGE_KEY = "afterlight.show.v1";
const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));
let nextId = 0;
export function createLayer(effectId, palette = "signature", density = 1) {
  if (typeof effectId !== "string" || !Object.hasOwn(EFFECT_BY_ID, effectId))
    throw new TypeError("Unknown firework");
  return {
    id: `l-${Date.now().toString(36)}-${(++nextId).toString(36)}`,
    effectId,
    palette,
    density,
  };
}
export function validateShow(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.version !== 1
  )
    throw new TypeError("This is not an Afterlight show (version 1).");
  if (typeof input.title !== "string" || input.title.length > 64)
    throw new TypeError("Show titles can have up to 64 characters.");
  if (
    !Number.isFinite(input.duration) ||
    input.duration < 12 ||
    input.duration > 45
  )
    throw new TypeError("Choose a finale between 12 and 45 seconds.");
  if (!Array.isArray(input.layers) || input.layers.length > MAX_LAYERS)
    throw new TypeError(`A finale can hold ${MAX_LAYERS} layers.`);
  const ids = new Set();
  const layers = input.layers.map((l, i) => {
    if (
      !l ||
      typeof l !== "object" ||
      Array.isArray(l) ||
      typeof l.effectId !== "string" ||
      !Object.hasOwn(EFFECT_BY_ID, l.effectId)
    )
      throw new TypeError(`Unknown firework in layer ${i + 1}.`);
    if (!PALETTE_IDS.has(l.palette))
      throw new TypeError(`Unknown colour in layer ${i + 1}.`);
    if (!Number.isInteger(l.density) || l.density < 1 || l.density > 3)
      throw new TypeError(`Invalid density in layer ${i + 1}.`);
    if (
      typeof l.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(l.id) ||
      ids.has(l.id)
    )
      throw new TypeError("Each layer needs a unique identifier.");
    ids.add(l.id);
    return {
      id: l.id,
      effectId: l.effectId,
      palette: l.palette,
      density: l.density,
    };
  });
  return {
    version: 1,
    title: input.title.trim(),
    duration: input.duration,
    layers,
  };
}
export function encodeShow(show) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateShow(show)));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeShow(text) {
  if (
    typeof text !== "string" ||
    text.length > 16384 ||
    !/^[a-zA-Z0-9_-]+$/.test(text)
  )
    throw new TypeError("The shared show link is invalid or too large.");
  try {
    return validateShow(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(
            atob(text.replaceAll("-", "+").replaceAll("_", "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      ),
    );
  } catch (error) {
    throw new TypeError(`Could not open this show: ${error.message}`);
  }
}
export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = t;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function buildFinale(layers, { duration = 20, seed = 42 } = {}) {
  const show = validateShow({ version: 1, title: "", duration, layers });
  const random = rng(seed),
    cues = [];
  for (const [lane, l] of show.layers.entries()) {
    const count = 5 + l.density * 3;
    const delay = (lane / Math.max(1, layers.length)) * duration * 0.18;
    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      const at = delay + (duration - delay) * Math.pow(progress, 0.73);
      const side = i % 2 === 0 ? -1 : 1;
      const width = 0.22 + 0.74 * progress;
      cues.push({
        at: Number(at.toFixed(4)),
        layerId: l.id,
        effectId: l.effectId,
        palette: l.palette,
        variation: lane * 16 + i,
        position: side * width * (0.55 + random() * 0.45),
        scale: 0.82 + progress * 0.36 + random() * 0.16,
        loft: 0.84 + (lane % 3) * 0.11,
        seed: Math.floor(random() * 2147483647),
      });
    }
  }
  return cues.sort((a, b) => a.at - b.at);
}

export class ShowPlayer {
  constructor(onCue, onFinish = () => {}) {
    this.onCue = onCue;
    this.onFinish = onFinish;
    this.stop();
  }
  start(layers, options = {}) {
    this.cues = buildFinale(layers, options);
    this.duration = options.duration || 20;
    this.elapsed = 0;
    this.index = 0;
    this.running = this.cues.length > 0;
    this.update(0);
    return this.cues.length;
  }
  update(dt) {
    if (!this.running) return;
    this.elapsed += Math.max(0, dt);
    while (
      this.index < this.cues.length &&
      this.cues[this.index].at <= this.elapsed
    ) {
      this.onCue(this.cues[this.index++]);
    }
    if (this.index === this.cues.length) {
      this.running = false;
      this.onFinish();
    }
  }
  stop() {
    this.running = false;
    this.cues = [];
    this.index = 0;
    this.elapsed = 0;
    this.duration = 0;
  }
  get progress() {
    return this.duration ? Math.min(1, this.elapsed / this.duration) : 0;
  }
}

export function readSaved(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw
      ? { show: validateShow(JSON.parse(raw)), error: null }
      : { show: null, error: null };
  } catch (error) {
    return { show: null, error };
  }
}
export function saveShow(storage, show) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(validateShow(show)));
    return true;
  } catch {
    return false;
  }
}
export const PRESETS = [
  {
    name: "Golden hour",
    description: "Soft palms, deep brocades, long golden rain.",
    duration: 22,
    types: [
      ["palm", "gold"],
      ["brocade", "gold"],
      ["willow", "gold"],
      ["nishiki", "gold"],
    ],
  },
  {
    name: "Electric garden",
    description:
      "Colour, branching stars and constellations within constellations.",
    duration: 20,
    types: [
      ["dahlia", "violet"],
      ["crossette", "jade"],
      ["pistil", "azure"],
      ["shell-of-shells", "multicolor"],
    ],
  },
  {
    name: "A sky full of everything",
    description: "A layered build from low fans to a sky-wide finish.",
    duration: 28,
    types: [
      ["fan", "gold"],
      ["chrysanthemum", "ruby"],
      ["saturn", "azure"],
      ["crackle", "silver"],
      ["nishiki", "gold"],
      ["shell-of-shells", "multicolor"],
    ],
  },
];
