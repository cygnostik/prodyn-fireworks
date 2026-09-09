// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { synthesize, encodeWav, SIGNATURES } from "../src/audio/synthesis.js";

const packURL = new URL("../public/audio/", import.meta.url);
test("rendered WAV pack matches every original seed and decodes as bounded stereo PCM", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", packURL), "utf8"),
  );
  assert.equal(manifest.license, "MIT");
  assert.deepEqual(
    manifest.samples.map((s) => s.signature),
    Object.keys(SIGNATURES),
  );
  const expectedFiles = [...manifest.samples, manifest.demonstration]
    .map((s) => s.file)
    .sort();
  assert.deepEqual(
    (await readdir(packURL)).filter((s) => s.endsWith(".wav")).sort(),
    expectedFiles,
  );
  for (const sample of [...manifest.samples, manifest.demonstration]) {
    const file = await readFile(new URL(sample.file, packURL));
    assert.equal(file.toString("ascii", 0, 4), "RIFF");
    assert.equal(file.toString("ascii", 8, 12), "WAVE");
    assert.equal(file.readUInt16LE(20), 1);
    assert.equal(file.readUInt16LE(22), 2);
    assert.equal(file.readUInt32LE(24), 48000);
    assert.equal(file.readUInt16LE(34), 16);
    assert.equal(file.readUInt32LE(40), sample.frames * 4);
    assert.equal(file.length, sample.bytes);
    let peak = 0,
      clipped = 0,
      square = 0;
    for (let offset = 44; offset < file.length; offset += 2) {
      const v = file.readInt16LE(offset);
      peak = Math.max(peak, Math.abs(v) / 32768);
      square += (v / 32768) ** 2;
      if (v === -32768 || v === 32767) clipped++;
    }
    assert.equal(clipped, 0, sample.file);
    assert.ok(peak <= 0.9001, sample.file);
    assert.ok(square > 1, sample.file);
    if (sample.signature) {
      const fresh = synthesize(sample.signature, {
        seed: sample.seed,
        sampleRate: sample.sampleRate,
      });
      assert.deepEqual(
        file,
        Buffer.from(encodeWav(fresh)),
        `byte-for-byte deterministic ${sample.file}`,
      );
    }
  }
  const crackle = manifest.demonstration.timeline.find(
    (e) => e.signature === "crackle",
  );
  const burst = manifest.demonstration.timeline.find(
    (e) => e.signature === "burst",
  );
  assert.ok(
    crackle.arrival > burst.arrival + 0.4,
    "crackle happens after the core burst",
  );
});
