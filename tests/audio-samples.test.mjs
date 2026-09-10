// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { SampleBank, sampleURL } from "../src/audio/samples.js";

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
test.after(() => {
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
});
globalThis.document = {
  baseURI: "https://example.invalid/instruments/afterlight/index.html",
};
const response = () => new Response(new Uint8Array([1, 2, 3]));
const fixture = () => ({ duration: 0.2, length: 9600, numberOfChannels: 2 });
const context = () => ({
  state: "running",
  decodeAudioData: async () => fixture(),
});

test("three local nested-safe URLs; no fetch on construction and deduplicated decode/cache", async () => {
  let fetches = 0;
  globalThis.fetch = async (url, options) => {
    assert.ok(
      url.startsWith("https://example.invalid/instruments/afterlight/audio/"),
    );
    assert.equal(options.credentials, "same-origin");
    fetches++;
    return response();
  };
  const bank = new SampleBank();
  assert.equal(fetches, 0);
  assert.equal(
    sampleURL("launch"),
    "https://example.invalid/instruments/afterlight/audio/lift1.mp3",
  );
  assert.equal(sampleURL("salute"), null);
  assert.equal(await bank.whenReady(), false);
  const first = bank.load(context());
  assert.equal(bank.load(context()), first);
  assert.equal(await first, true);
  assert.equal(await bank.load(context()), true);
  assert.equal(fetches, 3);
  assert.equal(bank.getStats().ready, 3);
  bank.dispose();
  assert.equal(bank.getStats().bytes, 0);
  assert.equal(await bank.load(context()), false);
});

test("HTTP failure, corrupt decode, and oversized responses fall back independently", async () => {
  globalThis.fetch = async (url) =>
    url.endsWith("lift1.mp3")
      ? new Response("missing", { status: 404 })
      : url.endsWith("burst1.mp3")
        ? new Response("huge", { headers: { "content-length": "1048577" } })
        : response();
  const bank = new SampleBank();
  const ctx = context();
  ctx.decodeAudioData = async () => {
    throw new Error("Invalid MP3 fixture");
  };
  assert.equal(await bank.load(ctx), false);
  assert.equal(bank.buffers.size, 0);
  assert.match(bank.getStats().errors.launch, /404/);
  assert.match(bank.getStats().errors.burst, /size limit/);
  assert.match(bank.getStats().errors.crackle, /Invalid MP3/);
  bank.dispose();
});

test("cancel/dispose settle promptly and old native decode cannot populate a new load", async () => {
  globalThis.fetch = async () => response();
  const bank = new SampleBank(),
    ctx = context(),
    releases = [];
  ctx.decodeAudioData = () =>
    new Promise((resolve) => releases.push(() => resolve(fixture())));
  const old = bank.load(ctx);
  while (releases.length < 3)
    await new Promise((resolve) => setImmediate(resolve));
  bank.cancel();
  assert.equal(await old, false);
  const fresh = bank.load(ctx);
  while (releases.length < 6)
    await new Promise((resolve) => setImmediate(resolve));
  releases.slice(0, 3).forEach((release) => release());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bank.buffers.size, 0);
  releases.slice(3).forEach((release) => release());
  assert.equal(await fresh, true);
  assert.equal(bank.buffers.size, 3);
  bank.dispose();
  assert.equal(bank.buffers.size, 0);
  assert.equal(await bank.whenReady(), false);
});

test("an already-aborted body promise is still observed without unhandled rejection", async () => {
  const bank = new SampleBank();
  globalThis.fetch = async () => ({
    ok: true,
    headers: new Headers(),
    arrayBuffer() {
      bank.cancel();
      return Promise.reject(
        new Error("body rejected during cancellation fixture"),
      );
    },
  });
  assert.equal(await bank.load(context()), false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bank.buffers.size, 0);
  bank.dispose();
});

test("a fetch that never settles has a bounded fallback, not an enabling stall", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.fetch = () => new Promise(() => {});
  const bank = new SampleBank();
  const pending = bank.load(context());
  t.mock.timers.tick(5001);
  assert.equal(await pending, false);
  assert.ok(
    Object.values(bank.getStats().errors).every((error) =>
      /timed out/.test(error),
    ),
  );
  assert.equal(bank.buffers.size, 0);
  bank.dispose();
});
