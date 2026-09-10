# AFTERLIGHT audio

The app uses three imported MP3 recordings for lifts, ordinary bursts and crackle, plus original procedural audio for other families. Fountain and waterfall have fresh finite sizzle textures rather than replaying the old short sound. The original synthesized WAV pack is retained unchanged as an export/fallback reference.

**Imported audio rights are UNVERIFIED; inclusion in this release grants no recording rights.** The code and original synthesized WAVs are MIT-licensed; that grant does not establish rights to `lift1.mp3`, `burst1.mp3`, or `crackle-sm-1.mp3`. See [`public/audio/recordings.json`](../public/audio/recordings.json) and [`NOTICE-recordings.txt`](../public/audio/NOTICE-recordings.txt). Recording authorship and redistribution permission remain unresolved; attribution to an engine author is not recording ownership.

Acoustic cues are researched; numerical synthesis settings are authored. **No human listening test was performed.** This is a stylized perceptual model, not calibrated blast acoustics or a speaker-safety guarantee.

## Integration API

The application in [`src/main.js`](../src/main.js) owns the sound preference and visibility policy. It stores `soundPreferred` at `afterlight:sound:v1`. Hiding/pagehide calls `suspend()` without clearing consent or preference; visible/pageshow/focus may call `resume()` on this already-consented, enabled context. Explicit mute calls `setEnabled(false)` and blocks restoration. Disposal cancels audio but preserves the saved preference.

A fresh page still constructs no AudioContext automatically. If sound was previously preferred, the first trusted pointer interaction or meaningful key invokes `enable()`; the sound button is excluded from this restoration path to avoid a double toggle. `enable()` starts directly in the gesture stack. The app must check request identity, visibility and disposal after asynchronous completion. An old enable/resume or sample decode cannot override a newer mute, suspend or enable request.

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
// On visible/pageshow/focus: restore only the already-consented enabled context.
await audio.resume();
// Fresh reload / explicit mute still requires enable() in a trusted gesture.
// On teardown:
await audio.dispose();
```

| Method | Contract |
| --- | --- |
| `constructor({volume=0.6, enabled=false}={})` | Allocates no context and plays nothing. Even `enabled:true` cannot confer gesture consent. |
| `enable(): Promise<boolean>` | Create/resume the owned context under a gesture. Returns false if blocked, unavailable, superseded, or disposed; exposes `lastError`. Starts local sample loading after successful consent, but does not wait for downloads or decoding. |
| `setEnabled(boolean)` | False cancels all voices and suspends the context. True alone never creates, resumes, or re-enables audio; call `enable()`. |
| `setVolume(0..1)` | Clamp finite values; reject nonfinite input. Smooth a live gain change. Volume zero drops new events rather than keeping inaudible voices. |
| `setListener([x,y,z])` | Three finite world-meter coordinates, default `[0,70,400]`; returns false for invalid input. |
| `emit(event)` | Returns schedule metadata or false. `kind` is `launch`, `burst`, `crackle`, `whistle`, `fountain`, or `comet`; finite `power` clamps to 0.5–2; `time` must be finite simulation seconds. |
| `stop()` | Cancel all scheduled/active voices and clear event cooldowns, preserving enabled state and reusable buffers. |
| `suspend(): Promise<boolean>` | Stop voices and suspend the owned context; remember prior opt-in, never install a visibility listener. |
| `resume(): Promise<boolean>` | Caller-owned continuation, including visible/pageshow/focus. Refuses without previous successful opt-in, after mute, or after disposal. No missed sounds are replayed. |
| `whenSamplesReady(): Promise<boolean>` | Optional diagnostic await for the current three-sample load. False on incomplete, cancelled or failed loading. It never enables audio or schedules/replays events. |
| `dispose(): Promise<void>` | Idempotently stop/disconnect sources and graph, clear buffers, close only this engine's context. Cannot be re-enabled. |
| `getStats()` | Copies of lifecycle state, voice/buffer counters, last schedule/error, plus per-sample `state`/`errors`, ready count/bytes, and continuous voice/PCM bounds. `bufferBytes` includes decoded recordings, cached synthesis, and active finite sizzle buffers. |

`emit()` schedule metadata includes `id`, `signature`, `when`, `delay`, `distance`, `gain`, `pan`, `playbackRate`, `simulationTime`, `lateBy`, and `endsAt` (seconds). `sample` identifies the selected MP3 or is null for synthesis; `texture` identifies a continuous sizzle. The engine uses `AudioContext.currentTime` captured **at emission**, plus Euclidean distance divided by 343 m/s. It does **not** interpret simulation time as the AudioContext epoch. Speed 343 m/s is the authored still-air approximation for about 20 °C, consistent with the textbook value.[4]

The source's actual start is `max(currentTime after buffer creation, emissionTime + delay)`. A first-use cold synthesis at very short distance can therefore be late; `lateBy` reports it instead of scheduling into the past. Cached subsequent sounds do not regenerate PCM. The compressor/device can add further latency: this is not a sample-perfect audiovisual output-latency calibration. Listener motion after an event has been emitted does not retime that sound; the position is sampled at emission. Panning assumes a listener facing -Z, not an arbitrary camera rotation. Delays beyond 30 seconds are rejected as an authored resource bound.

### Discrete type rules

- Ordinary `burst` selects local `burst1.mp3`, including the initial crossette burst. `salute`, `white-salute`, `white_salute`, `whiteSalute`, and `maroon` report IDs keep the original salute synthesis. A launch is still only a launch, including a salute's launch.
- Every `crackle` event selects local `crackle-sm-1.mp3`. The simulation already emits distinct, later `crackle` events for crossette splits and crackling stars; no extra event, delay, or initial-burst substitution is added.
- Only an explicit `whistle` event produces the tonal whistle. Bees/tourbillon/etc. do not whistle merely because of their visual name; the simulation decides which event is appropriate.
- Every `launch` event selects `lift1.mp3`. Roman-candle shots already emit `kind: 'comet', effectId: 'roman-candle'`; that exact combination now selects the same lift. Ordinary comet events retain their original synthesis. Roman-candle cadence is unchanged.
- Fountain and waterfall `fountain` events select the finite continuous treatment described below. Wheel and set-piece, which also use the `fountain` event kind, retain the original synthesis. Whistle, salute and ordinary comet timbres are unchanged.
- Same-family/source-cell launch events have a 75 ms cooldown; comet 120 ms; crackle 45 ms; whistle 1.6 s; fountain 3.2 s. These guards suppress repeated frame notifications; they do not replace correct discrete simulation events. Cells are 8 m, and event-time duplicates are suppressed briefly. This may intentionally merge very close simultaneous sources with identical IDs/times.

### Bounded mix

Each voice owns a buffer source, low-pass filter, stereo panner, and gain. Ordinary pitch and gain vary deterministically across the event sequence; power also shifts pitch slightly. Continuous sources use rate 1 so pitch variation cannot move their endpoint. The distance gain and low-pass curves are **mix choices**, not measured atmospheric absorption, inverse-square SPL calibration, obstruction, terrain, weather, Doppler, or reverberation simulation.

The bus is `gain → compressor → bounded WaveShaper → master volume → destination`. The live cap remains **40 voices**, including propagation-delayed sources. Continuous sources have an additional **8-voice** cap. A higher-priority report can replace an older/lower-priority voice. There is no persistent oscillator, audio animation loop, worklet, large audio library, global audio singleton or engine-owned visibility listener. A sample-loading timeout bounds I/O; it is not an audio event scheduler. PCM and the mix have digital headroom; this does not establish safe real-world loudspeaker/headphone exposure.

## Local recordings and loading

The three original MP3 files total **85,252 bytes**. At the tested Edge 48 kHz context, native decoded durations are 0.459354 s (lift), 1.409188 s (burst), and 1.471938 s (small crackle); all decode as stereo. Native decoder/resampling rounding accounts for the lift's slight difference from ffprobe's original 44.1 kHz duration. Files are retained without trimming, transcoding or inserted leading silence.

Only a successful consent activation starts fetching. Paths resolve as `BASE_URL + 'audio/<filename>'` against the page document, so a relative-base build under a nested directory does not request the origin root or an external host. The PWA build includes the three bundled MP3s in its inventory; runtime fetches never use the source CodePen URLs. Already-decoded buffers play offline without another request. A fresh offline installation still requires its assets to have been cached.

Fetch/decode runs independently of `enable()` and `emit()`. While loading or after failure, the original synthesis plays immediately at the existing event schedule. A completed decode affects only future events; it never replaces or replays an earlier cue. Missing/corrupt files expose per-sample fallback errors, without blocking the other samples. The load has a five-second deadline, a 1 MiB encoded-file limit and a ten-second decoded-duration limit. Failed samples may retry on a later enable/resume, never from each emitted event.

Mute, suspend and disposal abort pending I/O. Generation guards reject late native decoder results, which cannot otherwise be cancelled by Web Audio. Loaded buffers may be reused after consented restoration; disposal frees them. `whenSamplesReady()` is useful for diagnostics, not required for the application's sound-toggle state.

## Fountain and waterfall continuity

Actual simulation traces emit once at effect start and renew once when age reaches 3.25 seconds (3.258333 s in the captured fixed-step trace). Fountain emits particles for 6.5 seconds; waterfall for 6 seconds. Previously both reused a cached 3.6-second waveform with a fresh attack on renewal. Its sustained noise had sine-amplitude components at 2.116761 and 6.222958 Hz, in addition to the repeated noise/grain pattern. There was no literal `BufferSource.loop`; the repeated cue and periodic waveform caused the loop-like result.

`src/audio/sizzle.js` generates a new finite mono filtered-noise bed for each burn. Quiet smooth random drift replaces the periodic modulators, with one 60 ms onset and a 220 ms release **inside** the effect duration. A renewal of a live emitter does not create a new source or attack and returns `continued: true` with the original schedule. No extra propagation or event delays are added. Each normal full-duration source uses 1,248,000 bytes (fountain) or 1,152,000 bytes (waterfall) at 48 kHz; buffers are uncached and released on natural completion, stealing, stop, mute or disposal.

For exact overlapping-source and mid-effect handling, emitter events accept `emitterId`, `emitterAge`, and `emitterDuration`. A renewal received after a missed initial cue renders only `emitterDuration - emitterAge`, not another full burn. Emitter identity prevents a new source at the same location from being mistaken for a renewal. The audio layer retains a legacy single-source fallback, using known durations and the existing 3.25-second renewal interval; unannotated coincident sources or a missed initial cue cannot be distinguished perfectly. The simulation supplies that emitter metadata without changing cue timing.

Measured 10 ms RMS-envelope line amplitudes, relative to mean envelope, fell from 24.08% / 14.27% at the two old modulation frequencies to 0.23% / 0.067% for fountain and 0.30% / 0.112% for waterfall (seed 7349). Raw RMS is 0.0580 / 0.0499; source peaks 0.1699 / 0.1455. Browser renders stay continuous through renewal, are silent before arrival and after their finite end, and release their buffers. These are signal and scheduling measurements, not a human listening assessment.

## Original synthesis and reusable exports

`src/audio/synthesis.js` remains pure ESM with no DOM, Web Audio, Node, or third-party dependencies. Its waveforms and original WAV exports are unchanged; the only routing change there is Roman-candle `comet` events selecting `launch`:

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

License: [`public/licenses/audio.txt`](../public/licenses/audio.txt) contains the MIT permission grant for the original source and generated WAV pack. That original notice does not license the three imported MP3s; `recordings.json` and `NOTICE-recordings.txt` record their unresolved rights separately. Cited prose and retrieved publisher text retain their respective source rights and are **not** an audio sample license. No recordings from the commercial acoustic-reference sources below were obtained or used.

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
node --test tests/audio-synthesis.test.mjs tests/audio-engine.test.mjs tests/audio-pack.test.mjs tests/audio-revision.test.mjs tests/audio-samples.test.mjs
```

For the optional Web Audio test, install Playwright Chromium with `npx playwright install chromium`, or set `AUDIO_CHROMIUM_PATH` to an existing compatible executable:

```sh
AUDIO_BROWSER_TEST=1 node --test tests/audio-browser.test.mjs
npx playwright test tests/audio-samples.spec.mjs tests/audio-samples-bundle.spec.mjs
```

The optional Node browser test skips during `npm test` unless `AUDIO_BROWSER_TEST=1` is set. It exercises trusted-click opt-in, live scheduling, the production mix through `OfflineAudioContext`, voice bounds and cancellation. The sample Playwright suite uses its own ephemeral loopback servers and an isolated Vite library build in `evidence/audio-revision/`, without touching shared `dist`. It verifies actual MP3 decode/render, nested paths, cached offline reload without autoplay, finite continuous rendering, corrupt/missing asset fallback, and cancellation during held native decodes. The offline cache fixture is not a claim that the full application PWA was rebuilt or deployed. App sound preference/visibility checks remain the application's separate browser tests.

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
