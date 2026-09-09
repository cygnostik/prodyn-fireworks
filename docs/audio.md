# AFTERLIGHT audio

Original, MIT-licensed procedural fireworks audio. The engine synthesizes sound locally, without sampled recordings, third-party impulse responses, microphone access or audio fetches. The WAV pack is a reusable offline export of the same synthesis, not a runtime dependency.

Acoustic cues are researched; numerical synthesis settings are authored. **No human listening test was performed.** This is a stylized perceptual model, not calibrated blast acoustics or a speaker-safety guarantee.

## Integration API

Use the application lifecycle in [`src/main.js`](../src/main.js) for sound-button wiring: `toggleSound()`, `muteForVisibility()` and `dispose()` coordinate pending requests, visibility, cancellation and teardown. `enable()` must start directly in a trusted click/key handler. After it resolves, the application checks that the request is still current, the page is visible and the app is not disposed before updating sound state. A late result must not undo a newer mute or enable request. Engine-level cancellation does not replace this application guard.

```js
import { FireworksAudio } from './audio/audio.js';

const audio = new FireworksAudio({ volume: 0.6, enabled: false });

// Connect opt-in through the guarded application lifecycle described above.
// Constructing this object does not open an AudioContext.

// Camera position, in the simulator's WORLD METERS. Update when it moves.
audio.setListener([camera.position.x, camera.position.y, camera.position.z]);

// Emit once when the simulation produces this actual event, NOT once per frame.
audio.emit({
  kind: 'burst', effectId: 'peony',
  position: [0, 200, 0], power: 1, time: simulationSeconds,
});

// These must also be actual later simulation events, not future timestamps
// emitted early: `time` is metadata, not a future Web Audio scheduling command.
audio.emit({ kind: 'crackle', effectId: 'crackling', position: [0, 200, 0], power: 0.8, time: simulationSeconds });

// On explicit mute:
audio.setEnabled(false);
// On pause / clear: stop() cancels sounding AND future-scheduled sources.
audio.stop();
// On tab hide or pause, if the app owns this lifecycle:
await audio.suspend();
// Explicit user continuation ONLY, after prior sound opt-in:
await audio.resume();
// Prefer another enable() gesture after tab restoration if sound is uncertain.
// On teardown:
await audio.dispose();
```

| Method | Contract |
| --- | --- |
| `constructor({volume=0.6, enabled=false}={})` | Allocates no context and plays nothing. Even `enabled:true` cannot confer gesture consent. |
| `enable(): Promise<boolean>` | Create/resume the owned context under a gesture. Returns false if blocked, unavailable, superseded, or disposed; exposes `lastError`. |
| `setEnabled(boolean)` | False cancels all voices and suspends the context. True alone never creates, resumes, or re-enables audio; call `enable()`. |
| `setVolume(0..1)` | Clamp finite values; reject nonfinite input. Smooth a live gain change. Volume zero drops new events rather than keeping inaudible voices. |
| `setListener([x,y,z])` | Three finite world-meter coordinates, default `[0,70,400]`; returns false for invalid input. |
| `emit(event)` | Returns schedule metadata or false. `kind` is `launch`, `burst`, `crackle`, `whistle`, `fountain`, or `comet`; finite `power` clamps to 0.5–2; `time` must be finite simulation seconds. |
| `stop()` | Cancel all scheduled/active voices and clear event cooldowns, preserving enabled state and reusable buffers. |
| `suspend(): Promise<boolean>` | Stop voices and suspend the owned context; remember prior opt-in, never install a visibility listener. |
| `resume(): Promise<boolean>` | Explicit caller action only. Refuses without previous successful opt-in, after mute, or after disposal. No missed sounds are replayed. |
| `dispose(): Promise<void>` | Idempotently stop/disconnect sources and graph, clear buffers, close only this engine's context. Cannot be re-enabled. |
| `getStats()` | Copies of enabled/consented/suspended/disposed state, listener, context/synthesis rates, volume, voice/buffer counts, buffer bytes, emitted/dropped/throttled/stolen/ended/high-water counters, last schedule and error. |

`emit()` schedule metadata includes `id`, `signature`, `when`, `delay`, `distance`, `gain`, `pan`, `playbackRate`, `simulationTime`, and `lateBy` (seconds). The engine uses `AudioContext.currentTime` captured **at emission**, plus Euclidean distance divided by 343 m/s. It does **not** interpret simulation time as the AudioContext epoch. Speed 343 m/s is the authored still-air approximation for about 20 °C, consistent with the textbook value.[4]

The source's actual start is `max(currentTime after buffer creation, emissionTime + delay)`. A first-use cold synthesis at very short distance can therefore be late; `lateBy` reports it instead of scheduling into the past. Cached subsequent sounds do not regenerate PCM. The compressor/device can add further latency: this is not a sample-perfect audiovisual output-latency calibration. Listener motion after an event has been emitted does not retime that sound; the position is sampled at emission. Panning assumes a listener facing -Z, not an arbitrary camera rotation. Delays beyond 30 seconds are rejected as an authored resource bound.

### Discrete type rules

- `burst` selects the core report/body/tail. `salute`, `white-salute`, `white_salute`, `whiteSalute`, and `maroon` report IDs select the hotter salute signature. A launch is still only a launch, including a salute's launch.
- Ordinary bursts contain a **faint air/sizzle component**, not automatic crackles or a whistle. `crackle` is its own later event, issued when stars crackle; the demonstration separates it from the first core burst by an authored interval.
- Only an explicit `whistle` event produces the tonal whistle. Bees/tourbillon/etc. do not whistle merely because of their visual name; the simulation decides which event is appropriate.
- `comet` is a light lift/air trail with no large burst. A Roman-candle shot should emit `comet`/`launch`, not an invented `burst` event. A fountain should emit `fountain`, not pretend to be an aerial shell.
- `fountain` is a sustained noise spray with sparse small grains, not a bass report. Its hiss is an authored treatment, not a claim that all fountains make the same sound.
- Same-family/source-cell launch events have a 75 ms cooldown; comet 120 ms; crackle 45 ms; whistle 1.6 s; fountain 3.2 s. These guards suppress repeated frame notifications; they do not replace correct discrete simulation events. Cells are 8 m, and event-time duplicates are suppressed briefly. This may intentionally merge very close simultaneous sources with identical IDs/times.

### Bounded mix

Each voice owns a cached-buffer source, low-pass filter, stereo panner, and gain. Pitch and gain vary deterministically across the event sequence; power also shifts pitch slightly. The distance gain and low-pass curves are **mix choices**, not measured atmospheric absorption, inverse-square SPL calibration, obstruction, terrain, weather, Doppler, or reverberation simulation.

The bus is `gain → compressor → bounded WaveShaper → master volume → destination`. The live cap is **40 voices**, including sources waiting for propagation delay. A higher-priority report can replace an older/lower-priority voice. A lower-priority new event is dropped when the cap is occupied by stronger events. There is no persistent oscillator, animation loop, global audio singleton, timer scheduler, network request, or hidden playback listener. PCM and the mix have digital headroom; this does not establish safe real-world loudspeaker/headphone exposure.

## Original synthesis and reusable exports

`src/audio/synthesis.js` is pure ESM with no DOM, Web Audio, Node, or third-party dependencies:

- `synthesize(signature, {sampleRate=48000, seed=1009, layers}={})` returns `{signature, seed, sampleRate, duration, channels: Float32Array[], layers, markers}`. Rates: integer 16000–96000. Optional `layers` isolates the authored stems; each output has its own safety trim.
- `SIGNATURES`, `SYNTHESIS_VERSION`, and `SPEED_OF_SOUND` expose the contract.
- `randomGenerator(seed)` supplies a deterministic noncryptographic generator.
- `propagation(position, listener)` returns distance, delay, mix gain, cutoff, and pan.
- `signatureForEvent(event)` implements event routing without audio state.
- `analyzePCM(pcm)` scans finite/clipped samples, peak, RMS, DC, early/late RMS, and a first-difference brightness proxy. Brightness is not a human timbre score.
- `encodeWav(pcm)` writes a real 16-bit PCM RIFF/WAVE byte array, rejects nonfinite or out-of-range samples, and requires equal-length channels.

Layers are independently authored filtered noise, short bipolar pressure-like impulses, decaying low resonances, irregular short grains, a frequency-modulated whistle, faint high-passed air, and a stereo tail using irregular filtered reflection taps plus decaying rolling noise. No real impulse response was copied. These are ear-cue approximations, not a solver for physical combustion or airblast waveforms.

| Export in `public/audio/` | Seconds | Role |
| --- | ---: | --- |
| `launch.wav` | 1.5 | Rounded mortar thump, short attack/air, subdued tail |
| `burst.wav` | 3.8 | Sharp transient, strong low body, faint sizzle, diffuse rolling tail |
| `salute.wav` | 4.2 | Shorter/brighter high transient, bass body, tail; no whistle |
| `crackle.wav` | 2.8 | Irregular granular snaps with faint air |
| `sizzle.wav` | 3.0 | Separate faint trailing-air asset; not an additional runtime event kind |
| `whistle.wav` | 2.4 | Specific modulated tonal whistle, no automatic boom |
| `fountain.wav` | 3.6 | Sustained hiss/spray with small sparse grains |
| `comet.wav` | 1.8 | Light launch/air, no large aerial report |
| `demonstration.wav` | 24.0 | Authored stereo sequence with distance-delayed events and a short finale |

All nine WAVs are stereo 48 kHz, signed 16-bit little-endian PCM. [`public/audio/manifest.json`](../public/audio/manifest.json) records seeds, layers, frame counts, durations, PCM metrics, byte sizes, and the demonstration's **emission and arrival** timeline. The demonstration is an original offline mix, not a captured browser session. The exports total **9,043,596 bytes**. Live sound does not fetch them. The PWA caches the exports for the separate sound-library page; synthesized sound itself needs no WAV precache.

Reproducibility: the pack test regenerates each signature's seed and compares the bytes directly in Node. Floating-point transcendental functions are not promised bit-identical across all JS implementations.

License: [`public/licenses/audio.txt`](../public/licenses/audio.txt) contains the MIT permission grant for original source and generated audio. Include that notice when redistributing the pack. Cited prose and retrieved publisher text retain their respective source rights and are **not** an audio sample license. No recordings from the commercial sources below were obtained or used.

## Atomic acoustic claims and their limits

Each row separates a reported cue from an authored synthesis decision. The short quotations and source URLs below provide the acoustic references; they do not license source recordings or establish a measured match to the synthesized sound.

| Atomic sourced claim | Exact supporting quotation | Evidence scope / uncertainty | Implementation consequence |
| --- | --- | --- | --- |
| A typical exploding firework has a boom/bang.[6] | “The most typical sound you hear is the boom or the bang when a firework device explodes.” | NPR interview with pyrotechnics specialist Dr. John Conkling; descriptive, no measured waveform. | Distinct impulsive burst, not a generic continuous noise bed. |
| Some bursting charges produce a sharper, louder report.[6] | “There are more modern bursting charges with metal powders in them that are sharper and louder and flash with a light effect as well so they will rock the ground when they function.” | Qualitative specialist statement, not a required timbre for every salute size/material. | The salute is authored with a shorter/brighter transient, not a claimed measured match. |
| Crackling is a succession of short snaps/bangs.[6] | “gives a repeating bang, bang, bang, snap, snap snap.” | Describes an acoustic effect; the rate, amplitude distribution and post-burst gap here are invented design values. | Irregular short grains, separately scheduled after core events. |
| A pyrotechnic whistle is a distinct pulsing effect.[6] | “as that burns, it pulses and it produces gas products, much as you create a whistle with a mechanical whistle.” | Qualitative mechanism; no sourced pitch contour or all-types requirement. | Only explicit whistle events use the tonal synthesis. |
| A salute's primary effect is explosive sound.[7] | “Fireworks designed to produce an explosive sound as its primary effect.” | Industry glossary definition, not a spectral specification. | Salute routing emphasizes report rather than long air/spark content. |
| A whistle is not universal even within an example rotating effect.[7] | “Special wheel which rises rapidly in the air while emitting a spray of sparks and, sometimes, a whistle.” | APA's Girandola entry; do not extend the exact type assignment to every bee/tourbillon. | Whistle is conditional, never hardwired to all launches. |
| A field-recording practitioner identifies low-end thumps in mortar launches.[3] | “The MKH-8040 provides the serious low end thumps and mortar launches while the CSS-5 was in narrow stereo mode provides the echoes and shell explosions.” | Published account of Frank Bry's recording setup; microphone/location-dependent, not a general frequency measurement. No recording downloaded. | Give the lift its own low body and preserve launch/burst separation. |
| Hiss/sizzle is present in a professional catalog's description of some fireworks sounds.[8] | “Fireworks, British, Long Hiss, Sizzle, Sparks” | Product metadata from live HTML, not independent listening or proof that all fountains/trails hiss. No audio preview fetched. | Quiet noise-air stem and an authored fountain spray treatment. |
| An urban fireworks measurement study reports environment-specific echo patterns.[2] | “The urban impulse responses had distinct echo-time patterns originating from buildings and surrounding mountains, and the estimated source power of the fireworks had a nearly flat energy spectrum.” | Retrieved paper abstract, not full methods/results; urban surroundings do not imply this simulator's open sky has that exact reverb. | Diffuse tail is a plausible authored atmosphere, not a measured scene response. |
| Firework light reaches an observer before its sound.[4] | “You see the flash of an explosion well before you hear its sound and possibly feel the pressure wave, implying both that sound travels at a finite speed and that it is much slower than light.” | Textbook propagation explanation; wind/temperature/location are not supplied by the simulator. | Euclidean travel-time delay rather than synchronous flash-and-boom. |
| OpenStax gives 343 m/s in its discussion of air at 20 °C.[4] | “it is 343 m/s” | Textbook value for the stated air temperature, not a measurement of conditions in the simulated scene. | Authored fixed 343 m/s assumption; no live weather claim. |

The echo-study claim is based on its published abstract, and the hiss/sizzle claim is catalog metadata. Neither supplies a measured response for this scene. The source descriptions do not establish how the synthesized samples sound to a listener.

## Reproduce and verify

From the repository root, use Node 22.12 or newer and install the locked dependencies with `npm ci`. The synthesis, engine and pack checks run without a browser:

```sh
node --test tests/audio-synthesis.test.mjs tests/audio-engine.test.mjs tests/audio-pack.test.mjs
```

For the optional Web Audio test, install Playwright Chromium with `npx playwright install chromium`, or set `AUDIO_CHROMIUM_PATH` to an existing compatible executable:

```sh
AUDIO_BROWSER_TEST=1 node --test tests/audio-browser.test.mjs
```

The optional test skips during `npm test` unless `AUDIO_BROWSER_TEST=1` is set. It starts an isolated loopback fixture and closes the browser/server afterward. It exercises trusted-click opt-in, live scheduling, the production mix through `OfflineAudioContext`, voice bounds and cancellation. The app's sound UI and visibility behavior are exercised separately by `npm run test:browser`; deferred-enable cancellation is covered by `tests/review-contracts.test.mjs`.

To regenerate the reusable pack:

```sh
node scripts/render-audio.mjs
```

This rewrites the generated WAVs and manifest in `public/audio/`; retain any custom versions before regenerating. The pack test checks the exported file set, RIFF/WAVE format and decoded PCM, and directly compares each seeded signature with fresh synthesis. The demonstration has an authored emission/arrival timeline rather than a captured performance.

### Repeatable audio-authoring workflow

Keep event ownership and world units explicit. Check deterministic layers, signal envelopes, finite samples and digital headroom separately from listening judgments. Compare regenerated signatures directly with the decoded pack. Exercise offline mix rendering and trusted-click live scheduling separately, drive the bus above its live voice cap, and cancel queued as well as active sources. Keep source quotations beside the authored parameter choices; a successful API call is not evidence of perceived realism.

Automated audio coverage targets Node and Chromium. Safari/iOS behavior, speaker/headphone reproduction and device output latency require tests on the target devices. Digital PCM bounds do not establish physical sound-pressure levels or environmental propagation fidelity.

## Sources

[2] https://doi.org/10.1121/10.0043590
[3] https://designingsound.org/2011/07/19/the-recordist-releases-fireworks-show-hd-library
[4] https://openstax.org/books/university-physics-volume-1/pages/17-2-speed-of-sound
[6] https://www.npr.org/transcripts/484713012 — Sounds of the Fourth: NPR interview with Dr John Conkling
[7] https://www.americanpyro.com/glossary-of-pyrotechnic-terms
[8] https://www.prosoundeffects.com/categories/firework-sound-effects
