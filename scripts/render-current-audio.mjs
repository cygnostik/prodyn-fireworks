// SPDX-License-Identifier: MIT
// Deterministic dry examples of the CURRENT finite emitter implementation.
// No recordings, private evidence, network, or old synthesis textures involved.
import { writeFile, mkdir } from "node:fs/promises";
import { synthesizeSizzle } from "../src/audio/sizzle.js";
import { encodeWav } from "../src/audio/synthesis.js";
const output = new URL("../public/audio/", import.meta.url);
export async function renderCurrentAudio() {
  await mkdir(output, { recursive: true });
  for (const [effectId, seed] of [
    ["fountain", 1701],
    ["waterfall", 1702],
  ]) {
    const pcm = synthesizeSizzle(effectId, { sampleRate: 48000, seed });
    await writeFile(new URL(`current-${effectId}.wav`, output), encodeWav(pcm));
  }
}
if (
  process.argv[1] &&
  new URL(process.argv[1], "file:").href === import.meta.url
) {
  await renderCurrentAudio();
  console.log(
    "Rendered current-fountain.wav (6.5s) and current-waterfall.wav (6s): mono 48 kHz PCM16, seeds 1701/1702.",
  );
}
