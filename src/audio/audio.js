// SPDX-License-Identifier: MIT
import {
  synthesize,
  propagation,
  signatureForEvent,
  SIGNATURES,
  randomGenerator,
} from "./synthesis.js";

export const MAX_VOICES = 40;
const SYNTH_RATE = 48000;
const PRIORITY = {
  fountain: 0,
  comet: 1,
  launch: 1,
  whistle: 2,
  crackle: 2,
  burst: 3,
  salute: 4,
};
const COOLDOWN = {
  launch: 0.075,
  comet: 0.12,
  fountain: 3.2,
  whistle: 1.6,
  crackle: 0.045,
  burst: 0,
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * Owns one context and all its voices. No context construction until enable().
 * `emit` receives discrete simulation events; `time` is metadata / dedupe only.
 * Every start is context.currentTime at emission + physical travel time.
 */
export class FireworksAudio {
  constructor({ volume = 0.6, enabled = false } = {}) {
    this._volume = Number.isFinite(volume) ? clamp(volume, 0, 1) : 0.6;
    this._enabled = false; // Even enabled:true cannot grant browser/user consent.
    this._requested = Boolean(enabled);
    this._consented = false;
    this._suspended = false;
    this._disposed = false;
    this._context = null;
    this._master = null;
    this._input = null;
    this._graph = [];
    this._buffers = new Map();
    this._voices = new Map();
    this._recent = new Map();
    this._cooldowns = new Map();
    this._listener = [0, 70, 400];
    this._epoch = 0;
    this._serial = 0;
    this._enabling = null;
    this._rng = randomGenerator(7349);
    this._counts = {
      emitted: 0,
      dropped: 0,
      throttled: 0,
      stolen: 0,
      ended: 0,
      highWaterVoices: 0,
    };
    this._lastError = null;
    this._lastSchedule = null;
  }

  _buildGraph() {
    const context = this._context;
    const input = context.createGain();
    input.gain.value = 0.52;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -13;
    compressor.knee.value = 12;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.24;
    const limiter = context.createWaveShaper();
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = (0.92 * Math.tanh(x * 1.35)) / Math.tanh(1.35);
    }
    limiter.curve = curve;
    // No oversampling: the curve ceiling remains a strict per-sample bound.
    limiter.oversample = "none";
    const master = context.createGain();
    master.gain.value = this._volume;
    input
      .connect(compressor)
      .connect(limiter)
      .connect(master)
      .connect(context.destination);
    this._input = input;
    this._master = master;
    this._graph = [input, compressor, limiter, master];
  }

  async enable() {
    if (this._disposed) return false;
    // Browser policy is still authoritative, including browsers without this API.
    if (
      globalThis.navigator?.userActivation &&
      !globalThis.navigator.userActivation.isActive
    ) {
      this._lastError = "Sound needs a user gesture.";
      return false;
    }
    if (this._enabling) return this._enabling;
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) {
      this._lastError = "Web Audio is unavailable.";
      return false;
    }
    const epoch = ++this._epoch;
    this._requested = true;
    let resume;
    try {
      if (!this._context || this._context.state === "closed") {
        this._context = new Context({ latencyHint: "interactive" });
        this._buildGraph();
      }
      // Called synchronously in the gesture stack, before the first await.
      resume = this._context.resume();
    } catch (error) {
      this._enabled = false;
      this._lastError = String(error?.message ?? error);
      for (const node of this._graph) node.disconnect();
      this._graph = [];
      const failedContext = this._context;
      this._context = null;
      if (failedContext)
        try {
          await failedContext.close();
        } catch {
          /* Already unavailable. */
        }
      return false;
    }
    this._enabling = (async () => {
      try {
        await resume;
        if (this._disposed || epoch !== this._epoch) {
          if (this._context?.state === "running") await this._context.suspend();
          return false;
        }
        if (this._context.state !== "running") {
          this._lastError = "The browser did not allow audio to start.";
          return false;
        }
        this._consented = true;
        this._enabled = true;
        this._suspended = false;
        this._lastError = null;
        return true;
      } catch (error) {
        this._enabled = false;
        this._lastError = String(error?.message ?? error);
        return false;
      } finally {
        this._enabling = null;
      }
    })();
    return this._enabling;
  }

  setEnabled(enabled) {
    if (this._disposed) return false;
    this._requested = Boolean(enabled);
    if (!enabled) {
      this._enabled = false;
      this._epoch++;
      this.stop();
      // Muting never revives a suspended browser context.
      if (this._context?.state === "running")
        this._context.suspend().catch((e) => {
          this._lastError = String(e?.message ?? e);
        });
    }
    // Enabling requires enable() from a gesture, never this setter.
    return this._enabled;
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) return false;
    this._volume = clamp(volume, 0, 1);
    if (this._master && this._context?.state !== "closed") {
      this._master.gain.setTargetAtTime(
        this._volume,
        this._context.currentTime,
        0.025,
      );
    }
    return this._volume;
  }

  setListener(position) {
    try {
      propagation([0, 0, 0], position);
    } catch {
      return false;
    }
    this._listener = [...position];
    return true;
  }

  _buffer(signature) {
    if (this._buffers.has(signature)) return this._buffers.get(signature);
    const seed = 1009 + Object.keys(SIGNATURES).indexOf(signature) * 101;
    const pcm = synthesize(signature, { sampleRate: SYNTH_RATE, seed });
    const buffer = this._context.createBuffer(
      2,
      pcm.channels[0].length,
      pcm.sampleRate,
    );
    pcm.channels.forEach((channel, i) => buffer.copyToChannel(channel, i));
    this._buffers.set(signature, buffer);
    return buffer;
  }

  _forgetVoice(voice, stop = false) {
    if (!this._voices.has(voice.id)) return;
    this._voices.delete(voice.id);
    voice.source.onended = null;
    if (stop) {
      try {
        voice.source.stop();
      } catch {
        /* It may already have ended. */
      }
    }
    for (const node of voice.nodes) node.disconnect();
    voice.source.buffer = null;
  }

  emit(event) {
    const context = this._context;
    if (
      this._disposed ||
      !this._enabled ||
      this._suspended ||
      context?.state !== "running" ||
      this._volume === 0
    )
      return false;
    const now = context.currentTime;
    const signature = signatureForEvent(event);
    if (
      !signature ||
      !Number.isFinite(event.time) ||
      !Number.isFinite(event.power)
    ) {
      this._counts.dropped++;
      return false;
    }
    let spatial;
    try {
      spatial = propagation(event.position, this._listener);
    } catch {
      this._counts.dropped++;
      return false;
    }
    // Reject unreasonable scheduling horizons instead of leaking queued voices.
    if (spatial.delay > 30) {
      this._counts.dropped++;
      return false;
    }
    const cell = event.position.map((v) => Math.round(v / 8)).join(",");
    const family = `${event.kind}:${String(event.effectId ?? "")}:${cell}`;
    const dedupe = `${family}:${event.time}`;
    for (const [key, expiry] of this._recent)
      if (expiry <= now) this._recent.delete(key);
    for (const [key, expiry] of this._cooldowns)
      if (expiry <= now) this._cooldowns.delete(key);
    if (
      this._recent.has(dedupe) ||
      (this._cooldowns.get(family) ?? -Infinity) > now
    ) {
      this._counts.throttled++;
      return false;
    }
    // Both future-scheduled and sounding sources count toward the same hard cap.
    if (this._voices.size >= MAX_VOICES) {
      const victim = [...this._voices.values()].sort(
        (a, b) => a.priority - b.priority || a.when - b.when,
      )[0];
      if (victim.priority > PRIORITY[signature]) {
        this._counts.dropped++;
        return false;
      }
      this._forgetVoice(victim, true);
      this._counts.stolen++;
    }
    let nodes = [];
    try {
      const buffer = this._buffer(signature);
      const source = context.createBufferSource();
      nodes.push(source);
      const filter = context.createBiquadFilter();
      nodes.push(filter);
      const panner = context.createStereoPanner();
      nodes.push(panner);
      const gain = context.createGain();
      nodes.push(gain);
      source.buffer = buffer;
      const power = clamp(event.power, 0.5, 2);
      const rate = clamp(
        (0.96 + this._rng() * 0.08) / Math.pow(power, 0.11),
        0.82,
        1.15,
      );
      source.playbackRate.value = rate;
      filter.type = "lowpass";
      filter.frequency.value = spatial.lowpassHz;
      filter.Q.value = 0.55;
      panner.pan.value = spatial.pan;
      gain.gain.value =
        spatial.gain * Math.sqrt(power) * (0.86 + this._rng() * 0.14);
      source.connect(filter).connect(panner).connect(gain).connect(this._input);
      // Keep the emission clock even when a first-use buffer took CPU time.
      const when = Math.max(context.currentTime, now + spatial.delay);
      const id = ++this._serial;
      const voice = { id, source, nodes, when, priority: PRIORITY[signature] };
      source.onended = () => {
        this._counts.ended++;
        this._forgetVoice(voice);
      };
      source.start(when);
      this._voices.set(id, voice);
      this._recent.set(dedupe, now + 0.25);
      this._cooldowns.set(family, now + (COOLDOWN[event.kind] ?? 0));
      // Bound event metadata even for pathological callers / frozen audio clocks.
      if (this._recent.size > 512)
        this._recent.delete(this._recent.keys().next().value);
      if (this._cooldowns.size > 512)
        this._cooldowns.delete(this._cooldowns.keys().next().value);
      this._counts.emitted++;
      this._counts.highWaterVoices = Math.max(
        this._counts.highWaterVoices,
        this._voices.size,
      );
      this._lastSchedule = {
        id,
        signature,
        when,
        delay: spatial.delay,
        distance: spatial.distance,
        gain: gain.gain.value,
        pan: spatial.pan,
        playbackRate: rate,
        simulationTime: event.time,
        lateBy: Math.max(0, when - (now + spatial.delay)),
      };
      return { ...this._lastSchedule };
    } catch (error) {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          /* Partial graph. */
        }
      }
      this._counts.dropped++;
      this._lastError = String(error?.message ?? error);
      return false;
    }
  }

  stop() {
    for (const voice of [...this._voices.values()])
      this._forgetVoice(voice, true);
    this._recent.clear();
    this._cooldowns.clear();
  }

  async suspend() {
    if (this._disposed) return false;
    this._epoch++;
    this._suspended = true;
    this.stop();
    try {
      if (this._context && this._context.state !== "closed")
        await this._context.suspend();
      return true;
    } catch (error) {
      this._lastError = String(error?.message ?? error);
      return false;
    }
  }

  async resume() {
    // Explicit caller action only. There are no visibility/pageshow listeners.
    if (
      this._disposed ||
      !this._consented ||
      !this._enabled ||
      !this._requested ||
      !this._context
    )
      return false;
    const epoch = ++this._epoch;
    try {
      await this._context.resume();
      if (epoch !== this._epoch || this._disposed) {
        if (this._context?.state === "running") await this._context.suspend();
        return false;
      }
      this._suspended = false;
      return this._context.state === "running";
    } catch (error) {
      this._lastError = String(error?.message ?? error);
      return false;
    }
  }

  async dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._enabled = false;
    this._consented = false;
    this._epoch++;
    this.stop();
    for (const node of this._graph) node.disconnect();
    this._graph = [];
    this._buffers.clear();
    const context = this._context;
    try {
      if (context?.state !== "closed") await context?.close();
    } catch (error) {
      this._lastError = String(error?.message ?? error);
    }
    this._master = null;
    this._input = null;
  }

  getStats() {
    return {
      enabled: this._enabled,
      consented: this._consented,
      suspended: this._suspended,
      disposed: this._disposed,
      contextState: this._context?.state ?? "uninitialized",
      sampleRate: this._context?.sampleRate ?? null,
      synthesisRate: SYNTH_RATE,
      volume: this._volume,
      listener: [...this._listener],
      activeVoices: this._voices.size,
      maxVoices: MAX_VOICES,
      cachedBuffers: this._buffers.size,
      bufferBytes: [...this._buffers.values()].reduce(
        (n, b) => n + b.length * b.numberOfChannels * 4,
        0,
      ),
      ...this._counts,
      lastSchedule: this._lastSchedule ? { ...this._lastSchedule } : null,
      lastError: this._lastError,
    };
  }
}

export default FireworksAudio;
