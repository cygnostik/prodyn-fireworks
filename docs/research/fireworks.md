# AFTERLIGHT: fireworks taxonomy and visual choreography

## Catalog design

**AFTERLIGHT has 40 catalog entries, not 40 independent physical types.** The catalog separates aerial geometry, texture/color transformations, moving inserts, ground/rising emitters and choreography. This grouping is authored for the interface and engine; the industry sources use overlapping naming systems.

A peony is a sphere of colored points; a chrysanthemum adds spark trails.[1][2]
A pistil is an inner sphere, while a crossette subdivides a moving star and a shell-of-shells creates new flower centers after the first event.[1][2]
These distinctions should survive every quality setting. Changing color or particle count alone will not make the catalog faithful.

**Naming conventions:**

- The research ID `star-pattern` means a five-point outline, not a generic luminous particle. The application preserves the ID `star`. The specific professional reference example remains unverified; the outline is authored.
- The research ID `waterfall-curtain` means **the fixed curtain interpretation** and maps to application ID `waterfall`. The APA calls an aerial falling effect “waterfall”; Pyrostar describes a fixed cascading display, and HEX explicitly recognizes both uses.[1][3][4]
- Keep `fan` as a choreography preset, and `roman-candle` as a repeating emitter. Their identity is arrangement or repetition, not a new spherical burst.[1][3]
- `multi-pistil`, `horsetail`, `wheel` and `set-piece` distinguish nested cores, a falling plume and fixed displays. The source families support these distinctions, but the chosen grouping and preset parameters are authored.[9][4][43]
- Keep `kamuro` and `nishiki` as visibly differentiated **presets**, not as a claim that the names denote universally disjoint types. Isogai reports that professionals often say kamuro while meaning nishiki-kamurogiku.[15]

`finale` is a global stackable mode, not an additional taxonomy entry. `mute` and `reduced-flash` are also global controls. None should need a separate burst implementation.

## Evidence and distribution boundary

This is research into observable light, movement, sound and show composition. It contains no pyrotechnic recipes, physical construction procedures or firing-hardware instructions.

The main references are the American and Japanese pyrotechnics associations, Japanese makers Sato and Isogai, professional show producer Nihonbashi Marutamaya, and the professional visualization vocabulary in Finale 3D. Commercial effect charts are used for alternate meanings, not treated as universal standards. The notes below distinguish source-supported terminology from authored rendering choices.

- **Public research files:** this original report and [`field-guide-data.json`](field-guide-data.json). The JSON contains **40 original specifications and 17 source references**, with stable IDs, titles and URLs; it contains no quote ledger. Short attributed quotations in this report retain their source owners' rights and are not relicensed under MIT. Source media are linked, not bundled; a citation does not grant redistribution rights.
- **Excluded from the public repository and ZIP:** the original `claims.json`, `sources-ledger.json` and `sources.md`, and every `evidence/` directory, including retrieval captures and verification records. These are not build dependencies. Package from an explicit public-file allowlist rather than archiving the working directory.
- **Documentary scope:** publisher text supports the attributed descriptions; source support is not independent proof of physical behavior. The source IDs and URLs below are retained in the public data so readers can follow the references without the retrieval archive.
- **Not measured:** no source videos were watched or timed, and this research includes no source-recording waveform, decibel or physical measurements. All seconds, relative speed/density choices, camera-facing assists and audio envelopes below are **authored animation choices**.

[`scripts/build-pages.mjs`](../../scripts/build-pages.mjs) reads `docs/research/field-guide-data.json` to generate the in-app field guide. That file carries original geometry, motion, trail, branching, colour, sound-mapping and timing specifications, naming uncertainties and source references. Japanese passages in this report are quoted in Japanese; the English descriptions are authored translations.

## Model the independent axes

Treat each catalog button as a preset assembled from these authored dimensions:

| Axis | Preserve in the simulation | Frequent confusion |
|---|---|---|
| Origin and event | Ground spray, rising light, aerial opening, child opening, fixed set piece | Making every effect launch, explode and disappear identically |
| Geometry | Sphere, inner spheres, planar pattern, few fronds, tight plume, cloud, curtain | Filling a sphere volume when the visible design calls for a shell surface; treating every pattern as a sphere |
| Head motion | Expansion, deceleration, descent, passive flutter, active darting, local spinning | Recoloring one generic ballistic emitter for every name |
| Trail | None, thin continuous, thick, long-lived, localized glitter, bushy crackle | A permanent line glued from burst center to moving head |
| Branching | No branching, delayed four-way star split, local microbursts, separate child flowers | Calling every glitter flash a child explosion |
| Emission over time | Steady, repeated head flashes, trail flashes, synchronized color change, spatial color sweep | Coupling particle position or sound to opacity pulses |
| Arrangement | Single event, repeated column, simultaneous fan, chase, mirrored pair, layered scene | Treating fan, Roman candle or finale as a new species of star |

The associations distinguish spherical blooms, inner cores, pattern shells, moving effects and ground displays, while supplier charts explicitly distinguish fan order and height layers.[1][9][5]
Finale 3D’s glossary is especially useful for separating trail modifiers from head modifiers and spatial ghost transitions from ordinary synchronized color changes.[2]
The table above is a software-oriented synthesis, not an official classification system.

### Particle behavior that should remain consistent

The following are **authored rendering principles**, not measurements:

1. Keep head lifetime and individual trail-spark lifetime separate. A live head emits sparks at past positions; those sparks continue drifting/falling and die independently. A willow should not look like a single static glowing spline.
2. Use coherent gravity, drag and wind across effects. Change relative launch impulse, persistence and emission texture to create the distinct profiles; avoid changing gravity per effect merely to obtain a silhouette.
3. Preserve coarse geometry before adding detail. A sparse dahlia, a four-way crossette and concentric inner cores should be recognizable with restrained bloom and without sound.
4. Keep trajectories continuous through a strobe dark interval or a color change. Turning emission off does not mean deleting and re-spawning the star elsewhere.
5. Keep a planar pattern’s geometry in 3D. A ring viewed obliquely should look elliptical; AFTERLIGHT may favor readable orientations, but camera-facing behavior should be an intentional accessibility/legibility assist.
6. Use a shared low-frequency wind field for old sparks and smoke, with small local variations. Independent white-noise motion every frame looks like insects teleporting and makes falling leaves jitter.
7. Let bright heads, dim trails, smoke and bloom have different visual roles. Avoid enough bloom to merge pistil gaps or turn a nishiki canopy into a white sheet.
8. Preserve the recognizable part of a preset under mobile load: the four daughters of a crossette, the eyes of a smiley, separated inner cores, and a few strong palm fronds. Reduce redundant sparks and smoke detail first.

## Japanese terms and Western near-equivalents

| Term | Source-supported meaning | Implementation consequence |
|---|---|---|
| 菊, kiku | A round tailed flower; Western chrysanthemum uses the same visible trail distinction.[13][1] | Radial spark trails, not a tailless point sphere. |
| 牡丹, botan | A flower drawn by points without tails; Sato notes that it still falls somewhat before extinction.[13] | Use peony geometry; tailless does not mean gravity-free. |
| 冠菊, kamurogiku | A round opening whose long trails flow downward.[13] | Keep a prolonged descending canopy. |
| 錦冠菊, nishiki-kamurogiku | Isogai describes a brighter whitish look compared with an older dim-orange kamuro appearance and notes that the names overlap in professional speech.[15] | Reuse canopy topology; make brightness/texture differences explicitly authored. |
| 芯入, shin-iri | An inner-core flower; the JPA distinguishes successive numbers of inner cores.[9] | Layers are concentric **spheres**, not delayed flowers and not merely concentric planar rings. |
| 八重芯, yaeshin | Two inner cores, corroborated by Sato’s wording about the core itself being double.[9][13] | `double-pistil`: outer flower plus two inner cores. |
| 三重芯 | Three inner cores in the JPA count convention.[9] | Default `multi-pistil`: outer flower plus three inner cores. The English preset label does not claim a verified Japanese UI translation. |
| 柳, yanagi | Sato describes a falling effect that does not form the round flower of a chrysanthemum.[32] | Do not translate every Western spherical willow literally as yanagi; a softly released falling plume is a better variant. |
| 千輪菊, senringiku | Many small flowers open together.[32] | Use spatially separated child flowers, not extra pistil layers. |
| 蜂, hachi | The JPA describes irregular rotation with a “ブルルン” sound.[33] | Supports a spinning/buzzing bees variant; it does not establish a waveform for all Western bees or fish. |
| ナイアガラの滝, Niagara Falls | The JPA names a horizontal waterfall display.[34] | Fixed falling curtain; separate from the APA’s aerial waterfall meaning. |

**Core-count check:** the implementation convention is one outer flower plus the stated number of inner cores. Thus `pistil`, `double-pistil`, and the default `multi-pistil` have two, three, and four spherical star layers respectively. These totals are derived from that convention, not independent Japanese type names.

JPA’s HTML page reflow mixes nearby text and reading annotations. The cited core-count and hachi phrases are intact, and Sato independently supports the double-core reading. The English descriptions remain authored translations, not reviewed Japanese UI labels.[9][13][33]

## Reference preset catalog

All geometry, fall, emission, sound mappings and seconds in the catalog tables are **authored simulation specifications informed by the cited factual basis**. They are not a claim that every supplier’s product with the same name behaves identically. The public fields and uncertainties are in [`field-guide-data.json`](field-guide-data.json). These reference presets are design inputs; [`../renderer.md`](../renderer.md) documents the implemented variants and API.

Timing convention: **event** is the authored active-light interval after an aerial break, or after the first visible emission for ground/rising effects. It excludes the earlier aerial ascent, audio reverberation and final smoke cleanup. **trail** is the lifetime of an individual shed spark, not the total event duration. A zero trail means no persistent spark trail.


### Blooms and inner cores

**Exact IDs:** `peony`, `chrysanthemum`, `dahlia`, `diadem`, `pistil`, `double-pistil`, `multi-pistil`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `peony`<br>aerial-burst | Evenly distributed points on an expanding 3D spherical surface, not a screen-space disk. Rapid opening, then deceleration and modest collective sag.<br>**Trail:** None beyond a very short exposure-like glint; no persistent streaks. | **Branch:** None.<br>**Color:** One saturated color by default; a separate color-change modifier is permitted. | Single rounded aerial report; no automatic crackle, whistle or fizz.<br>**Event:** 1.4–2.6 s; **trail spark:** 0–0 s.<br>Factual basis [1][2][13] |
| `chrysanthemum`<br>aerial-burst | Spherical array of radial heads, each leaving a visible spoke. Fast round opening followed by gently curving descent.<br>**Trail:** Fine continuous spark trails with separately aging sparks; heads remain identifiable. | **Branch:** None; a spark tail is not secondary branching.<br>**Color:** Warm trail plus optional colored tips; no mandatory crackle ending. | Single rounded aerial report; an unobtrusive airy tail is authored, not a distinct sourced sound.<br>**Event:** 2.2–3.8 s; **trail spark:** 0.35–0.85 s.<br>Factual basis [1][2] |
| `dahlia`<br>aerial-burst | Sparse, large, bright tailless points with clear gaps between petals. Longer reach and longer readable points than the peony preset.<br>**Trail:** No persistent trail in the base preset. | **Branch:** None.<br>**Color:** Prominent bright colored heads; optional contrasting independent core. | One aerial report; not intrinsically crackling.<br>**Event:** 2.2–3.8 s; **trail spark:** 0–0 s.<br>Factual basis [1][2] |
| `diadem`<br>aerial-composite | Outer peony plus a tight inner cluster. Outer sphere expands normally; core moves less and fades sooner.<br>**Trail:** Inherit the outer bloom; compact core stays point-like. | **Branch:** No delayed child burst.<br>**Color:** Contrasting core; avoid compulsory strobe. | One shared aerial report, not one per core.<br>**Event:** 2–3.2 s; **trail spark:** 0–0.25 s.<br>Factual basis [3][4] |
| `pistil`<br>aerial-composite | Outer flower plus one smaller concentric spherical core. Both layers begin together; inner layer has smaller radial reach.<br>**Trail:** Independent trail choices per layer. | **Branch:** No secondary burst; two star layers share one event center.<br>**Color:** Clear inner/outer contrast; optional synchronized changes. | One aerial report for the whole bloom.<br>**Event:** 2.3–3.8 s; **trail spark:** 0–0.7 s.<br>Factual basis [1][2] |
| `double-pistil`<br>aerial-composite | One outer flower plus two inner spherical cores: three visible layers in total. Co-centered simultaneous opening with different expansion radii.<br>**Trail:** Default tailless inner layers keep gaps readable; outer trail optional. | **Branch:** No secondary breaks.<br>**Color:** Three distinguishable layers; changes preserve layer identity. | One aerial report.<br>**Event:** 2.6–4.2 s; **trail spark:** 0–0.7 s.<br>Factual basis [9][13] |
| `multi-pistil`<br>aerial-composite | Default one outer sphere plus three inner spherical cores; optionally four inner cores. Precisely concentric expansion; preserve depth and similar overall extinction timing.<br>**Trail:** Use restrained tails so successive cores do not merge into solid bloom. | **Branch:** No delayed child bursts.<br>**Color:** Separate layer palettes; optionally stage a synchronized color transition for each layer. | One shared aerial report.<br>**Event:** 3–4.8 s; **trail spark:** 0–0.55 s.<br>Factual basis [9] |

- **`peony` naming note:** Kiku/chrysanthemum and botan/peony agree on the trail distinction; a tailless star can still fall.[1][2][13]
- **`chrysanthemum` naming note:** Do not make every flower a chrysanthemum by leaving long trails on all presets.[1][2]
- **`dahlia` naming note:** Larger/brighter/fewer is relative, not an absolute star count or speed.[1][2]
- **`diadem` naming note:** An authored compact-core distinction based on HEX; other vendors use diadem much like pistil.[3][4]
- **`pistil` naming note:** A core modifier presented as a ready-to-use button, not a unique particle law.[1][2]
- **`double-pistil` naming note:** Count inner cores, not total rings; the English preset name does not certify an exact Japanese display label.[9][13]
- **`multi-pistil` naming note:** Three inner cores correspond to sanjushin; not three total spheres and not planar bullseye rings.[9]

### Canopies and large spokes

**Exact IDs:** `willow`, `brocade`, `kamuro`, `nishiki`, `palm`, `spider`, `horsetail`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `willow`<br>aerial-burst | Broad globe opening into a loose umbrella of fine hanging branches. Opening yields early to strong downward curvature; long descent remains visible.<br>**Trail:** Long, thin, relatively dim warm amber/gold sparks. | **Branch:** None.<br>**Color:** Usually warm canopy in this preset; later tips are an optional variant. | One round report; optional very quiet airy decay is authored.<br>**Event:** 4.8–7.5 s; **trail spark:** 1–2.2 s.<br>Factual basis [5][4][32] |
| `brocade`<br>aerial-burst | Full umbrella with more densely textured hanging strands than the willow preset. Rounded opening into slow cascading arcs.<br>**Trail:** Fine gold glitter-like texture; brighter and fuller than the authored willow. | **Branch:** No new shell breaks solely because it is brocade.<br>**Color:** Warm gold with occasional pale flecks; optional colored tips. | One aerial report; glitter texture does not require loud crackle.<br>**Event:** 4.2–7 s; **trail spark:** 0.8–1.8 s.<br>Factual basis [1][2] |
| `kamuro`<br>aerial-burst | Large rounded canopy that closes into a hanging, bob-like curtain. Long-lived heads descend substantially after the initial expansion.<br>**Trail:** Long dense amber-to-silvery-gold trails with restrained twinkle. | **Branch:** None in the base.<br>**Color:** Default subdued warm-gold canopy; contrasting pistil optional. | One aerial report, then space for the visible decay.<br>**Event:** 5.5–8.5 s; **trail spark:** 1.1–2.5 s.<br>Factual basis [13][15][4] |
| `nishiki`<br>aerial-burst | Same canopy topology as kamuro, with a brighter and fuller authored appearance. Long fall; do not replace the descent with repeated explosions.<br>**Trail:** Rich pale-gold/whitish sparkling trails, kept granular rather than a solid neon curtain. | **Branch:** None unless a separately named finishing effect is added.<br>**Color:** Brighter pale-gold canopy; optional white strobe tips are a variant. | One report; optional faint texture, not automatic crackle.<br>**Event:** 5.5–8.5 s; **trail spark:** 1.1–2.5 s.<br>Factual basis [15][6] |
| `palm`<br>aerial-burst | A small number of broad fronds; optional rising trunk leads into the crown. Bold outward motion then curved falling fronds; visible spaces between arms.<br>**Trail:** Thick high-brightness trails, unlike willow filaments. | **Branch:** None; optional small report accents are not part of the base preset.<br>**Color:** Gold/silver fronds with optional colored ends. | One broad aerial report; ascent rush optional.<br>**Event:** 2.8–4.8 s; **trail spark:** 0.65–1.4 s.<br>Factual basis [1][2] |
| `spider`<br>aerial-burst | Sparse to moderate hard radial spokes with a jagged, fast opening. Very fast outward travel; extinguish before substantial sag.<br>**Trail:** Short-lived straight bright streaks, not long drooping palm fronds. | **Branch:** None.<br>**Color:** Bright warm or silver lines; tip change optional. | A sharp attack is an authored audio choice; no source specifies a unique spider timbre.<br>**Event:** 0.8–1.5 s; **trail spark:** 0.18–0.45 s.<br>Factual basis [1] |
| `horsetail`<br>aerial-burst | Compact one-sided plume rather than a full spherical flower. Retained upward momentum turns over quickly into a tightly grouped fall.<br>**Trail:** Long parallel-ish tails that remain near one another. | **Branch:** None.<br>**Color:** Gold/silver base; colored tips optional. | Softer release mapping than a hard spherical break; no measured loudness claim.<br>**Event:** 3.6–6 s; **trail spark:** 0.8–1.8 s.<br>Factual basis [2][4] |

- **`willow` naming note:** Western willow preset; Japanese yanagi can instead be a softly falling non-spherical cluster.[5][4][32]
- **`brocade` naming note:** Brocade, crown, willow and kamuro overlap; the relative density is an authored visual distinction.[1][2]
- **`kamuro` naming note:** Modern Japanese usage often means nishiki-kamurogiku; do not assert two universally separate types.[13][15][4]
- **`nishiki` naming note:** Retain nishiki as a preset label, not a claim of a new geometric family. Exact hue and density here are authored, not matched to maker footage.[15][6]
- **`palm` naming note:** APA describes six fronds, but this is not a universal count.[1][2]
- **`spider` naming note:** Flat trajectory means little visible curvature here, not a required 2D disk.[1]
- **`horsetail` naming note:** Wider falling plumes are often called aerial waterfalls; keep that variant distinct from waterfall-curtain.[2][4]

### Recognizable patterns

**Exact IDs:** `ring`, `saturn`, `heart`, `star-pattern`, `spiral`, `smiley`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `ring`<br>aerial-pattern | Points on one planar expanding circle embedded in 3D. Self-similar radial expansion, then modest sag and extinction.<br>**Trail:** None or extremely short glints; a persistent connecting line is inappropriate. | **Branch:** None.<br>**Color:** Single or segmented color; multiple-ring variations are parameters. | One aerial report.<br>**Event:** 2–3.1 s; **trail spark:** 0–0.06 s.<br>Factual basis [3] |
| `saturn`<br>aerial-pattern | A planar outer ring around a smaller spherical central flower. Ring and center open together with different radii.<br>**Trail:** Mostly clean points; core trail texture optional. | **Branch:** No new burst needed for the central sphere.<br>**Color:** Contrasting ring and center, often a clean two-color reading. | One shared aerial report.<br>**Event:** 2.5–3.8 s; **trail spark:** 0–0.3 s.<br>Factual basis [1][47] |
| `heart`<br>aerial-pattern | An expanding planar heart outline, not a filled heart sprite. Maintain lobe and notch separation during early expansion, then allow sag.<br>**Trail:** Nearly tailless points to protect the silhouette. | **Branch:** None.<br>**Color:** One readable color; two-tone halves optional. | One aerial report.<br>**Event:** 2.1–3.3 s; **trail spark:** 0–0.06 s.<br>Factual basis [1] |
| `star-pattern`<br>aerial-pattern | Five-point star outline in a 3D plane, sampled along its perimeter. Whole outline expands; avoid independent random speeds that erase the points.<br>**Trail:** Nearly tailless. | **Branch:** None.<br>**Color:** Single color for legibility. | One aerial report.<br>**Event:** 2.1–3.3 s; **trail spark:** 0–0.06 s.<br>Factual basis [9] |
| `spiral`<br>aerial-pattern | An expanding planar spiral curve made from stars. The curve scales out; it is not a group of independently spinning tourbillons.<br>**Trail:** Point-like or minimal tails. | **Branch:** None.<br>**Color:** Single spiral or alternating color sections. | One aerial report.<br>**Event:** 2.5–3.8 s; **trail spark:** 0–0.08 s.<br>Factual basis [37] |
| `smiley`<br>aerial-pattern | Outer circular face plus separate eye and mouth points. Coherent expansion preserves face proportions before modest fall.<br>**Trail:** Tailless by default. | **Branch:** None.<br>**Color:** Contrast features against outline; no filled emoji billboard. | One aerial report.<br>**Event:** 2.1–3.3 s; **trail spark:** 0–0.06 s.<br>Factual basis [1] |

- **`ring` naming note:** Frontal orientation is an authored legibility aid; rotated planes should project as ellipses.[3]
- **`saturn` naming note:** Ring-plus-pistil is supported at product level; final 3D proportions and orientation are authored.[1][47]
- **`heart` naming note:** A recognized pattern family; exact shape and frontal presentation are authored.[1]
- **`star-pattern` naming note:** Explicit research name for application ID `star`. This specific five-point professional exemplar remains unverified; geometry is an authored motif.[9]
- **`spiral` naming note:** Lidu documents the product name, not this exact curve or motion. The curve is authored, not a video-matched reproduction.[37]
- **`smiley` naming note:** Pattern topology is supported; camera-facing presentation is a usability decision.[1]

### Subdivision, texture and color

**Exact IDs:** `crossette`, `crackle`, `strobe`, `glitter`, `ghost`, `color-change`, `shell-of-shells`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `crossette`<br>aerial-transform | Primary radial stars each divide into a small four-arm cross. Parents travel first; daughters inherit position and some momentum, then separate.<br>**Trail:** Medium parent trail, short clean daughter trails. | **Branch:** One delayed four-way split per participating parent; stop parent emission at split.<br>**Color:** Parent-to-child color transition optional. | Main report plus restrained synchronized split ticks; not a dense crackle bed.<br>**Event:** 2.8–4.4 s; **trail spark:** 0.25–0.65 s.<br>Factual basis [1][2] |
| `crackle`<br>aerial-texture | A distributed field of tiny expanding sparklets and brief microflashes. Follow parent stars or appear as terminal clusters; local microburst velocity is short-lived.<br>**Trail:** Short bushy sparks; avoid permanent glowing branches. | **Branch:** Local microbursts; a popcorn-style dark-to-flash ending is one variant.<br>**Color:** Brief white/gold flashes and dim warm embers. | Dense irregular discrete pops; optional finer sizzling bed for rain-like variants.<br>**Event:** 1.2–3 s; **trail spark:** 0.05–0.22 s.<br>Factual basis [1][5][6] |
| `strobe`<br>aerial-modifier-preset | Ordinary sphere of heads whose brightness is time-modulated. Continue head trajectories through dark phases rather than freezing or respawning them.<br>**Trail:** Minimal trail so on/off heads stay distinct. | **Branch:** None.<br>**Color:** White or colored flashes; stagger phases across heads. | No automatic matching pop on each light pulse; aerial report only unless combined with crackle.<br>**Event:** 2.6–4.5 s; **trail spark:** 0–0.12 s.<br>Factual basis [1][4] |
| `glitter`<br>aerial-modifier-preset | A tailed flower whose small trail sparks flash at different ages. Heads follow normal arcs; glitter sparklets lag behind and fade.<br>**Trail:** Sparse localized flashes within a granular trail, not head-wide on/off pulsing. | **Branch:** No parent-star splitting is required.<br>**Color:** Gold/silver warm trails with optional colored steady heads. | Aerial report plus optional very quiet airy texture; no compulsory loud popcorn crackle.<br>**Event:** 3–5 s; **trail spark:** 0.45–1.1 s.<br>Factual basis [2][6] |
| `ghost`<br>aerial-modifier-preset | Clean spherical bloom with a color front moving across sectors. Stars keep expanding continuously while their emission changes.<br>**Trail:** Little persistent trail, so old colors do not obscure the phase front. | **Branch:** No new shell breaks.<br>**Color:** Segmented sweep A to B; optional short dark transition per sector; reverse or quadrant variants later. | One report; do not play a second explosion solely for a color transition.<br>**Event:** 3–4.8 s; **trail spark:** 0–0.08 s.<br>Factual basis [2][4] |
| `color-change`<br>aerial-modifier-preset | Default peony sphere with a coherent color transition. Continuous trajectories; color state advances with star age.<br>**Trail:** Default tailless; trail color and head color can be independent in other bases. | **Branch:** None.<br>**Color:** Most heads change A to B together; allow a small authored age spread rather than arbitrary rainbow cycling. | One report with no extra bang at color change.<br>**Event:** 2.6–4.1 s; **trail spark:** 0–0.08 s.<br>Factual basis [2] |
| `shell-of-shells`<br>aerial-composite | Initial parent dispersion followed by many small spatially separated flower centers. Child centers drift apart before their own local spherical expansions.<br>**Trail:** Keep a readable gap before child blooms; each child has its own compact tail profile. | **Branch:** Two visible levels: parent release then clustered child breaks; cap hierarchy at this level.<br>**Color:** Child flowers may differ in color; senrin preset opens the small flowers near-simultaneously. | Initial report followed by a cluster of smaller reports, aligned with the visible child events.<br>**Event:** 4–6.5 s; **trail spark:** 0.2–0.65 s.<br>Factual basis [1][5][32] |

- **`crossette` naming note:** A plus-shaped original burst is not the defining event; the readable delayed subdivision is.[1][2]
- **`crackle` naming note:** Crackle, time rain and dragon eggs overlap; do not force all variants into the same timing.[1][5][6]
- **`strobe` naming note:** HEX suggests 1–2 Hz; any animation rate is authored. Reduced-flash mode must suppress this effect rather than being advertised as universally safe.[1][4]
- **`glitter` naming note:** A trail-domain modifier presented as a preset; loose retail twinkle terminology can blur it with strobe.[2][6]
- **`ghost` naming note:** Sweeper ghost is the stronger professional description; simple vanish/reappear may be a variant but not the whole definition.[2][4]
- **`color-change` naming note:** Modifier, not a new shell topology; contrasting colors present simultaneously are not the same as a temporal change.[2]
- **`shell-of-shells` naming note:** Separate this spatial cluster from a serial multi-break effect along one continuing path; thousands is not a literal required count.[1][5][32]

### Drifters and active movers

**Exact IDs:** `falling-leaves`, `bees`, `fish`, `tourbillon`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `falling-leaves`<br>aerial-drifter | A loose cloud of persistent colored points or tiny dashes. Slow gravity-led descent with gentle correlated side-to-side flutter and shared wind.<br>**Trail:** Almost none; do not make each leaf a long comet. | **Branch:** None.<br>**Color:** Sustained colored glow; optional twinkle rather than mandatory strobe. | Soft release mapping; no invented leaf rustle or compulsory buzzing.<br>**Event:** 4–7 s; **trail spark:** 0–0.12 s.<br>Factual basis [1][3][5] |
| `bees`<br>aerial-mover | Compact swarm of erratic small lights. Short correlated turns and accelerations; no independent per-frame position noise.<br>**Trail:** Short yellow/silver spark traces; individual paths remain visible. | **Branch:** No regular subdivision.<br>**Color:** Single light color or small mixed palette. | Soft release; an optional restrained buzzing hum is supported for hachi/hummer variants.<br>**Event:** 1.8–3.2 s; **trail spark:** 0.08–0.22 s.<br>Factual basis [2][3][33] |
| `fish`<br>aerial-mover | Loose group of wriggling, independently moving lights. Longer graceful darts than the authored bees; motion persists rather than passive leaf settling.<br>**Trail:** Minimal short traces, not willow-like drapery. | **Branch:** None.<br>**Color:** Small colored or silver points. | Soft release; relatively restrained sound, no mandatory hum or whistle.<br>**Event:** 2–3.4 s; **trail spark:** 0.05–0.18 s.<br>Factual basis [1][2][3] |
| `tourbillon`<br>aerial-mover | Moving spinning spark sources with curled local traces. Combine drift with rotating emission and irregular changes of direction.<br>**Trail:** Short corkscrew/tumbling spray, not a static spiral-shaped arrangement. | **Branch:** None unless a named finishing effect is added.<br>**Color:** Gold/silver sprays by default. | Soft release and optional hummer buzz; not every tourbillon must whistle.<br>**Event:** 2–3.8 s; **trail spark:** 0.12–0.4 s.<br>Factual basis [1][2][3] |

- **`falling-leaves` naming note:** Passive drift distinguishes the authored preset from active darting fish/bees; flutter details remain artistic.[1][3][5]
- **`bees` naming note:** Western names overlap fish/spinners; a buzz is not guaranteed by every bees product.[2][3][33]
- **`fish` naming note:** The bees/fish size hierarchy is only one vendor usage; relative scale and smoothness are authored differentiators.[1][2][3]
- **`tourbillon` naming note:** Accept tourbillion/tourbillions/turbillion aliases. Farfalle is related but not required as a separate button.[1][2][3]

### Ground displays and rising emitters

**Exact IDs:** `comet`, `mine`, `fountain`, `waterfall-curtain`, `roman-candle`, `wheel`, `set-piece`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `comet`<br>rising-emitter | One rising bright head with a tail; no terminal spherical explosion by default. Rise, decelerate, extinguish; slight arc or angled trajectory is an authored option.<br>**Trail:** Thick continuous tail with individually decaying sparks. | **Branch:** None.<br>**Color:** Warm or silver tail; colored head; optional tailless pearl variant. | Short launch transient and restrained rush; whistle is an explicit optional variant.<br>**Event:** 1.2–2.4 s; **trail spark:** 0.3–0.75 s.<br>Factual basis [43][2][5] |
| `mine`<br>ground-rising-burst | A low broad cone or bouquet of many stars emerging together from the horizon. Immediate upward spread followed by deceleration and fall; no high-altitude parent burst.<br>**Trail:** Short clean star traces or a selected glitter/crackle texture. | **Branch:** None by default.<br>**Color:** Color cloud or layered bands; keep lower scene readable. | Short low launch thump/rush mapping; optional crackle inherits its own audio.<br>**Event:** 1–1.9 s; **trail spark:** 0–0.35 s.<br>Factual basis [1][5] |
| `fountain`<br>ground-continuous | Persistent upward spray from a fixed ground point. Fresh sparks rise continuously while older sparks arc outward and descend.<br>**Trail:** Moderate-lived granular sparks; brightness concentrated near emission. | **Branch:** Continuous emission, not a chain of spherical bursts.<br>**Color:** Gold/silver base with optional color pearls or crackle phases. | Continuous hiss/rush is an authored sound mapping; discrete crackle only when that variant is selected.<br>**Event:** 6–12 s; **trail spark:** 0.35–0.9 s.<br>Factual basis [43] |
| `waterfall-curtain`<br>ground-set-piece | A fixed elevated horizontal band producing a curtain of downward sparks. Continuous gravity-led fall from a stationary line with modest shared wind.<br>**Trail:** Long thin descending spark strands; no giant central aerial break. | **Branch:** Continuous distributed emission.<br>**Color:** Silver-white or warm gold curtain. | Soft sustained hiss/rush mapping; no inherent aerial bang.<br>**Event:** 6–12 s; **trail spark:** 0.9–2.2 s.<br>Factual basis [3][34] |
| `roman-candle`<br>repeating-emitter | Repeated individual pearls/comets from the same scene anchor. Each light has its own rise and extinction; optional bombette-style small terminal bloom later.<br>**Trail:** Inherited from pearl/comet, not a new trail species. | **Branch:** Repetition over time, not branching of one aerial star.<br>**Color:** Alternate shot colors without recoloring previous live shots. | A sequence of small launch transients; only bombette variants add terminal reports.<br>**Event:** 5–8 s; **trail spark:** 0–0.6 s.<br>Factual basis [1] |
| `wheel`<br>ground-set-piece | Fixed-center circular rotating pattern of spark emission. Spark paths leave a turning source and then fall; the wheel center stays in place.<br>**Trail:** Short arcs that reveal rotation without becoming a filled glowing disk. | **Branch:** Continuous emission.<br>**Color:** Warm/silver rotating spokes; phases can change color. | Restrained sustained rush/hiss mapping; no continuous engine sound claim.<br>**Event:** 6–12 s; **trail spark:** 0.25–0.7 s.<br>Factual basis [34][43] |
| `set-piece`<br>ground-set-piece | Static arrangement of colored luminous points tracing a symbol, word or drawing. Light holds in fixed world positions; add only tiny independent flicker.<br>**Trail:** Little or no moving trail. | **Branch:** None; many stationary light elements form one image.<br>**Color:** Readable limited palette; simultaneous reveal and fade. | Quiet ambience or faint hiss mapping; no invented sequence of aerial reports.<br>**Event:** 8–12 s; **trail spark:** 0–0.06 s.<br>Factual basis [1][43] |

- **`comet` naming note:** A comet can also be an ascent accessory to another effect. Do not make the standalone preset burst automatically.[43][2][5]
- **`mine` naming note:** Ground-origin effect whose light moves into the air; not equivalent to a high aerial flower.[1][5]
- **`fountain` naming note:** Gerb/fountain naming varies; this is a readable cascading fountain preset, not a hardware model.[43]
- **`waterfall-curtain` naming note:** Explicit research name for application ID `waterfall`. The unqualified name is ambiguous: APA means an aerial falling effect; Pyrostar and JPA also describe this curtain form.[3][34]
- **`roman-candle` naming note:** Authored interval 0.6–1.0 seconds; this is an emitter sequence, not a unique burst shape.[1]
- **`wheel` naming note:** Do not confuse a ground wheel with a flying girandola. Angular speed is authored, not measured.[34][43]
- **`set-piece` naming note:** The button means lancework-like imagery; the broader term set piece can include other ground effects. Any lettering is original app artwork.[1][43]

### Sound-first accent

**Exact IDs:** `salute`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `salute`<br>aerial-audio-accent | A brief compact flash with minimal persistent star structure. Fast flash decays into a small dim smoke cue, rather than a large colorful bloom.<br>**Trail:** None by default; sparse silver accents are an optional variant. | **Branch:** None.<br>**Color:** Brief warm-white flash, restrained screen bloom. | A dominant sharp report with authored low body and reverberant decay; relative loudness is compressed for comfortable playback.<br>**Event:** 0.12–0.3 s; **trail spark:** 0–0 s.<br>Factual basis [1] |

- **`salute` naming note:** Sound-first accent. Not all real salutes are visually identical, and no SPL or waveform was measured.[1]

### Choreography preset

**Exact IDs:** `fan`.

| ID / kind | Geometry, motion and trail | Branching and color | Sound / authored timing |
|---|---|---|---|
| `fan`<br>choreography | A spatial-temporal arrangement of multiple existing emitters or bursts. Arrange paths across the lower/middle sky: simultaneous spread, left/right chase, center-out, or mirrored pairs.<br>**Trail:** Inherited from the child effects; fan has no independent particle tail. | **Branch:** No particle branching; it schedules separate effect events.<br>**Color:** Use a limited palette per phrase rather than random full-spectrum shots. | Inherit child sounds at their event times; fan is not a new sound class.<br>**Event:** 1–3 s; **trail spark:** 0–0 s.<br>Factual basis [3][5][22] |

- **`fan` naming note:** Keep outside burst geometry. V/W patterns and a Z/sweep are variants; authored fan-chase spacing can start at 0.10–0.25 seconds.[3][5][22]

## Sound signatures: what is supported and what is authored

These sound categories inform AFTERLIGHT's original synthesis; they are not measured waveforms. [`../audio.md`](../audio.md) documents the audio engine, authored envelopes and acoustic references.

| Signature | Documentary basis | Recommended authored audio behavior |
|---|---|---|
| Main aerial report | Spherical display effects have their opening event; salute is explicitly flash plus a large report.[1] | Share a small family of report bodies across ordinary blooms. Vary perceived distance/scale subtly, rather than inventing one unique bang for each flower name. |
| Salute | “producing a quick flash followed by a large report.”[1] | Sound-first accent with very short light. Use restrained playback level and a compressed dynamic range; no physical SPL claim. |
| Crackle | Repeated popping/banging noises; clusters of flashes accompany the sound.[5][6] | Many irregular short grains, temporally linked to the visible microflashes. Avoid one looping crackle recording for every effect. |
| Crackling rain | The APA says it can “make a loud sizzling noise.”[1] | A denser, finer-grained texture than discrete popcorn crackle, if this variant is offered. |
| Crossette split | APA describes a sound accompanying the later subdivision.[1] | A small localized split accent, not automatically a continuous dense crackle bed. Match a reference before assigning a signature. |
| Hummer / hachi | Pyrostar names a humming projectile; the JPA describes hachi’s irregular motion and onomatopoeic sound.[3][33] | Optional brief buzzing texture for the chosen variant. Do not add a buzz to every moving light. |
| Fish | Pyrostar calls fish a low-noise effect.[3] | Restrained release sound; low-noise does not imply perfectly silent. |
| Whistle | Wholesale Fireworks describes a high-pitched screaming effect.[5] | Explicit optional audio variant. Do not make every ascent whistle. |
| Strobe and glitter | Strobe concerns flashing stars; the specialist glitter definition locates flashes in the trail.[1][2] | Neither visual definition requires one pop per flash. Keep crackle a separate sound/texture choice. |
| Fountain, curtain, wheel | Their light is a sustained spray, cascade or rotation, not repeated aerial shell openings.[43][3][34] | A restrained hiss/rush is an **authored approximation**, not a measured recording match or a sourced universal signature. |
| Fan / Roman candle | These describe arranged or repeated effects.[3][1] | Inherit the sounds of the selected children rather than assigning a new “fan sound.” |

**Authored spatial-audio policy:** place sound at the event’s world location; use a consistent distance-dependent delay and attenuation model so high/distant events do not sound glued to the camera. The source descriptions support a visual flash followed by a report, but this research does not supply an atmospheric calibration or sound-speed measurement.[1]
AFTERLIGHT retains a mute control, conservative default volume, limits on simultaneous voices and a reduced-flash mode. No strobe rate or mix is advertised as medically safe.

## Choreography: make timing and height do different jobs

Suppliers describe fans as either volleys or directional sequences, and explicitly describe effects occupying different height levels.[3][5]
Marutamaya describes alternating delicate and dynamic scenes synchronized with music, while HEX describes layered kamuro in finales.[22][4]
Those statements support the vocabulary below; the scheduling rules and durations are **authored specifically for AFTERLIGHT**.

### A finite set of scene operations

| Operation | Meaning in this simulator | Suitable visual material |
|---|---|---|
| `single` | One readable event, with a decay window | Multi-pistil, ghost, patterned shell, long canopy |
| `volley` | Several events open together across a band | Peonies, palms, comets, mines |
| `chase-left` / `chase-right` | Events progress across the scene | Rising comets, short spiders, mines |
| `center-out` / `outside-in` | A mirrored progression rather than a single sweep | Paired mines, palms, color changes |
| `fan` | An angular/spatial arrangement, simultaneous or sequential | Existing rising or aerial presets; never its own particle species |
| `call-response` | A phrase on one side answered on the other | Contrasting sparse blooms, then a shared central punctuation |
| `layer` | Low, middle and high visual roles overlap | Mine/fountain foreground, mid-level comets, upper blooms/canopies |
| `hold-decay` | No new dominant event while the current image resolves | Kamuro, nishiki, leaves, ghost, multi-pistil |

These operation identifiers are design vocabulary, not public scheduler API names or extra catalog effect IDs. They do not describe physical firing hardware.

### Stackable Finale policy

A finale is ordinarily the last and most intense part of a show.[5]
The composition principles below call for **bounded authored phrases** that retain selected effects and their visible decay. The application exposes Finale as an ordered layer composer with a 12–45 second build; see [`../design.md`](../design.md). The scene operations and shorter phrase windows in this research are design inputs, not additional UI controls or runtime timing limits.

1. **Carry the user’s selection into the phrase.** If the selection contains mine + palm + nishiki, use those as low, middle and upper roles. Do not replace them with an unrelated rainbow peony barrage.
2. **Keep the topology groups distinct.** Simultaneous child flowers, glitter flashes and color transitions remain different event types even at high density. Reuse the same composed effect definitions as manual play.
3. **Reserve space for long canopies.** Start the long upper decay before the final low/mid punctuation so that all layers can resolve together. Keep new broad blooms away from a hero ghost or multi-pistil during its most readable phase.
4. **Build in waves rather than only increasing counts.** A sparse opening, a mirrored answer, a fuller overlap and a release can feel like a phrase without needing a soundtrack. Shortening gaps is one lever; widening the scene, changing height and increasing apparent scale are others.
5. **Make repeated clicks stack within a budget.** Add a new phrase or strengthen an underused height band. Merge compatible requests when the scene already has a long canopy; do not discard the visible decay or create an unbounded queue.
6. **Use a coherent palette per phrase.** Keep contrasting cores readable and preserve the source-inspired gold/silver canopy identities. Full random color cycling hides the distinction between a color change and a ghost sweep.
7. **Leave a real release.** Stop dominant new openings while persistent trails finish. A long canopy that is simply deleted at a fixed global timeout loses the effect being represented.

**Authored starting windows, not measured show rules:** a short fan/chase can span 1–3 seconds; a fuller added Finale phrase can span 8–14 seconds of new events plus the remaining decay. `field-guide-data.json` carries the reference presets' active-light ranges. The renderer's density and pool limits are implementation choices; this research does not establish a mobile performance budget.

### Acceptance checks for visual fidelity

These are authored visual-review criteria, not claims of human evaluation:

- With sound off, can a viewer distinguish peony, chrysanthemum, dahlia, palm, spider and willow without looking at the labels?
- Does a crossette first move as a parent, then visibly split? Does a pistil remain concentric instead of making a delayed secondary explosion?
- Do child flowers in `shell-of-shells` acquire new centers, while a ghost keeps its original trajectories?
- Is glitter localized in the trail while strobe changes the head brightness? Are color-change and ghost distinguished by timing across the sphere?
- Can leaves drift passively while fish/bees actively change direction, without per-frame jitter?
- Does a mine start low, a comet remain a single rising light, a fountain sustain upward spray, and a waterfall curtain flow down from a fixed band?
- Do pattern controls remain recognizable when bloom is reduced, at mobile resolution and from slightly oblique views?
- Does stacked Finale retain the selected families, respect height roles, avoid erasing existing trails, and return to a quiet state?
- Can mute and reduced-flash be toggled without resetting live particle motion? Do they suppress sounds/flashes rather than merely hiding their controls?

## Terminology conflicts and decisions

| Ambiguity | What the sources actually say | Decision for AFTERLIGHT |
|---|---|---|
| Brocade / diadem / nishiki called multi-break | Elevated Fireworks places them under “Multi-Break (Brocade, Diadem, Nishiki).” The APA describes brocade as a falling umbrella, and specialist definitions describe cores or canopy trails, not mandatory child-shell breaks.[8][1][2] | Reject that heading as the ontology. Products can combine multiple effects; the names themselves do not require a second explosion. |
| Multi-break vs shell-of-shells | The APA describes a parent dispersing smaller shells; Wholesale Fireworks emphasizes separately timed successive bursts.[1][5] | Canonical `shell-of-shells` means many later flower centers. A serial-break path is a separate future variant, not a synonym for pistils or brocade. |
| Kamuro vs nishiki | Isogai describes the historical brightness change and common overlapping usage. Finale 3D uses the same long-gold-glitter wording for brocade and kamuro.[15][2] | Reuse a canopy family and explicitly author the distinctions. Do not claim fixed worldwide RGB, density, or lifetime thresholds. |
| Diadem vs pistil | Pyrostar gives diadem a contrasting central cluster; HEX additionally says the cluster is tight and short-lived.[3][4] | Diadem is a compact, short-core preset. The distinction is a chosen convention, not a universally recognized separate topology. |
| Willow vs yanagi | Western references describe an umbrella; Sato’s yanagi does not form a chrysanthemum-like round flower.[4][32] | Label the broad preset Willow. Do not present it as an exact translation of the soft-falling Japanese variant. |
| Waterfall | APA: aerial falling tails. Pyrostar: fixed spark cascade. HEX: both, and an aerial waterfall wider than horsetail.[1][3][4] | Research ID `waterfall-curtain` maps to application ID `waterfall`; `horsetail` is the narrow aerial plume. Neither claims to cover every wider aerial-waterfall variant. |
| Ghost | Finale 3D specifies staggered sector color changes; HEX says the color moves across the expanding sphere.[2][4] | Default to a spatial sweep. A vanish/reappear interval is optional; do not universally require a double break. |
| Glitter / strobe / crackle | Glitter can be trail-domain flashes; strobe is on/off stars; crackle is an audible popping texture.[2][1][5] | Independent head, trail and sound channels. Permit combinations without collapsing the definitions. |
| Bees / fish / tourbillon | Wholesale Fireworks orders bees/fish/dragons by size; specialist glossaries emphasize darting or rotating movement, and Pyrostar separately names hummers.[5][2][3] | Differentiate by authored motion, retain aliases and keep hum/whistle optional. |
| Palm count | APA’s example specifies six fronds; Finale 3D says relatively few large stars.[1][2] | Preserve a few thick arms, not a supposedly mandatory count of six. |
| Comet | The APA general glossary calls it long-tailed; Finale 3D includes a tailless subtype; consumer descriptions can blend standalone comets with tails leading to shell bursts.[43][2][6] | A tailed, non-bursting default; a pearl variant and a separate ascent-accessory role. |
| Star and spiral | A spiral name appears in Lidu’s actual pattern catalog; the exact motion is not specified there.[37] | `star-pattern` is an explicit authored motif without a verified professional example. `spiral` has a supported name but its curve is not reference-matched. |

## Selected source passages

These short quotations retain their original source IDs. They support the terminology, not the authored numerical settings:

- Peony/chrysanthemum distinction: APA’s chrysanthemum stars “leave a visible trail of sparks.”[1]
- Crossette: Finale 3D says a star “splits into four pieces mid-way through its life”.[2]
- Ghost: stars “color change at slightly different times to form complex patterns.”[2]
- Glitter domain: “This term applies only to a trail, not to the tip of the star itself.”[2]
- Inner-core count: “二重の芯は八重芯、三重の芯は三重芯、四重の芯は四重芯”. The English reading is an authored translation: two, three and four **inner** cores.[9]
- Overlapping kamuro usage: “同業者同士の会話では“冠菊”、“冠（かむろ）”と言えば、錦冠菊を意味することが多くなっています。” The English reading is an authored translation: in professional conversation, kamuro often means nishiki-kamurogiku.[15]
- Spiral evidence is intentionally limited: “4 inch spiral” is a catalog listing, not a geometry specification.[37]

## Sources

[1] https://www.americanpyro.com/display-fireworks-glossary — American Pyrotechnics Association: Display Fireworks Glossary
[2] https://finale3d.com/documentation/vdl-effect-glossary — Finale 3D: Glossary of VDL Effect Terms
[3] https://pyrostar.be/glossary — Pyrostar: Glossary
[4] https://www.hexfireworks.co.uk/blogs/news/firework-jargon-explained — HEX Fireworks: Firework Jargon Explained
[5] https://wfboom.com/fireworks-effects-chart — Wholesale Fireworks: Fireworks Effects Chart
[6] https://skybaconfireworks.com/post/12-types-of-fireworks-effects — Sky Bacon: 12 Types of Fireworks Effects
[8] https://elevatedfireworks.com/blogs/product-education/the-different-firework-effects-explained — Elevated Fireworks: The Different Firework Effects Explained
[9] http://www.hanabi-jpa.jp/booklet2026/pageindices/index15.html — 令和８年 花火入門
[13] http://www.satoenka.jp/kind/wari.html — 割物（わりもの） - 佐藤煙火
[15] https://uchiage-hanabi.com/blog/pyrotechnician-notes/what-is-kamurogiku — 冠菊（かむろぎく）ってなあに？ | 花火ワールドに光る職人芸 磯谷煙火店　Art of Hanabi
[22] https://marutamaya.jp/en/passion — MADE-TO-ORDER FIREWORKS SHOW PRODUCTION - 日本橋丸玉屋
[32] http://www.satoenka.jp/kind/poka.html — 佐藤煙火 — ポカ物、半割物、その他
[33] http://www.hanabi-jpa.jp/booklet2026/pageindices/index16.html — 日本煙火協会 — 令和８年 花火入門, viewer page 16/49
[34] http://www.hanabi-jpa.jp/booklet2026/pageindices/index25.html — 日本煙火協会 — 令和８年 花火入門, viewer page 25/49
[37] https://lidufireworks.com/Pattern-Shells — Pattern Shell Fireworks | Creative Sky Effects by Lidu China
[43] https://www.americanpyro.com/glossary-of-pyrotechnic-terms — Glossary of Fireworks Terms - American Pyrotechnics Association
[47] https://rkmfireworks.net/saturn-ring — SATURN RING 1/1
