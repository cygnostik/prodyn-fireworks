import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { translate } from "../src/i18n.js";
import {
  createLayer,
  validateShow,
  encodeShow,
  decodeShow,
} from "../src/show.js";
import config from "../vite.config.js";

test("all show entry points reject coerced array and object effect identifiers", () => {
  for (const effectId of [
    ["peony"],
    {
      toString() {
        return "peony";
      },
    },
    42,
    null,
  ]) {
    const show = {
      version: 1,
      title: "Typed IDs",
      duration: 12,
      layers: [{ id: "one", effectId, palette: "gold", density: 1 }],
    };
    assert.throws(() => createLayer(effectId));
    assert.throws(() => validateShow(show));
    assert.throws(() => encodeShow(show));
    const link = Buffer.from(JSON.stringify(show)).toString("base64url");
    assert.throws(() => decodeShow(link));
  }
});

test("deployment roots reject query, fragment, credentials and non-web schemes", () => {
  const previous = process.env.SITE_URL;
  const transform = config.plugins[0].transformIndexHtml;
  try {
    for (const url of [
      "https://example.test/fireworks/?lang=en",
      "https://example.test/fireworks/#x",
      "https://user:example@example.test/",
      "javascript://localhost",
    ]) {
      process.env.SITE_URL = url;
      assert.throws(() => transform("<!-- DEPLOYMENT_METADATA -->"), url);
    }
    process.env.SITE_URL = "https://example.test/fireworks";
    const output = transform(
      '<!-- DEPLOYMENT_METADATA --><meta property="og:image" content="./assets/social.jpg">',
    );
    assert.ok(
      output.includes(
        'content="https://example.test/fireworks/assets/social.jpg"',
      ),
    );
    assert.ok(output.includes('href="https://example.test/fireworks/"'));
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});

// Controller contract fixture: executes the actual app's audio-controller functions.
// The deferred audio API deliberately promises no lower-layer cancellation guarantee.
for (const reason of ["hidden", "disposed", "cancel"])
  test(`a deferred sound enable cannot win after ${reason}`, async () => {
    const source = await readFile(
      new URL("../src/main.js", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("async function toggleSound()");
    const end = source.indexOf("function rendererFailed(", start);
    assert.ok(start >= 0 && end > start);
    let resolve;
    const deferred = new Promise((r) => {
      resolve = r;
    });
    const audio = {
      enabled: false,
      enable: () =>
        deferred.then(() => {
          audio.enabled = true;
          return true;
        }),
      setEnabled(v) {
        this.enabled = v;
      },
      stop() {},
      async suspend() {
        this.enabled = false;
      },
    };
    const node = {
      setAttribute() {},
      querySelector() {
        return { innerHTML: "" };
      },
      textContent: "",
    };
    const context = vm.createContext({
      t: translate,
      state: { sound: false, soundPreferred: false },
      audio,
      disposed: false,
      document: { hidden: false },
      $: () => node,
      ICONS: { "sound-on": "on", "sound-off": "off" },
      toast() {},
    });
    vm.runInContext(
      `let soundRequest=0,soundPending=false,pageSuspended=false;${source.slice(start, end)};globalThis.controls={toggleSound,suspendSoundForVisibility};`,
      context,
    );
    const pending = context.controls.toggleSound();
    if (reason === "hidden") {
      context.document.hidden = true;
      context.controls.suspendSoundForVisibility();
    }
    if (reason === "disposed") context.disposed = true;
    if (reason === "cancel") context.controls.toggleSound();
    resolve(true);
    await pending;
    await Promise.resolve();
    assert.equal(context.state.sound, false);
    assert.equal(audio.enabled, false);
  });
