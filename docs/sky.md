# Moonlit meteors

Quiet, silent background meteors for the existing lakeside fireworks scene. The Moon, procedural stars, lake, mountain geometry, cameras, UI and firework/Guatemala palettes are unchanged. This is an **authored near-peak Geminid reference**, not everyday sporadic activity, a planetarium or a live sky prediction.

## Observing evidence

These are the scientific constraints, separate from the display choices below. Quotations are from the retrieved publisher pages; the local evidence package retains the retrievals and a verified citation ledger.

| Atomic claim | Primary-source wording | Consequence |
|---|---|---|
| Most faint meteors appear white below the observer's colour threshold.[1] | “Most faint meteors will appear white only because they are below the observer's color threshold.” | Predominantly pale, including easy-to-miss events. |
| Typical meteor durations are fractions of a second.[1] | “The average meteor duration is more like 0.4 second.” | Short events, not multi-second comets. |
| Most Geminids last less than one second.[2] | “Most Geminids will still last less than one second as they streak through the sky.” | Lives bounded to 0.24–0.68 s. |
| Persistent trains and fragmentation are uncommon for this shower.[2] | “Fragmentation and persistent trains are rare for Geminids.” | Only a short moving luminous segment; no persistent train or fragmentation. |
| Shower trajectories appear to diverge from a radiant because of perspective.[5] | “Because meteor shower particles are all traveling in parallel paths, at the same velocity, they will all appear to radiate from a single point in the sky to an observer below.” | Parallel physical flight vectors, not random diagonal screen velocities. |
| Apparent paths are foreshortened near the radiant.[2] | “Geminid meteors will appear slowest and shortest near the radiant.” | Derive angular motion from range and radiant separation. |
| The IMO reference gives radiant RA 112°, Dec +33°, speed 35 km/s and population index 2.6.[3] | “Radiant: α = 112◦, δ = +33◦; Radiant drift: see Table 6;” and “V∞= 35 km/s; r = 2.6.” | Use those stream parameters, with a frozen local orientation. |
| A broad meteor-region guideline is 80–120 km high.[5] | This “meteoric region” lies between about 80 km and 120 km (50 to 75 miles) in altitude. | Start in a 100–112 km spherical shell; verify endpoints remain above 80 km. |
| NASA describes a yellow tendency.[4] | “The Geminids are bright and fast meteors and tend to be yellow in color.” | A diluted warm accent is plausible, not mandatory. |
| AMS describes green in the brightest Geminids.[2] | “The brighter Geminids can possess any color, but the brightest ones tend to be green.” | An uncommon diluted blue-green accent, not a spectral/compositional claim. |
| Rates have real lulls; an hourly rate does not imply evenly spaced events.[2] | “When quoted hourly rates are 60, this does not mean you will see one meteor every minute.” / “There will be 5 to 10 minute periods when little activity is evident.” | Irregular arrivals with long empty intervals. |
| AMS's approximate Geminid full-Moon/city observing rate is 20/hour, not the table's 120 ZHR.[5] | Rate column 1: “city sky or rural sky with full moon,”; Geminid table values in columns 1–4: 20, 50, 75, 120. | Moonlit candidates are not advertised as ZHR or guaranteed sightings. |
| Low-elevation light is further attenuated by the atmosphere.[5] | “Also, the light from a meteor near the horizon must pass through much more atmosphere to reach the observer than for a meteor overhead, further attenuating the light from meteors at low elevation angles.” | Lower contrast toward the horizon. |

### Differences and limits in those sources

NASA's “fast” description and AMS's “medium velocity” description use different qualitative labels; the implementation uses the numerical 35 km/s reference, not either adjective.[4][2][3]
NASA's yellow tendency and AMS's green description concern different brightness/observing contexts; neither establishes numerical colour frequencies.[4][2]
IMO's 2026 calendar lists a moon-free peak and ZHR 150, whereas the older AMS table gives ZHR 120 and separately labels its Moon-affected observed rates; these are not interchangeable predictions for this frame.[3][5]
**No 2026 lunar position or event forecast is claimed.** Narrow low-altitude framing, adaptation, weather, light pollution, screen brightness, subpixel position and a viewer's attention all limit what this artistic model can establish. In particular, an intensity or pixel-difference threshold below is not a measured human detection threshold.

## Chosen local orientation — calculated, not fetched ephemeris

Assume **34° N, 118° W**, a Southern California reference latitude/longitude, not a surveyed lake site. Use a **westward pre-dawn** view on an idealized near-peak Geminid night with a full Moon. The IMO peak solar longitude is 262.2°.[3] For the construction, place an ideal Moon opposite that longitude at ecliptic longitude 82.2°, latitude 0°, and use an assumed mean obliquity of 23.4393°. This yields ideal Moon RA 81.508286°, Dec +23.209668°.

The old sky sphere is centred on the world origin, **not the camera**. Preserve its radius 2200 and exact shader direction `normalize(vec3(.51,.47,-1.))`. The actual audience eye `[0,90,455]` sees the disk-centre ray as:

```text
normalize(2200 * normalize([.51,.47,-1.]) - [0,90,455])
= [0.3603175062, 0.2968840559, -0.8843252524]
```

1. Solve the **setting** Moon hour angle from that ray's altitude and the ideal Moon declination at 34° N.
2. Solve the world's compass heading so the unchanged ray has that Moon azimuth.
3. Transform the sourced Geminid radiant at the same local sidereal angle.

| Computed quantity | Value |
|---|---:|
| World −Z compass heading | 264.576189° |
| Local sidereal angle | 165.745418° |
| Ideal Moon hour angle | +84.237132° |
| Apparent Moon altitude / azimuth | 17.270548° / 286.744582° |
| Geminid radiant altitude / azimuth | 45.703423° / 284.442881° |
| Radiant world direction | `[0.2373299468, 0.7157344590, -0.6568094705]` |
| Moon–radiant angular separation | 28.497554° |
| Audience pitch / vertical FOV / horizontal FOV at 16:9 | 2.470051° / 48° / 76.724474° |

The radiant is **above and right of the audience frame**, not a drawn constellation label. Meteors below it spread away, with screen slope varying across the field. The ideal full-Moon construction also puts the Sun below the opposite horizon; this is an orientation compatibility check, not an actual civil time. Longitude locates the reference region; without a date it does not determine a sidereal clock.

The unit test independently transforms the ideal ecliptic Moon and requires it to match the actual authored ray, then checks the radiant in the same coordinate frame. Matching lunar altitude and declination alone is insufficient for that geometry check.

The scene remains frozen in this reference orientation. It does not evolve sidereal time, lunar phase/size, refraction, stream drift or stellar positions. The original Moon's artistic disk size and finite sky-sphere parallax are retained.

## Flight and display mapping

**Physical geometry:** choose start rays in a fixed upper portion of the canonical audience frustum (`xNDC = ±0.92`, `yNDC = 0.34…0.94`). This window does not track a dragged camera or spawn around the Moon. Intersect each ray with a spherical 100–112 km atmospheric shell using Earth-radius assumption 6371 km. Move in kilometres with constant `velocity = -35 * radiant`. Normalize the moving physical position to obtain its apparent ray. Project the ray back onto radius 2198, just inside the unchanged sky sphere, using the actual audience eye. Depth testing preserves foreground silhouettes and the existing rough lake reflection.

The first 300 deterministic events span angular paths **0.622–3.668°** and initial apparent speeds **2.337–5.562°/s**. These are measured model results, not claimed universal meteor ranges. The physical trajectory is straight; perspective may change angular speed slightly. No curved steering, wind-driven head or giant head sprite is used.

**Artistic, not calibrated photometry:** sample a truncated magnitude-shaped brightness proxy over −0.5…3.8, using the sourced population index as a distribution slope. The diagnostic field `magnitude` is that proxy, **not an assigned apparent visual magnitude**. Its radiance-to-screen conversion is chosen for this existing filmic scene, not a model of camera exposure or the human retina.

- For brighter candidates, the tint draw is 78% pale, 16% diluted warm and 6% diluted blue-green. All proxies above 2.8 are forced pale. The first 300 actual candidates contain **274 pale, 21 warm and 5 blue-green**; these proportions are artistic, not measured spectral prevalence.
- Individual colour is constant through the event. No rainbow interpolation, saturated green laser, elemental-composition inference or borrowed firework palette.
- A smooth fast entrance and extinction envelope bounds each 0.24–0.68 s event. The displayed segment covers only the preceding 0.065–0.120 s of flight and vanishes with the head; this is not a persistent train.
- A thin Gaussian ribbon is an unresolved display point-spread approximation, not a physical metre width. It stays narrow at desktop and phone drawing-buffer sizes.
- Contrast multiplies a global Moonlit factor, elevation extinction, a soft 3–12° horizon fade, and local glare about the **actual apparent Moon ray**. The local glare scale and extinction coefficient are aesthetic proxies. Events within the disk/glow exclusion are suppressed rather than drawn over the Moon.

### Natural cadence

Production uses a private seeded renewal schedule:

```text
gap_seconds = 18 + Exponential(mean=132)
expected gap = 150 s → 24 candidate events per simulation hour
```

The 18-second minimum is an explicit anti-spam artistic constraint, not a claim that nature cannot produce close pairs. There is no maximum gap and no periodic loop. The fixed default seed is `0x6d657465`; the first candidate starts at **132.517430 s**, is nearly invisible beside the Moon, and the second starts at **313.267445 s**. Nothing is forced to streak immediately after load, launch, or reset.

This is an **upper-interest, frame-conditioned active-shower vignette**, not a calibrated all-sky flux model or a promise of 24 visible meteors/hour. A real narrow, low-altitude field can yield fewer. Using ordinary sporadic rates to justify this cadence would be misleading. Moonlight, short trails and faint candidates reduce the visibly useful count. In the rendered default first hour, **28 candidates** were sampled at 40% of their lifetime: **12** produced a maximum channel change of at least 20/255, **10** produced only 1–9/255, and none rounded entirely to zero at that specific sample. The remaining six fell between those bins. Those are repeatable pixel diagnostics at 1440×810/DPR 1, **not observer counts**.

**No accelerated production option, URL switch or UI control exists.** Evidence hosts seek forward to natural event times only. The 10-second evidence montage omits intervening minutes but preserves every shown event's original speed; it must not be mistaken for default cadence.

## Integration and lifecycle

- `environment.update(time, reducedMotion)` receives the existing simulation's seconds. The atmosphere/water still use their old `reducedMotion ? 0 : time`; meteors deliberately receive the unmodified time plus the preference flag.
- The engine's existing fixed-step clock and caller's one RAF remain the only owners of time. Re-rendering while paused leaves ages and schedule unchanged; the existing hidden-page handler stops that RAF. No independent timers/listeners are added.
- Reduced motion immediately clears active meteors and suspends their local elapsed time. Leaving reduced motion does not resurrect a cleared streak or replay a hidden backlog.
- Engine reset explicitly resets the meteor RNG, counts and schedule, including a reset at time zero. Invalid time is ignored. A defensive huge-jump loop budget skips excessive backlog without a burst.
- Meteors never emit simulation events or call audio. Their RNG instance is separate from fireworks, terrain and palette selection.
- One bounded two-slot `BufferGeometry` / `ShaderMaterial` ribbon batch; no event-specific GPU allocation, textures, lights or bloom pass. Zero additional draws when idle; at most one batch per camera when active. Capacity is two defensively; the default minimum gap makes simultaneous events unnecessary.
- `engine.getStats().meteors` returns copied arrays/records: generated count, active/recent events, ages, source/end/head directions, velocity, colours, brightness proxies/intensities, attenuation, path/range/height values and next birth. History is capped at 16; snapshots cannot mutate the simulation. Disposal removes the batch and disposes its owned geometry/material once.

## Verification

**New tests:** 9 Node tests in `tests/meteors.test.mjs`; 9 Playwright tests in `tests/meteors.spec.mjs`. The Node regression run included the neighbouring engine physics/colour/simulation tests: **36/36 passed**, including Guatemala, nested shells and deterministic firework choices. The isolated production browser run passed **9/9**, with no shader, page, console warning or resource errors. Browser lifecycle coverage includes pause/reset, a synthetic hidden-document transition and live reduced-motion changes; it does not claim a physical background-tab/BFCache or Safari test.

At 1440×810/DPR 1, final rendered examples had maximum baseline-subtracted RGB channel differences: visible **85**, faint **8**, near-Moon **1**, warm **111**, blue-green **54** (out of 255). Warm and blue-green channel ordering was checked after the real compositor. Full screenshots and unboosted pixel crops were inspected; the near-Moon event is effectively imperceptible, the faint one easy to miss, and the brighter examples remain short hairlines. The actual 10-second H.264 video was decoded and its motion frames inspected; no audio stream exists.

On Edge 152 / WebGL2 / ANGLE Metal / Apple M2 Max, compositor draw calls were **31 idle → 33 active** with reflection (**+2 triangles per camera / +4 total**). Reflection disabled adds only one draw. After 120 further generated events, GPU counts stayed **13 geometries / 14 textures**. Tiny 25-render wall-time samples had medians 0.102 ms idle and 0.102 ms active; these headless timing samples are noisy submission/wall-time observations, **not isolated GPU timings or an FPS promise**. The meaningful budget is one small active batch and stable resources.

Run the public regressions from the project root:

```sh
node --test tests/engine*.test.mjs tests/meteors.test.mjs
npm run build
npx playwright test tests/meteors.spec.mjs
```

The public suite runs the app lifecycle case and explicitly skips eight optional controlled-render fixture cases. The isolated fixture and research captures used for the measurements above are not distributed and are not build dependencies. The production app remains on natural cadence.

## Sources

[1] https://amsmeteors.org/mcleod/mcleod4.html
[2] https://www.amsmeteors.org/2022/12/viewing-the-geminid-meteor-shower-in-2022
[3] https://imo.net/files/meteor-shower/cal2026.pdf
[4] https://science.nasa.gov/solar-system/meteors-meteorites/geminids
[5] https://www.amsmeteors.org/meteor-showers/meteor-faq
