import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../src/main.js", import.meta.url),
  "utf8",
);
const begin = source.indexOf("async function toggleSound()");
const end = source.indexOf("function rendererFailed(", begin);
assert(begin >= 0 && end > begin);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const trustedPointer = {
  isTrusted: true,
  type: "pointerdown",
  pointerType: "mouse",
  target: { closest: () => null },
};

function fixture({ saved = "off", storageFails = false } = {}) {
  const storage = new Map([["afterlight:sound:v1", saved]]);
  let releaseResume;
  let resumeGate = null;
  const audio = {
    enabled: false,
    consented: false,
    contextState: "uninitialized",
    activeVoices: 0,
    enableCalls: 0,
    resumeCalls: 0,
    blockResume: false,
    async enable() {
      this.enableCalls++;
      this.enabled = this.consented = true;
      this.contextState = "running";
      return true;
    },
    async resume() {
      this.resumeCalls++;
      if (!this.enabled || !this.consented) return false;
      if (resumeGate) await resumeGate;
      if (this.blockResume) return false;
      // Deliberately does not cancel itself: the app must contain stale results.
      this.enabled = true;
      this.contextState = "running";
      return true;
    },
    async suspend() {
      this.contextState = "suspended";
      this.stop();
      return true;
    },
    setEnabled(value) {
      this.enabled = value;
      if (!value) {
        this.contextState = "suspended";
        this.stop();
      }
    },
    stop() {
      this.activeVoices = 0;
    },
    getStats() {
      return {
        consented: this.consented,
        enabled: this.enabled,
        contextState: this.contextState,
      };
    },
  };
  const node = {
    setAttribute() {},
    querySelector: () => ({ innerHTML: "" }),
    textContent: "",
  };
  const context = vm.createContext({
    audio,
    state: { sound: false, soundPreferred: false },
    disposed: false,
    document: { hidden: false },
    $: () => node,
    ICONS: { "sound-on": "on", "sound-off": "off" },
    toast() {},
    safeStorage: {
      getItem(k) {
        if (storageFails) throw new Error("Storage denied");
        return storage.get(k);
      },
      setItem(k, v) {
        if (storageFails) throw new Error("Storage denied");
        storage.set(k, v);
      },
    },
  });
  vm.runInContext(
    `let soundRequest=0,soundPending=false,pageSuspended=false;
    ${source.slice(begin, end)}
    globalThis.controls={toggleSound,muteSound,suspendSoundForVisibility,resumeSoundForVisibility,restoreRememberedSound,readSoundPreference};`,
    context,
  );
  context.state.soundPreferred = context.controls.readSoundPreference();
  return {
    context,
    audio,
    storage,
    controls: context.controls,
    gateResume() {
      resumeGate = new Promise((resolve) => {
        releaseResume = resolve;
      });
    },
    releaseResume() {
      releaseResume?.();
    },
  };
}

test("a stored sound preference cannot create a context without a trusted gesture", async () => {
  const f = fixture({ saved: "on" });
  f.controls.resumeSoundForVisibility();
  f.controls.restoreRememberedSound({ ...trustedPointer, isTrusted: false });
  await flush();
  assert.equal(f.audio.enableCalls, 0);
  assert.equal(f.audio.resumeCalls, 0);
  assert.equal(f.audio.contextState, "uninitialized");
  f.controls.restoreRememberedSound(trustedPointer);
  await flush();
  assert.equal(f.audio.enableCalls, 1);
  assert.equal(f.context.state.sound, true);
});

for (const pointerType of ["touch", "pen"]) {
  test(`${pointerType} restoration waits for activation-bearing pointerup`, async () => {
    const f = fixture({ saved: "on" });
    f.controls.restoreRememberedSound({ ...trustedPointer, pointerType });
    await flush();
    assert.equal(f.audio.enableCalls, 0);
    assert.equal(f.audio.contextState, "uninitialized");
    f.controls.restoreRememberedSound({
      ...trustedPointer,
      pointerType,
      type: "pointerup",
    });
    await flush();
    assert.equal(f.audio.enableCalls, 1);
    assert.equal(f.context.state.sound, true);
    f.controls.restoreRememberedSound({
      ...trustedPointer,
      pointerType,
      type: "pointerup",
    });
    await flush();
    assert.equal(f.audio.enableCalls, 1);
  });
}

test("visibility suspension retains consent/preference, cancels voices, and resumes only new sound", async () => {
  const f = fixture();
  await f.controls.toggleSound();
  f.audio.activeVoices = 3;
  f.context.document.hidden = true;
  f.controls.suspendSoundForVisibility();
  assert.equal(f.context.state.soundPreferred, true);
  assert.equal(f.storage.get("afterlight:sound:v1"), "on");
  assert.equal(f.audio.activeVoices, 0);
  assert.equal(f.context.state.sound, false);
  f.context.document.hidden = false;
  f.controls.resumeSoundForVisibility();
  await flush();
  assert.equal(f.context.state.sound, true);
  assert.equal(f.audio.activeVoices, 0);
  assert.equal(f.audio.enableCalls, 1);
  assert.equal(f.audio.resumeCalls, 1);
});

for (const reason of ["mute", "hidden again", "disposed"]) {
  test(`a deferred return-to-page resume cannot win after ${reason}`, async () => {
    const f = fixture();
    await f.controls.toggleSound();
    f.controls.suspendSoundForVisibility();
    f.gateResume();
    f.controls.resumeSoundForVisibility();
    if (reason === "mute") await f.controls.toggleSound();
    else if (reason === "hidden again") {
      f.context.document.hidden = true;
      f.controls.suspendSoundForVisibility();
    } else f.context.disposed = true;
    f.releaseResume();
    await flush();
    assert.equal(f.context.state.sound, false);
    assert.equal(f.audio.contextState, "suspended");
    if (reason === "mute") {
      assert.equal(f.context.state.soundPreferred, false);
      assert.equal(f.storage.get("afterlight:sound:v1"), "off");
    }
  });
}

test("browser-blocked resume keeps the preference and accepts a subsequent gesture", async () => {
  const f = fixture();
  await f.controls.toggleSound();
  f.controls.suspendSoundForVisibility();
  f.audio.blockResume = true;
  f.controls.resumeSoundForVisibility();
  await flush();
  assert.equal(f.context.state.sound, false);
  assert.equal(f.context.state.soundPreferred, true);
  f.controls.restoreRememberedSound(trustedPointer);
  await flush();
  assert.equal(f.context.state.sound, true);
});

test("storage denial preserves working same-page sound choice", async () => {
  const f = fixture({ saved: "on", storageFails: true });
  assert.equal(f.context.state.soundPreferred, false);
  await f.controls.toggleSound();
  f.controls.suspendSoundForVisibility();
  f.controls.resumeSoundForVisibility();
  await flush();
  assert.equal(f.context.state.sound, true);
  await f.controls.toggleSound();
  f.controls.resumeSoundForVisibility();
  await flush();
  assert.equal(f.context.state.sound, false);
  assert.equal(f.context.state.soundPreferred, false);
});
