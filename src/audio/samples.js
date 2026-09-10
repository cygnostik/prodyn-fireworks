// SPDX-License-Identifier: MIT
// This code's MIT license does NOT license the imported recordings.
// See public/audio/recordings.json (audio reuse rights: UNVERIFIED).
export const SAMPLE_FILES = Object.freeze({
  launch: "lift1.mp3",
  burst: "burst1.mp3",
  crackle: "crackle-sm-1.mp3",
});
const LOAD_TIMEOUT_MS = 5000;
const MAX_SAMPLE_BYTES = 1024 * 1024;

export function sampleURL(signature) {
  const file = SAMPLE_FILES[signature];
  if (!file || !globalThis.document?.baseURI) return null;
  // Vite replaces BASE_URL; './' also works in a raw-module local harness.
  // Resolve against the document, NOT the hashed bundle or the origin root.
  return new URL(
    `${import.meta.env?.BASE_URL ?? "./"}audio/${file}`,
    document.baseURI,
  ).href;
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () =>
      reject(signal.reason ?? new Error("Audio load cancelled."));
    // Even a previously aborted operation may hand us an already-rejected
    // native promise. Always attach its handlers to avoid an unhandled rejection.
    if (signal.aborted) aborted();
    else signal.addEventListener("abort", aborted, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
  });
}

/** Three bounded, consent-triggered local decodes; never schedules any sound. */
export class SampleBank {
  constructor() {
    this.buffers = new Map();
    this.status = Object.fromEntries(
      Object.keys(SAMPLE_FILES).map((key) => [key, "idle"]),
    );
    this.errors = {};
    this._generation = 0;
    this._loading = null;
    this._controller = null;
    this._disposed = false;
  }

  load(context) {
    if (this._disposed) return Promise.resolve(false);
    if (this._loading) return this._loading;
    // Raw Node consumers still have a complete, offline procedural fallback.
    if (
      typeof context.decodeAudioData !== "function" ||
      !globalThis.document?.baseURI
    )
      return Promise.resolve(false);
    if (this.buffers.size === Object.keys(SAMPLE_FILES).length)
      return Promise.resolve(true);
    const generation = ++this._generation;
    const controller = new AbortController();
    this._controller = controller;
    const timeout = setTimeout(
      () => controller.abort(new Error("Local audio load timed out.")),
      LOAD_TIMEOUT_MS,
    );
    const current = () => generation === this._generation && !this._disposed;
    const loading = Promise.all(
      Object.keys(SAMPLE_FILES).map(async (signature) => {
        if (this.buffers.has(signature)) return true;
        this.status[signature] = "loading";
        delete this.errors[signature];
        try {
          const response = await abortable(
            fetch(sampleURL(signature), {
              signal: controller.signal,
              credentials: "same-origin",
            }),
            controller.signal,
          );
          if (!current() || controller.signal.aborted) return false;
          if (!response.ok)
            throw new Error(`Local audio HTTP ${response.status}.`);
          if (Number(response.headers.get("content-length")) > MAX_SAMPLE_BYTES)
            throw new Error("Local audio exceeds size limit.");
          const data = await abortable(
            response.arrayBuffer(),
            controller.signal,
          );
          if (!data.byteLength || data.byteLength > MAX_SAMPLE_BYTES)
            throw new Error("Invalid local audio size.");
          if (!current() || controller.signal.aborted) return false;
          // Native decode is not cancellable; race its completion and ignore stale results.
          const buffer = await abortable(
            context.decodeAudioData(data),
            controller.signal,
          );
          if (
            !current() ||
            controller.signal.aborted ||
            context.state === "closed"
          )
            return false;
          if (
            !Number.isFinite(buffer.duration) ||
            buffer.duration <= 0 ||
            buffer.duration > 10 ||
            buffer.numberOfChannels > 2
          )
            throw new Error("Invalid decoded audio format.");
          this.buffers.set(signature, buffer);
          this.status[signature] = "ready";
          return true;
        } catch (error) {
          if (current()) {
            this.status[signature] = "fallback";
            this.errors[signature] = String(error?.message ?? error);
          }
          return false;
        }
      }),
    )
      .then((results) => current() && results.every(Boolean))
      .finally(() => {
        clearTimeout(timeout);
        if (this._loading === loading) {
          this._loading = null;
          this._controller = null;
        }
      });
    this._loading = loading;
    return loading;
  }

  whenReady() {
    return (
      this._loading ??
      Promise.resolve(this.buffers.size === Object.keys(SAMPLE_FILES).length)
    );
  }

  cancel() {
    this._generation++;
    this._controller?.abort(new Error("Audio load cancelled."));
    this._controller = null;
    this._loading = null;
    for (const signature of Object.keys(this.status))
      if (this.status[signature] === "loading") this.status[signature] = "idle";
  }

  dispose() {
    this._disposed = true;
    this.cancel();
    this.buffers.clear();
    for (const signature of Object.keys(this.status))
      this.status[signature] = "disposed";
  }

  getStats() {
    return {
      state: { ...this.status },
      errors: { ...this.errors },
      ready: this.buffers.size,
      total: Object.keys(SAMPLE_FILES).length,
      bytes: [...this.buffers.values()].reduce(
        (sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4,
        0,
      ),
    };
  }
}
