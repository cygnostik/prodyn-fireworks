import { readFile, writeFile, mkdir } from "node:fs/promises";
import { EFFECTS, GROUPS, pictogram } from "../src/data/catalog.js";
const root = new URL("../", import.meta.url),
  out = new URL("public/", root);
const research = JSON.parse(
  await readFile(new URL("docs/research/field-guide-data.json", root), "utf8"),
);
const sourceById = Object.fromEntries(research.sources.map((s) => [s.id, s]));
const aliases = { star: "star-pattern", waterfall: "waterfall-curtain" };
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const theme = await readFile(new URL("src/theme.css", root), "utf8");
const css = `${theme}\n@font-face{font-family:'Oxanium ProDyn';src:url('./fonts/Oxanium-wght.woff2') format('woff2');font-weight:200 800;font-display:swap}@font-face{font-family:'Departure Mono ProDyn';src:url('./fonts/DepartureMono-Regular.woff2') format('woff2');font-weight:400;font-display:swap}*{box-sizing:border-box}html{background:var(--pd-field);color:var(--pd-ivory);font-family:var(--pd-font-body);line-height:1.6}body{margin:0;padding:32px;max-width:1100px}a{color:var(--pd-signal);text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:2px solid var(--pd-signal);outline-offset:4px}header{border-bottom:1px solid var(--pd-line);padding-bottom:32px;margin-bottom:40px}header>a{text-decoration:none;font-family:var(--pd-font-hud);font-size:12px}h1{font-size:clamp(34px,5vw,64px);font-weight:350;line-height:1.1;letter-spacing:var(--ls-display);margin:24px 0}h2{font-weight:500;font-size:28px;margin:40px 0 16px}h3{font-size:18px;font-weight:500;margin:0}p{max-width:760px;color:var(--pd-ivory-muted)}.eyebrow{font:11px var(--pd-font-hud);letter-spacing:.12em;color:var(--pd-signal)}nav{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0}nav a{font:12px var(--pd-font-hud)}.entries{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--pd-line);border:1px solid var(--pd-line)}article{padding:24px;background:var(--pd-field)}.effect-title{display:flex;align-items:center;gap:16px}.effect-title svg{width:48px;height:48px;flex-shrink:0;color:var(--pd-ivory)}article p{font-size:14px;margin:16px 0}summary{cursor:pointer;color:var(--pd-ivory);font-size:14px;min-height:32px}dl{font-size:13px}dt{color:var(--pd-signal);font-family:var(--pd-font-hud);font-size:11px;margin-top:12px}dd{margin:4px 0;color:var(--pd-ivory-muted)}.refs{display:flex;gap:8px;margin-top:16px}.refs a{font:11px var(--pd-font-hud)}.try{display:inline-block;margin-top:16px;font:11px var(--pd-font-hud);text-decoration:none}li{margin-bottom:12px;color:var(--pd-ivory-muted)}.source-list{padding-left:0;list-style:none;font-size:13px}.source-list li{overflow-wrap:anywhere}.licence{white-space:pre-wrap;font:12px/1.7 var(--pd-font-hud);color:var(--pd-ivory-muted);border-top:1px solid var(--pd-line);padding-top:24px}footer{margin-top:48px;padding-block:24px;border-top:1px solid var(--pd-line);font-size:12px;color:var(--pd-ivory-muted)}@media(max-width:767px){body{padding:20px}.entries{grid-template-columns:1fr}article{padding:20px}}
`;
await mkdir(new URL("assets/", out), { recursive: true });
await writeFile(
  new URL("assets/docs.css", out),
  css + "\naudio{display:block;width:100%;max-width:640px}\n",
);
function shell(title, description, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050A0F"><meta name="description" content="${escape(description)}"><title>${escape(title)} — Afterlight</title><link rel="stylesheet" href="./assets/docs.css"><link rel="icon" href="./assets/icon.svg" type="image/svg+xml"></head><body>${body}<footer>AFTERLIGHT · Original application and artwork under MIT. Fonts retain their OFL terms. <a href="./">Back to the sky ↗</a></footer></body></html>`;
}
const usedIds = new Set();
const content = GROUPS.map(
  (group) =>
    `<section id="${group.id}"><h2>${group.name}</h2><div class="entries">${EFFECTS.filter(
      (e) => e.group === group.id,
    )
      .map((effect) => {
        const r = research.catalog.find(
          (c) => c.id === (aliases[effect.id] || effect.id),
        );
        if (!r) throw new Error(`Missing research for ${effect.id}`);
        r.source_ids.forEach((id) => usedIds.add(id));
        const refs = r.source_ids
          .map(
            (id) =>
              `<a href="#source-${id}" aria-label="Source ${id}">[${id}]</a>`,
          )
          .join("");
        return `<article id="${effect.id}"><div class="effect-title">${pictogram(effect.id)}<h3>${escape(effect.name)}</h3></div><p>${escape(effect.description)}</p><details><summary>The shape of the effect</summary><dl><dt>GEOMETRY</dt><dd>${escape(r.geometry)}</dd><dt>MOTION</dt><dd>${escape(r.motion_and_fall)}</dd><dt>TRAIL</dt><dd>${escape(r.trail_rendering)}</dd><dt>NAMING</dt><dd>${escape(r.uncertainty_and_aliases)}</dd></dl></details><div class="refs">${refs}</div><a class="try" href="./?effect=${effect.id}">TRY THIS EFFECT ↗</a></article>`;
      })
      .join("")}</div></section>`,
).join("");
const sources = [...usedIds]
  .sort((a, b) => a - b)
  .map((id) => {
    const s = sourceById[id];
    if (!s) throw new Error(`Missing source ${id}`);
    return `<li id="source-${id}"><a href="${escape(s.url)}" rel="noopener" target="_blank">[${id}] ${escape(s.title)}</a></li>`;
  })
  .join("");
const field = shell(
  "A small field guide",
  "The shapes, trails and movement behind Afterlight’s fireworks.",
  `<header><a href="./">← AFTERLIGHT</a><p class="eyebrow">LOOK A LITTLE CLOSER</p><h1>A small field guide<br>to a very big sky.</h1><p>${EFFECTS.length} presets, grouped by what you see. Built from display-industry glossaries and Japanese makers’ descriptions; animation timings, colours and interface groupings are authored for Afterlight.</p><p>Some names overlap. Canopies such as kamuro and nishiki share a family; a fan is an arrangement, not a new kind of burst. Each preset’s notes keep those distinctions visible.</p><nav aria-label="Effect families">${GROUPS.map((g) => `<a href="#${g.id}">${g.name.toUpperCase()}</a>`).join("")}</nav></header>${content}<section><h2>Sources</h2><p>The links below support the visual vocabulary. A spiral and five-point star are authored pattern interpretations, not frame-matched reproductions of a specific show.</p><ol class="source-list">${sources}</ol></section>`,
);
await writeFile(new URL("field-guide.html", out), field);
const licence = await readFile(new URL("LICENSE", root), "utf8");
const audioPack = JSON.parse(
  await readFile(new URL("public/audio/manifest.json", root), "utf8"),
);
const audioCards = audioPack.samples
  .map(
    (s) =>
      `<article><h3>${escape(s.signature)}</h3><p><audio controls preload="none" aria-label="${escape(s.signature)} sound sample" src="./audio/${escape(s.file)}"></audio></p><a href="./audio/${escape(s.file)}" download>${s.duration}s · DOWNLOAD WAV ↗</a></article>`,
  )
  .join("");
const soundPage = shell(
  "Original sound library",
  "Free MIT fireworks samples and an original spatial sound demonstration.",
  `<header><a href="./">← AFTERLIGHT</a><p class="eyebrow">THE OTHER HALF OF THE SKY</p><h1>Let there be sound.</h1><p>Eight original stereo sound signatures, generated from the synthesis code included with Afterlight. Use them in your own projects under <a href="./licenses/audio.txt">MIT</a>.</p></header><h2>A small demonstration</h2><p>A ${audioPack.demonstration.duration}-second authored mix, with distance delays and layered reports.</p><audio controls preload="none" aria-label="Spatial fireworks sound demonstration" src="./audio/demonstration.wav"></audio><p><a href="./audio/demonstration.wav" download>DOWNLOAD DEMONSTRATION WAV ↗</a></p><h2>The sample palette</h2><div class="entries">${audioCards}</div><p>Stereo · 48 kHz · 16-bit PCM. The app synthesizes seeded variations as you play; these files are reusable examples. No recordings or third-party samples are included.</p>`,
);
await writeFile(new URL("sound-library.html", out), soundPage);
const credits = shell(
  "Credits & licence",
  "Afterlight’s MIT licence, original audio and open-source credits.",
  `<header><a href="./">← AFTERLIGHT</a><p class="eyebrow">BUILT TO BE PLAYED WITH</p><h1>A free sky.</h1><p>Afterlight’s application code, original firework pictograms, procedural graphics and original audio are released under the MIT licence. Fork it, change it, and make another kind of night.</p></header><h2>Made here</h2><p>The scene, fireworks, interface, pictograms and sound synthesis are original work. The interface draws on the ProDyn DSM’s typography, dark field and restrained cyan; the sky keeps the colours of its subject.</p><h2>Open-source foundations</h2><ul><li><a href="https://threejs.org/" rel="noopener">Three.js</a> — 3D renderer, MIT. <a href="./licenses/Three-MIT.txt">Licence</a>.</li><li><a href="https://phosphoricons.com/" rel="noopener">Phosphor Icons</a> — utility symbols, MIT. <a href="./licenses/Phosphor-MIT.txt">Licence</a>.</li><li>Oxanium — display and body type, SIL OFL 1.1. <a href="./licenses/Oxanium-OFL.txt">Licence</a>.</li><li>Departure Mono — control labels, SIL OFL 1.1. <a href="./licenses/Departure-Mono-OFL.txt">Licence</a>.</li><li>Original fireworks audio — generated from the included synthesis source, MIT. <a href="./licenses/audio.txt">Audio notes</a>.</li></ul><h2>Research</h2><p>Read the <a href="./field-guide.html">firework field guide</a> for effect descriptions and source references. Source photographs and recordings are not bundled. Third-party quotations retain attribution and their owners’ rights.</p><h2>Your show stays yours</h2><p>No account, tracking or analytics. Finales are saved in this browser. Exporting downloads a local file. Sharing places the finale in a link’s fragment; the app does not upload it to a server.</p><h2>MIT licence</h2><pre class="licence">${escape(licence)}</pre>`,
);
await writeFile(new URL("credits.html", out), credits);
console.log(
  `Generated accessible field guide for ${EFFECTS.length} effects and ${usedIds.size} cited sources; credits and licences.`,
);
