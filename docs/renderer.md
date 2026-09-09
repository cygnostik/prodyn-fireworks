# AFTERLIGHT renderer

[`src/engine/engine.js`](../src/engine/engine.js) exports **`AfterlightEngine`**. This is an original procedural Three.js r186 / WebGL 2 renderer and a seeded artistic simulation, not a calibrated pyrotechnic predictor. The 3D scene does not load textures, photographs or particle meshes.

## Integration contract

```js
import { AfterlightEngine } from './engine/engine.js';
const engine = new AfterlightEngine(canvas, {
  quality: 'auto', reducedMotion: false,
  onEvent: event => audio.emit(event),
  onError: error => showRendererFailure(error),
});
engine.resize(widthCss, heightCss, devicePixelRatio);
const result = engine.launch({
  effectId: 'chrysanthemum', palette: 'gold', position: 0,
  scale: 1, seed: 932, loft: 1,
});
if (!result.ok) showLaunchUnavailable(result.reason);
// The application clock, and ONLY that clock, calls these:
engine.update(dtSeconds);
engine.render();
```

**Important:** `launch()` returns `{ok:false, reason, effectId}` for unknown IDs, pool pressure, lost context, or disposal. It does not throw for those expected failures. Do not increment the UI's launch counter unless `result.ok` is true. Success includes `id`, `effectId`, `seed`, normalized `position`, `scale`, and `loft`.

- `position`: across the firing ground, clamped to `-1…1`; positive X is audience-right.
- `scale`: clamped to `0.55…1.6`; `loft`: `0.65…1.35`. Loft affects airborne launch trajectories, not mounted or continuous ground fixtures.
- Integer seeds use their unsigned 32-bit representation. Omitted seeds use a deterministic per-engine sequence. Repeatability assumes the same quality, launches, settings and update sequence.
- `update(dt)` advances **simulation only**, in fixed `1/120 s` steps. Non-finite/non-positive deltas are ignored; a call advances at most `0.1 s`. No RAF, timers, DOM input handlers, autoplay, or audio context is owned here.
- `render()` redraws without advancing time and returns a boolean. This supports actual pixel-stable pause and camera changes while paused.
- `resize(widthCss,heightCss,dpr)` changes the real drawing buffer, including DPR-only changes; ignores zero or invalid dimensions. The application owns ResizeObserver/window listeners.
- `setOptions({quality,wind,exposure,reducedMotion,reflections})`. Wind is X-axis m/s, clamped `-12…12`; exposure `0.35…2.3`. `auto`, `low`, `balanced`, and `high` are supported (`medium` is accepted as `balanced`).
- `setView('audience'|'close'|'wide')` changes the real perspective camera immediately. `orbit(dx,dy)` accepts **CSS-pixel drag deltas**, not radians. Camera positions are available through `getCameraPosition()` for audio propagation.
- `reset()` clears all live/pending effects, smoke, time and frame count. It preserves the view/options. It does not itself redraw.
- `dispose()` is idempotent, removes owned listeners, disposes geometry/materials/reflection/composer targets and the renderer, and prevents further launches.
- No WebGL 2: the constructor calls `onError(Error)` and throws. Context loss calls `onError`, pauses simulation and rejects launches. Recovery/retry messaging belongs to the application. No 2D fallback is passed off as WebGL.

`getStats()` includes the required `{time,activeParticles,activeShells,drawCalls,quality,backend:'webgl2',frame}` plus stars, emitters, smoke, dimensions, DPR, triangles, rendered segments, geometry/texture counts, launched/burst/drop counters and loss/disposal flags. Particle totals mean active stars plus spark residue; smoke and shell heads are separately reported. `drawCalls` aggregates the scene, actual mirrored scene and postprocessing passes rather than reporting only the last full-screen pass.

Events have `{kind,effectId,position:[x,y,z],power,time}`; power is bounded `0.5…2`. They occur at visual-source simulation time, with fixed-step granularity: launches at the ground, main/satellite breaks at their actual centers, crossette/crackle split accents at selected visible split centers, finite fountain/wheel/curtain hiss renewal while emission is active, and individual Roman-candle launches. There is **no acoustic-distance delay** in the renderer. Satellite events preserve `effectId:'shell-of-shells'`. No effect is assigned an automatic whistle solely because it moves.

## Rendering architecture

- **`simulation.js`**: DOM-free typed-array pools, seeded shell choreography, analytic linear-drag ballistic launch integration, fixed-step particle dynamics, staged splitting, fixture and continuous emitters. The default pools hold 6,000 burning stars, 56,000 residual spark/filament segments and 360 smoke wisps. Saturation drops optional emissions rather than reallocating; `droppedParticles` exposes star/spark loss.
- **`particles.js`**: one batched hot-core `Points` draw, one batched fine-filament `LineSegments` draw (also carries the small wheel mount), and one instanced smoke-quad draw. Filaments persist in world space after their head passes and cool/drift/fall independently. Small white-hot cores sit inside colored emission, not large neon discs. WebGL lines intentionally stay fine; thick arms accumulate brighter dense residue and core bloom instead of relying on unsupported wide WebGL lines.
- **`environment.js`**: original spherical night atmosphere, procedural stars/moon, layered genuinely depth-separated mountain strips, merged conifer silhouettes and a dark land apron. The lake is an actual clipped planar reflection of the scene, with multi-frequency ripples, rough multi-tap filtering, broken grazing highlights and restrained reflectance. It is not a duplicated 2D firework sprite.
- **`engine.js`**: ownership/lifecycle, perspective cameras, WebGL 2 renderer, multisampled half-float scene target, restrained `UnrealBloomPass`, and one final `OutputPass` for ACES/display conversion. The audience view frames the firing-ground waterline near the bottom quarter and keeps low fixtures visible; the mountain silhouette rises above that waterline. Bloom uses localized mip weights scaled to actual drawing-buffer height: broad blur weights can wash out the upper sky on a small canvas. Simulation and ambient time freeze when the application stops updating. Reduced motion freezes sky/water animation, slows strobe cadence and attenuates burst flashes; it does **not** abolish deliberately launched fireworks or guarantee photosensitive safety.

Smoke uses original procedural noise on camera-facing instanced quads. Its color receives light from eight spatially aggregated live-star/flash sources; puffs expand and drift with wind. It is a **billboard approximation**, not fluid simulation, volumetric ray marching or physically measured scattering. Its light and opacity remain quiet enough to preserve thin trails.

All spatial coordinates are metres and times seconds so audio distance has a consistent world. Trajectories, effective particle gravity, drag, star reach, exposure, moon angular size, emission brightness and burn durations are **art-directed**. Spark apparent size is camera/distance-aware, not a model of actual star diameters. The scene is not a reconstruction of a real lake, date, launch site or firework manufacturer.

## All 40 IDs and the chosen visible variants

Names are not a universal disjoint taxonomy. The source study is in [`research/fireworks.md`](research/fireworks.md); the public specifications and source references are in [`research/field-guide-data.json`](research/field-guide-data.json). These are authored implementations of described morphology, not copied source code or calibrated parameters. The research IDs `star-pattern` and `waterfall-curtain` map to the application's stable `star` and `waterfall` IDs respectively.

| ID | Implemented distinction |
|---|---|
| `peony` | Tailless points on an expanding 3D sphere. |
| `chrysanthemum` | Dense radial fine spark filaments and moving hot heads. |
| `dahlia` | Fewer, larger, longer-lived tailless points with more reach. |
| `diadem` | Brief compact contrasting central cluster plus an authored metallic trailing crown and later colored tips. The surrounding crown is a deliberate composite, not a claim that every diadem has these trails. |
| `pistil` | Outer sphere plus one smaller simultaneous spherical core. |
| `double-pistil` | Outer sphere plus **two** inner cores: three total 3D layers. |
| `multi-pistil` | Outer sphere plus **three** inner cores: four total 3D layers, separated radii and contrasting palettes. |
| `willow` | Broad globe opening, long fine amber trails and pronounced drooping descent. |
| `brocade` | Fuller, denser golden umbrella with more residue than willow. |
| `kamuro` | Subdued, sparse, very long hanging warm-gold crown preset. |
| `nishiki` | Fuller, brighter pale-gold/whitish canopy with granular glittering residue. Kamuro/nishiki naming overlaps; these are differentiated **presets**, not disjoint traditional species. |
| `palm` | Nine brighter thick-trailing arms above a persistent rising comet trunk. Nine is authored, not a universal frond count. |
| `spider` | Sparse, very fast radial spokes followed by strong drag and short settling. The readable duration is stretched relative to the research's short reference preset. |
| `horsetail` | Narrow one-sided rising plume that turns over into a closely grouped descending tail; not a full spherical willow. |
| `ring` | Audience-readable expanding planar ring with small depth/tilt. |
| `saturn` | Tilted elliptical ring around a separate central 3D sphere. |
| `heart` | Recognizable planar heart with small orientation/depth variation. |
| `star` | Authored five-point **star pattern**, not the generic luminous particle meaning of “star.” ID is preserved. |
| `spiral` | Authored expanding spiral pattern with a little depth, not a claim about a standard shell name. |
| `smiley` | Expanding circle, two eyes and curved smile, oriented toward the audience. |
| `crossette` | Traveling stars later split into four smaller arms; sparse localized split accents. |
| `crackle` | Irregularly delayed short granular secondary flashes rather than a single simultaneous glitter sphere. |
| `strobe` | Independent intermittent burning-head flashes. |
| `glitter` | Delayed scintillation belongs to trailing residue, not a blinking head. |
| `falling-leaves` | Tailless, high-drag soft points, mild flutter and shared wind; no active propulsion. |
| `bees` | Compact erratic accelerating swarm with correlated turns, not positional white noise. |
| `fish` | Looser wriggling trajectories and short curving traces; an authored distinction from overlapping bees terminology. |
| `tourbillon` | Drifting/spinning elements with local curled traces, not the fixed spiral outline. |
| `ghost` | The **same expanding stars** dim and reappear/change color in a left-to-right spatial phase. No second explosion. |
| `color-change` | Same stars change composition color at a shared time, with no additional burst. |
| `shell-of-shells` | A parent distributes satellite sources that later make spatially separated smaller flowers. |
| `comet` | A single ascending bright head and persistent tail; no terminal spherical burst. |
| `mine` | Immediate broad low cone of stars directly from the firing ground. |
| `fan` | Seven simultaneous spatially separated angled lanes, presented as a fan-of-comet-stars choreography preset. Not a unique spherical burst or a left-right chase. |
| `fountain` | Finite sustained low upward spray, with old sparks falling while fresh ones rise. |
| `waterfall` | **Suspended horizontal curtain**, shedding downward sparks. This ID deliberately does not mean aerial waterfall or horsetail. |
| `roman-candle` | Seven separately timed rising colored comets from one anchor, no terminal breaks. |
| `salute` | Short compact flash, sparse brief hot accents and smoke rather than a full colorful flower. |
| `wheel` | Fixed low mounted hub/rim and three rotating spark streams, with outward motion then gravity; it does not fly. |
| `set-piece` | Sixty stationary colored light elements outlining one original low five-point figure. They stay fixed in wind and fade together. No arbitrary lettering. |

Fixed colour palettes include `gold`, `silver`, `ruby`, `jade`, `azure`, `violet`, `multicolor`, `ember`, `patriot` and `guatemala`; invalid keys fall back to gold. `signature` cycles through an effect's authored looks. The metallic canopy identities and contrasting cores are artistic choices, not measured emission spectra. Consult the catalog and engine exports rather than hardcoding a separate palette map in a client.

Figure shells are intentionally audience-facing, not randomly tumbling out of recognition. Their orientation does not billboard to arbitrary orbits; edge-on views may compress the figure. Effective gravity/drag and the long-lived canopy presets are stylized. No construction guidance or pyrotechnic safety calibration is provided.

### Colour and depth updates

Guatemala uses blue and white across stars, branches, trails and emitters. Smiley always uses a yellow outline, two hollow blue eye circles and a red mouth, independent of the selected palette. Signature cycles per effect; an explicit integer `variation` makes a cue repeatable. Metallic canopy trails have independent colours so coloured tips retain their effect's character.

Accepted launch centres advance from `z=-125` toward `z=15` without wrapping behind an occupied sky. Once the sky is empty, a new sequence starts at the far depth. Clearing also resets the colour counters. The normalized firing half-width is `220` in Audience, `310` in Wide and `150` in Close view. `getStats()` exposes the view, firing width, next depth and a copied `lastLaunch` record. Regression coverage is in [`tests/engine-colour-depth.test.mjs`](../tests/engine-colour-depth.test.mjs) and [`tests/engine-boundaries.test.mjs`](../tests/engine-boundaries.test.mjs).

## Quality and verification workflow

| Profile | Emission density | DPR cap | Reflection width | Scene MSAA |
|---|---:|---:|---:|---:|
| low | 0.52 | 1.25 | 640 | 0 |
| balanced | 0.80 | 1.50 | 960 | 2 |
| high | 1.00 | 2.00 | 1440 | 4 |

`auto` conservatively chooses low for small touch/low-memory clients and balanced otherwise; it does not chase FPS or change quality while a show plays. Pool allocations remain stable across quality switches. This is not a promise of 60 FPS on every GPU.

From the repository root after `npm ci`, run the engine tests and the production app browser suite:

```sh
node --test tests/engine*.test.mjs
npm run build
npm run test:browser
```

See the [README](../README.md#development-and-checks) for Chromium setup and port overrides. The engine tests cover seeded simulation, gravity/drag, effect morphology, finite lifetimes, event ownership and pool bounds. The app suite exercises the actual renderer, controls, pause and Finale rather than a separate renderer demo.

For a reproducible frame, open the running app with `?test=1`, wait for the sky to be ready, then use the browser console. This example clears the current sky and stops its Finale:

```js
const app = window.__afterlight;
if (!app?.ready) throw new Error('Wait for the sky to be ready');
app.setTestClock(true);
app.clear();
app.pause(false);
app.fire({ effectId: 'chrysanthemum', palette: 'gold', seed: 932, position: 0 });
app.step(5.6);
app.pause(true);
console.table(app.stats().engine);
```

`setTestClock(true)` is gated by `?test=1`; `step(seconds)` requires that manual clock and accepts finite values from 0 to 120. The helper advances the app clock and draws once at the end. `window.__afterlight.stats()` exposes engine, audio and PWA snapshots. It is a diagnostic surface, not a replacement for the `AfterlightEngine` integration contract. To return to normal playback, call `app.setTestClock(false)` and `app.pause(false)`.

For repeatable visual comparisons: use an explicit seed, fixed update steps, a named view and fixed dimensions/DPR; call `render()` only after reaching the desired simulation time. Capture the actual canvas. Inspect both the clean sky and populated scene, include the fading tail phase and the later satellite/reappearance phase, and do not confuse a deliberately dark ghost interval or already-ended crackle with a failed effect. Keep screenshots/records on disk and count/deduplicate IDs programmatically.

### Interpreting browser checks

Automated browser coverage targets Chromium at desktop and narrow/mobile-sized viewports. Viewport emulation is not a physical iOS/Android test, and software-rendered Chromium with ANGLE/SwiftShader does not establish hardware frame-rate budgets. Safari and Firefox need separate compatibility checks.

When profiling, distinguish CPU update and render submission from GPU completion; submission time is not FPS. Screenshot/PNG readback can itself stall rendering. Check drawing-buffer dimensions, DPR, quality and workload alongside timings, and compare clean sky, mature trails and overlapping effects. These checks do not establish calibrated HDR, colorimetry or real-world firework timing.
