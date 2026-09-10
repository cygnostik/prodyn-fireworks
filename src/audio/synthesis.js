// SPDX-License-Identifier: MIT
// Original procedural audio. No sampled recordings, impulse responses, or assets.
export const SPEED_OF_SOUND = 343; // m/s; authored still-air approximation, ~20 °C.
export const SYNTHESIS_VERSION = 1;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const SIGNATURES = Object.freeze({
  launch: Object.freeze({
    duration: 1.5,
    peak: 0.76,
    layers: ["transient", "body", "air", "tail"],
  }),
  burst: Object.freeze({
    duration: 3.8,
    peak: 0.88,
    layers: ["transient", "body", "air", "tail"],
  }),
  salute: Object.freeze({
    duration: 4.2,
    peak: 0.9,
    layers: ["transient", "body", "tail"],
  }),
  crackle: Object.freeze({
    duration: 2.8,
    peak: 0.7,
    layers: ["crackle", "air", "tail"],
  }),
  sizzle: Object.freeze({ duration: 3, peak: 0.26, layers: ["air"] }),
  whistle: Object.freeze({
    duration: 2.4,
    peak: 0.44,
    layers: ["whistle", "air", "tail"],
  }),
  fountain: Object.freeze({
    duration: 3.6,
    peak: 0.4,
    layers: ["air", "crackle"],
  }),
  comet: Object.freeze({
    duration: 1.8,
    peak: 0.48,
    layers: ["transient", "body", "air", "tail"],
  }),
});

/** Stable PRNG, not cryptographic. Its only inputs are the supplied integer seed. */
export function randomGenerator(seed = 1) {
  if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
  let state = seed >>> 0 || 0x61c88647;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function validatePosition(position) {
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every(Number.isFinite)
  ) {
    throw new TypeError("position must be three finite meter coordinates");
  }
}

/** Listener orientation is fixed toward -Z; panning is a bounded azimuth cue. */
export function propagation(position, listener = [0, 70, 400]) {
  validatePosition(position);
  validatePosition(listener);
  const [x, y, z] = position.map((v, i) => v - listener[i]);
  const distance = Math.hypot(x, y, z);
  return {
    distance,
    delay: distance / SPEED_OF_SOUND,
    // Mix-friendly distance curve, NOT a calibrated SPL / ISO atmosphere model.
    gain: 1 / (1 + distance / 220),
    lowpassHz: clamp(18000 / (1 + distance / 260), 1000, 18000),
    pan: clamp(x / Math.max(40, Math.hypot(x, z)), -0.92, 0.92),
  };
}

/** Explicit sound-event routing: no automatic whistles or extra burst on a lift. */
export function signatureForEvent(event) {
  if (
    !event ||
    !["launch", "burst", "crackle", "whistle", "fountain", "comet"].includes(
      event.kind,
    )
  )
    return null;
  if (event.kind === "burst") {
    const id = String(event.effectId ?? "").toLowerCase();
    return /(^|[-_ ])(salute|maroon)([-_ ]|$)/.test(id) || id === "whitesalute"
      ? "salute"
      : "burst";
  }
  if (event.kind === "comet" && event.effectId === "roman-candle")
    return "launch";
  return event.kind;
}

function lowpass(cutoff, sampleRate) {
  const a = 1 - Math.exp((-TAU * cutoff) / sampleRate);
  let y = 0;
  return (x) => (y += a * (x - y));
}

/** Smooth finite-end envelope; attack and release in seconds. */
function gate(t, duration, attack, release) {
  return clamp(t / attack, 0, 1) * clamp((duration - t) / release, 0, 1);
}

function addNoise(
  track,
  sampleRate,
  rng,
  {
    start = 0,
    end,
    gain = 1,
    low = 20,
    high = 10000,
    decay = 1,
    attack = 0.002,
    sustained = false,
  },
) {
  const floor = lowpass(low, sampleRate);
  const ceiling = lowpass(Math.min(high, sampleRate * 0.44), sampleRate);
  const begin = Math.round(start * sampleRate);
  const finish = Math.min(track.length, Math.ceil(end * sampleRate));
  for (let i = begin; i < finish; i++) {
    const t = i / sampleRate - start;
    const n = rng() * 2 - 1;
    const band = ceiling(n) - floor(n);
    const flutter = sustained
      ? 0.73 + 0.17 * Math.sin(t * 13.3) + 0.1 * Math.sin(t * 39.1)
      : 1;
    track[i] +=
      gain *
      band *
      gate(t, end - start, attack, 0.16) *
      Math.exp(-t / decay) *
      flutter;
  }
}

function addThump(track, sampleRate, { gain, frequency, decay, sweep }) {
  let phase = 0;
  for (let i = 0; i < track.length; i++) {
    const t = i / sampleRate;
    // Broad, low body with a falling resonance, not a sustained musical kick.
    phase += (TAU * (frequency + sweep * Math.exp(-t / 0.065))) / sampleRate;
    const envelope = (1 - Math.exp(-t / 0.0018)) * Math.exp(-t / decay);
    track[i] +=
      gain *
      envelope *
      (Math.sin(phase) + 0.19 * Math.sin(phase * 1.71) * Math.exp(-t / 0.1));
  }
}

function addGrains(track, sampleRate, rng, { start, end, density, gain }) {
  let t = start;
  const markers = [];
  while (t < end) {
    // Exponential inter-arrivals avoid a machine-gun metronome.
    t += Math.max(0.002, -Math.log(Math.max(1e-8, 1 - rng())) / density);
    if (t >= end) break;
    const duration = 0.009 + rng() * 0.031;
    const amplitude =
      gain *
      (0.3 + 0.7 * rng()) *
      (0.4 + 0.6 * (1 - (t - start) / (end - start)));
    const offset = Math.round(t * sampleRate);
    const lp = lowpass(1500 + rng() * 3800, sampleRate);
    const hz = 700 + rng() * 1900;
    const length = Math.ceil(duration * sampleRate);
    for (let j = 0; j < length && offset + j < track.length; j++) {
      const q = j / sampleRate;
      const noise = rng() * 2 - 1;
      const tick = 0.62 * (noise - lp(noise)) + 0.38 * Math.sin(TAU * hz * q);
      track[offset + j] +=
        amplitude *
        tick *
        gate(q, duration, 0.00025, 0.003) *
        Math.exp(-q / (duration * 0.17));
    }
    markers.push(t);
  }
  return markers;
}

/**
 * Pure deterministic stereo Float32 PCM. Numeric choices are authored ear-cue
 * approximations, not measured pressure traces. Optional `layers` isolates stems.
 * Runtime buffers share this exact synthesis with the shipped offline WAV pack.
 */
export function synthesize(
  signature,
  { sampleRate = 48000, seed = 1009, layers } = {},
) {
  const config = SIGNATURES[signature];
  if (!config) throw new RangeError(`Unknown signature: ${signature}`);
  if (!Number.isInteger(sampleRate) || sampleRate < 16000 || sampleRate > 96000)
    throw new RangeError("sampleRate must be an integer from 16000 to 96000");
  if (
    layers &&
    (!Array.isArray(layers) ||
      !layers.every((name) => config.layers.includes(name)))
  )
    throw new RangeError("Invalid layer selection");
  const rng = randomGenerator(seed);
  const n = Math.round(config.duration * sampleRate);
  const tracks = Object.fromEntries(
    config.layers.map((name) => [name, new Float32Array(n)]),
  );
  const explosive = ["launch", "burst", "salute", "comet"].includes(signature);
  let grains = [];

  if (explosive) {
    const large = signature === "burst" || signature === "salute";
    const hot = signature === "salute";
    const light = signature === "comet";
    addNoise(tracks.transient, sampleRate, rng, {
      end: 0.18,
      low: hot ? 850 : 250,
      high: hot ? 17500 : 12000,
      gain: hot ? 3.1 : large ? 1.8 : light ? 0.4 : 0.75,
      attack: hot ? 0.00015 : 0.00045,
      decay: hot ? 0.006 : large ? 0.012 : 0.016,
    });
    // A short bipolar pressure-like click beneath the noise snap.
    for (let i = 0; i < Math.min(n, sampleRate * 0.06); i++) {
      const t = i / sampleRate;
      const tau = hot ? 0.0018 : large ? 0.0035 : 0.005;
      tracks.transient[i] +=
        (large ? 0.72 : 0.34) *
        (1 - t / tau) *
        Math.exp(-t / tau) *
        Math.min(1, t / 0.0002);
    }
    addThump(tracks.body, sampleRate, {
      gain: hot ? 0.64 : large ? 0.81 : light ? 0.25 : 0.62,
      frequency: hot ? 43 : large ? 48 : light ? 86 : 69,
      decay: hot ? 0.29 : large ? 0.27 : light ? 0.075 : 0.12,
      sweep: large ? 38 : 76,
    });
    addNoise(tracks.body, sampleRate, rng, {
      end: large ? 2 : 0.8,
      low: 28,
      high: large ? 340 : 540,
      gain: large ? 1.8 : 0.8,
      decay: large ? 0.29 : 0.105,
    });
    if (tracks.air)
      addNoise(tracks.air, sampleRate, rng, {
        start: large ? 0.045 : 0.018,
        end: large ? 2.5 : config.duration - 0.12,
        low: 1500,
        high: 10500,
        gain: large ? 0.038 : light ? 0.13 : 0.095,
        decay: large ? 0.75 : 0.24,
        attack: 0.016,
      });
  }

  if (signature === "crackle") {
    grains = addGrains(tracks.crackle, sampleRate, rng, {
      start: 0.012,
      end: 2.4,
      density: 74,
      gain: 0.93,
    });
    addNoise(tracks.air, sampleRate, rng, {
      start: 0,
      end: 2.5,
      low: 2600,
      high: 11500,
      gain: 0.035,
      decay: 1.1,
      attack: 0.02,
    });
  }
  if (signature === "sizzle" || signature === "fountain") {
    addNoise(tracks.air, sampleRate, rng, {
      end: config.duration - 0.02,
      low: signature === "sizzle" ? 2800 : 520,
      high: 13000,
      gain: signature === "sizzle" ? 0.13 : 0.36,
      decay: signature === "sizzle" ? 0.9 : 10,
      attack: signature === "sizzle" ? 0.018 : 0.06,
      sustained: signature === "fountain",
    });
    if (tracks.crackle)
      grains = addGrains(tracks.crackle, sampleRate, rng, {
        start: 0.06,
        end: 3.3,
        density: 13,
        gain: 0.11,
      });
  }
  if (signature === "whistle") {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const progress = t / config.duration;
      const frequency =
        1850 +
        820 * Math.sin(progress * Math.PI * 0.9) -
        550 * progress +
        36 * Math.sin(t * 46);
      phase += (TAU * frequency) / sampleRate;
      const env =
        gate(t, config.duration, 0.065, 0.22) *
        (0.82 + 0.18 * Math.sin(t * 28));
      tracks.whistle[i] =
        0.28 * env * (Math.sin(phase) + 0.13 * Math.sin(2 * phase));
    }
    addNoise(tracks.air, sampleRate, rng, {
      end: config.duration,
      low: 1800,
      high: 7000,
      gain: 0.029,
      decay: 9,
      attack: 0.035,
    });
  }

  // Authored diffuse outdoor-style tail: irregular reflection taps plus rolling
  // filtered noise, NOT a recording/convolution of a real location.
  const tailRight = tracks.tail ? new Float32Array(n) : null;
  if (tracks.tail) {
    const large = signature === "burst" || signature === "salute";
    const drive = tracks.transient ?? tracks.crackle ?? tracks.whistle;
    const reflections = large ? 17 : 7;
    for (let tap = 0; tap < reflections; tap++) {
      const time =
        (large ? 0.105 : 0.065) + tap * (large ? 0.103 : 0.052) + rng() * 0.055;
      const gain =
        (large ? 0.23 : 0.075) *
        Math.exp(-time / (large ? 0.6 : 0.25)) *
        (0.5 + rng() * 0.5);
      for (const channel of [tracks.tail, tailRight]) {
        const offset = Math.round((time + rng() * 0.016) * sampleRate);
        const filter = lowpass(large ? 1500 : 2400, sampleRate);
        const sign = rng() > 0.5 ? 1 : -1;
        for (let i = offset; i < n; i++)
          channel[i] += sign * gain * filter(drive[i - offset]);
      }
    }
    if (large) {
      for (const channel of [tracks.tail, tailRight]) {
        addNoise(channel, sampleRate, rng, {
          start: 0.045,
          end: config.duration,
          gain: 0.8,
          low: 38,
          high: 650,
          decay: 0.62,
          attack: 0.08,
          sustained: true,
        });
      }
    }
  }

  const channels = [new Float32Array(n), new Float32Array(n)];
  const selected = layers ?? config.layers;
  for (const name of selected) {
    for (let i = 0; i < n; i++) {
      channels[0][i] += tracks[name][i];
      channels[1][i] += name === "tail" ? tailRight[i] : tracks[name][i];
    }
  }
  // DC blocker and short edge fades; scale DOWN only (preserve faint trails).
  const dcAlpha = Math.exp((-TAU * 12) / sampleRate);
  let peak = 0;
  for (const channel of channels) {
    let previousInput = 0,
      previousOutput = 0;
    for (let i = 0; i < n; i++) {
      const input = channel[i];
      const value = input - previousInput + dcAlpha * previousOutput;
      previousInput = input;
      previousOutput = value;
      const edge = Math.min(
        1,
        i / (sampleRate * 0.00015),
        (n - 1 - i) / (sampleRate * 0.04),
      );
      channel[i] = edge === 0 ? 0 : value * edge;
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  const scale = peak > config.peak ? config.peak / peak : 1;
  if (scale < 1)
    for (const channel of channels)
      for (let i = 0; i < n; i++) channel[i] *= scale;
  return {
    signature,
    seed,
    sampleRate,
    duration: n / sampleRate,
    channels,
    layers: [...selected],
    markers: { grains },
  };
}

/** Machine signal evidence; not a listening or perceptual-realism test. */
export function analyzePCM({ channels, sampleRate }) {
  let sum = 0,
    square = 0,
    peak = 0,
    nonFinite = 0,
    clipped = 0,
    count = 0;
  let early = 0,
    late = 0,
    earlyCount = 0,
    lateCount = 0,
    derivative = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const v = channel[i];
      count++;
      if (!Number.isFinite(v)) {
        nonFinite++;
        continue;
      }
      sum += v;
      square += v * v;
      peak = Math.max(peak, Math.abs(v));
      if (Math.abs(v) >= 1) clipped++;
      if (i < sampleRate * 0.2) {
        early += v * v;
        earlyCount++;
      }
      if (i >= channel.length * 0.75) {
        late += v * v;
        lateCount++;
      }
      if (i) derivative += (v - channel[i - 1]) ** 2;
    }
  }
  return {
    duration: channels[0].length / sampleRate,
    frames: channels[0].length,
    sampleRate,
    channels: channels.length,
    peak,
    rms: Math.sqrt(square / count),
    dc: sum / count,
    nonFinite,
    clipped,
    earlyRms: Math.sqrt(early / earlyCount),
    lateRms: Math.sqrt(late / lateCount),
    brightness: Math.sqrt(derivative / Math.max(1e-20, square)),
  };
}

/** Uncompressed signed 16-bit little-endian stereo/mono RIFF/WAVE encoder. */
export function encodeWav({ channels, sampleRate }) {
  if (
    !channels.length ||
    channels.length > 2 ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 1
  )
    throw new TypeError("Invalid PCM format");
  const frames = channels[0].length;
  if (!channels.every((c) => c.length === frames))
    throw new RangeError("PCM channel lengths must match");
  const dataBytes = frames * channels.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at, s) =>
    [...s].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < frames; frame++)
    for (let c = 0; c < channels.length; c++) {
      const value = channels[c][frame];
      if (!Number.isFinite(value) || Math.abs(value) > 1)
        throw new RangeError("WAV input must be finite and unclipped");
      view.setInt16(
        44 + (frame * channels.length + c) * 2,
        Math.round(value * (value < 0 ? 32768 : 32767)),
        true,
      );
    }
  return bytes;
}
