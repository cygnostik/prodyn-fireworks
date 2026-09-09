#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import {
  synthesize,
  encodeWav,
  analyzePCM,
  SIGNATURES,
  SYNTHESIS_VERSION,
  propagation,
} from "../src/audio/synthesis.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/audio");
const evidence = resolve(root, "evidence");
await mkdir(output, { recursive: true });
await mkdir(evidence, { recursive: true });
const started = performance.now();
const sampleRate = 48000;
const pack = [];
const buffers = new Map();
for (const [index, signature] of Object.keys(SIGNATURES).entries()) {
  const seed = 1009 + index * 101;
  const pcm = synthesize(signature, { seed, sampleRate });
  buffers.set(signature, pcm);
  const file = `${signature}.wav`;
  const bytes = encodeWav(pcm);
  await writeFile(resolve(output, file), bytes);
  pack.push({
    file,
    signature,
    seed,
    bytes: bytes.length,
    layers: pcm.layers,
    ...analyzePCM(pcm),
  });
}

// Authored short study. Times are emission times, NOT arrival times.
const listener = [0, 40, 300];
const timeline = [
  { time: 0.15, signature: "launch", position: [-55, 0, 0], gain: 0.85 },
  { time: 1.7, signature: "burst", position: [-55, 170, 0], gain: 1 },
  { time: 2.16, signature: "crackle", position: [-55, 170, 0], gain: 0.68 },
  { time: 4.2, signature: "launch", position: [65, 0, 0], gain: 0.85 },
  { time: 5.8, signature: "salute", position: [65, 205, 0], gain: 1.2 },
  { time: 7.8, signature: "comet", position: [-100, 50, 0], gain: 0.85 },
  { time: 8.1, signature: "sizzle", position: [-70, 90, 0], gain: 0.36 },
  { time: 9.2, signature: "fountain", position: [90, 0, 0], gain: 0.75 },
  { time: 12, signature: "whistle", position: [-80, 85, 0], gain: 0.48 },
  { time: 14.2, signature: "launch", position: [-100, 0, 0], gain: 0.85 },
  { time: 14.4, signature: "launch", position: [0, 0, 0], gain: 0.85 },
  { time: 14.6, signature: "launch", position: [100, 0, 0], gain: 0.85 },
  { time: 15.9, signature: "burst", position: [-100, 180, 0], gain: 1 },
  { time: 16.1, signature: "burst", position: [0, 220, 0], gain: 1 },
  { time: 16.3, signature: "burst", position: [100, 180, 0], gain: 1 },
  { time: 16.8, signature: "crackle", position: [80, 180, 0], gain: 0.6 },
  { time: 17.5, signature: "salute", position: [0, 205, 0], gain: 1.1 },
];
const duration = 24;
const channels = [
  new Float32Array(sampleRate * duration),
  new Float32Array(sampleRate * duration),
];
for (const event of timeline) {
  const pcm = buffers.get(event.signature);
  const spatial = propagation(event.position, listener);
  event.arrival = event.time + spatial.delay;
  const offset = Math.round(event.arrival * sampleRate);
  const a = 1 - Math.exp((-2 * Math.PI * spatial.lowpassHz) / sampleRate);
  const pans = [
    Math.cos(((spatial.pan + 1) * Math.PI) / 4),
    Math.sin(((spatial.pan + 1) * Math.PI) / 4),
  ];
  for (let c = 0; c < 2; c++) {
    let low = 0;
    for (
      let i = 0;
      i < pcm.channels[c].length && offset + i < channels[c].length;
      i++
    ) {
      low += a * (pcm.channels[c][i] - low);
      channels[c][offset + i] += low * spatial.gain * event.gain * pans[c];
    }
  }
}
for (const channel of channels)
  for (let i = 0; i < channel.length; i++)
    channel[i] = 0.88 * Math.tanh(channel[i] * 1.4);
const demo = { channels, sampleRate };
const demoBytes = encodeWav(demo);
await writeFile(resolve(output, "demonstration.wav"), demoBytes);
const manifest = {
  title: "Afterlight — original procedural fireworks audio",
  synthesisVersion: SYNTHESIS_VERSION,
  license: "MIT",
  licenseFile: "../licenses/audio.txt",
  origin:
    "Original deterministic PCM synthesis; no recorded samples or third-party impulse responses.",
  format: "RIFF/WAVE, signed 16-bit little-endian PCM, stereo, 48000 Hz",
  samples: pack,
  demonstration: {
    file: "demonstration.wav",
    bytes: demoBytes.length,
    ...analyzePCM(demo),
    listener,
    timeline,
  },
  note: "Demonstration uses an authored offline mix, not a recorded browser session. No human listening quality claim.",
};
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const report = {
  command: "node scripts/render-audio.mjs",
  node: process.version,
  sampleCount: pack.length,
  wavCount: pack.length + 1,
  totalWavBytes: pack.reduce((n, s) => n + s.bytes, demoBytes.length),
  renderMilliseconds: performance.now() - started,
  samples: pack,
  demonstration: manifest.demonstration,
  verification:
    "All PCM values scanned before writing; independent WAV readback is tests/audio-pack.test.mjs.",
  humanListening: "not performed",
};
await writeFile(
  resolve(evidence, "audio-render.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      sampleCount: report.sampleCount,
      wavCount: report.wavCount,
      totalWavBytes: report.totalWavBytes,
      renderMilliseconds: report.renderMilliseconds,
      samplePeaks: pack.map((s) => ({ signature: s.signature, peak: s.peak })),
      demoPeak: report.demonstration.peak,
    },
    null,
    2,
  ),
);
