// SPDX-License-Identifier: MIT
import { randomGenerator } from "./synthesis.js";

// Mirror the current emitter lifetimes; additive emitterDuration/age metadata
// is authoritative when supplied. No simulation clocks or travel delays change.
export const SIZZLE_DURATIONS = Object.freeze({ fountain: 6.5, waterfall: 6 });
export const MAX_SIZZLE_VOICES = 8;
const TAU = 2 * Math.PI;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * A fresh finite noise bed, not a loop, repeated grain sample, oscillator or LFO.
 * Quiet interpolated random drift avoids the old two periodic flutter tones.
 * Generate mono; the existing spatial panner places each source in the sky.
 */
export function synthesizeSizzle(
  effectId,
  { sampleRate = 48000, seed = 1, duration = SIZZLE_DURATIONS[effectId] } = {},
) {
  if (!SIZZLE_DURATIONS[effectId])
    throw new RangeError("Unknown continuous effect");
  if (!Number.isInteger(sampleRate) || sampleRate < 16000 || sampleRate > 96000)
    throw new RangeError("Invalid sample rate");
  if (!Number.isFinite(duration) || duration <= 0 || duration > 12)
    throw new RangeError("Invalid sizzle duration");
  const rng = randomGenerator(seed);
  const frames = Math.max(1, Math.round(duration * sampleRate));
  const channel = new Float32Array(frames);
  const waterfall = effectId === "waterfall";
  const lowA = 1 - Math.exp((-TAU * (waterfall ? 1450 : 850)) / sampleRate);
  const highA = 1 - Math.exp((-TAU * (waterfall ? 10500 : 9500)) / sampleRate);
  let low = 0,
    high = 0,
    driftFrom = 1,
    driftTo = 0.92 + rng() * 0.16;
  let knotStart = 0,
    knotEnd = Math.round((0.38 + rng() * 0.63) * sampleRate);
  for (let i = 0; i < frames; i++) {
    if (i >= knotEnd) {
      driftFrom = driftTo;
      driftTo = 0.92 + rng() * 0.16;
      knotStart = knotEnd;
      knotEnd += Math.round((0.38 + rng() * 0.63) * sampleRate);
    }
    const q = (i - knotStart) / (knotEnd - knotStart);
    const drift = driftFrom + (driftTo - driftFrom) * q * q * (3 - 2 * q);
    const noise = rng() * 2 - 1;
    low += lowA * (noise - low);
    high += highA * (noise - high);
    // One restrained start/end fade only; no sparse repeated hard grain attacks.
    const attack = clamp(i / (sampleRate * 0.06), 0, 1);
    const release = clamp((frames - 1 - i) / (sampleRate * 0.22), 0, 1);
    const envelope =
      attack *
      attack *
      (3 - 2 * attack) *
      release *
      release *
      (3 - 2 * release);
    channel[i] = (high - low) * drift * envelope * (waterfall ? 0.145 : 0.16);
  }
  channel[0] = channel[frames - 1] = 0;
  return {
    signature: `${effectId}-sizzle`,
    seed,
    duration: frames / sampleRate,
    sampleRate,
    channels: [channel],
  };
}

export function continuousCue(event) {
  if (event.kind !== "fountain" || !SIZZLE_DURATIONS[event.effectId])
    return null;
  const duration = event.emitterDuration ?? SIZZLE_DURATIONS[event.effectId];
  const age = event.emitterAge ?? 0;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 12 ||
    !Number.isFinite(age) ||
    age < 0 ||
    age >= duration
  )
    return { invalid: true };
  const explicitId =
    (typeof event.emitterId === "string" &&
      event.emitterId.length > 0 &&
      event.emitterId.length <= 80) ||
    Number.isFinite(event.emitterId);
  return {
    key: `${event.effectId}:${explicitId ? `id:${event.emitterId}` : `position:${event.position.join(",")}`}`,
    age,
    duration: duration - age,
    explicit: explicitId,
  };
}
