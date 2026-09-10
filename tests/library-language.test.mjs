import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EFFECTS } from "../src/data/catalog.js";
import { synthesizeSizzle } from "../src/audio/sizzle.js";
import { encodeWav } from "../src/audio/synthesis.js";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
test("current library separates recordings, finite textures, and original pack", async () => {
  const html = await read("public/sound-library.html");
  for (const file of [
    "lift1.mp3",
    "burst1.mp3",
    "crackle-sm-1.mp3",
    "current-fountain.wav",
    "current-waterfall.wav",
  ])
    assert.ok(html.includes(`src="./audio/${file}"`), file);
  for (const id of [
    "current-recordings",
    "current-textures",
    "original-library",
    "original-demonstration",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /UNVERIFIED/);
  assert.doesNotMatch(html, /autoplay/);
});
test("all generated documents provide paired text and language module", async () => {
  for (const file of ["field-guide", "sound-library", "credits"]) {
    const html = await read(`public/${file}.html`);
    assert.match(html, /type="module" src="\.\/docs-language.js"/);
    assert.match(html, /data-language-switch/);
    assert.match(html, /data-es-mx=/);
  }
  const html = await read("public/field-guide.html");
  for (const e of EFFECTS)
    assert.match(
      html,
      new RegExp(
        `<article id="${e.id}"[\\s\\S]*?<h3><span data-en="[^"]+" data-es-mx="[^"]+"`,
      ),
    );
  assert.equal((html.match(/<article id=/g) || []).length, 40);
});
test("current texture WAVs are exact deterministic renders of the live API", async () => {
  for (const [effectId, seed] of [
    ["fountain", 1701],
    ["waterfall", 1702],
  ]) {
    const bytes = await readFile(
      new URL(`../public/audio/current-${effectId}.wav`, import.meta.url),
    );
    assert.deepEqual(
      bytes,
      Buffer.from(
        encodeWav(synthesizeSizzle(effectId, { sampleRate: 48000, seed })),
      ),
    );
  }
});
