import "./style.css";
import { getLanguage, setLanguage } from "../public/language.js";
import {
  translate,
  translateError,
  escapeHTML,
  bindStaticCopy,
} from "./i18n.js";
const t = (key, values = {}) =>
  translate(
    typeof key === "function" ? key() : key,
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === "function" ? value() : value,
      ]),
    ),
    getLanguage(),
  );
const h = (key, values = {}) => escapeHTML(t(key, values));
const errorCopy = (error, fallback) =>
  translateError(error, getLanguage(), fallback);
const renderStaticCopy = bindStaticCopy();
const textCopies = new Map();
function setCopy(id, key, values = {}) {
  textCopies.set(id, { key, values });
  document.getElementById(id).textContent = t(key, values);
}

import {
  EFFECTS,
  EFFECT_BY_ID,
  GROUPS,
  PALETTES,
  pictogram,
} from "./data/catalog.js";
import {
  MAX_LAYERS,
  createLayer,
  validateShow,
  encodeShow,
  decodeShow,
  ShowPlayer,
  readSaved,
  saveShow,
  PRESETS,
} from "./show.js";
import { applyIcons, ICONS } from "./icons.js";
import { FireworksAudio } from "./audio/audio.js";
import { setupPWA } from "./pwa/pwa.js";

const $ = (id) => document.getElementById(id);
const abort = new AbortController();
const on = (node, type, fn, options = {}) =>
  node.addEventListener(type, fn, { ...options, signal: abort.signal });
const safeStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const saved = readSaved(safeStorage);
let show = saved.show || {
  version: 1,
  title: t("My night sky"),
  duration: 22,
  layers: [],
};
let sharedMode = false;
let initialMessage = saved.error
  ? "Your previous show could not be read. You can still create and export one."
  : "";
if (location.hash.startsWith("#show=")) {
  try {
    show = decodeShow(location.hash.slice(6));
    sharedMode = true;
    initialMessage = "Shared finale opened. Your saved finale has been kept.";
  } catch (error) {
    initialMessage = () =>
      errorCopy(
        error,
        "The file could not be read. Choose a valid Afterlight JSON show file.",
      );
  }
}
const media = matchMedia("(prefers-reduced-motion: reduce)");
const fromGuide = new URLSearchParams(location.search).get("effect");
const state = {
  selected: Object.hasOwn(EFFECT_BY_ID, fromGuide)
    ? fromGuide
    : "chrysanthemum",
  group: Object.hasOwn(EFFECT_BY_ID, fromGuide)
    ? EFFECT_BY_ID[fromGuide].group
    : "blooms",
  palette: "signature",
  paused: false,
  ready: false,
  error: null,
  sound: false,
  soundPreferred: readSoundPreference(),
  gentle: media.matches,
  quality: "auto",
  wind: 2,
  view: "audience",
  reflections: true,
  manualClock: false,
  launches: 0,
  frame: 0,
};
const audio = new FireworksAudio({ volume: 0.6, enabled: false });
let soundRequest = 0;
let soundPending = false;
let pageSuspended = false;
let engine = null,
  rendererGeneration = 0,
  raf = 0,
  lastTime = 0,
  toastTimer = 0,
  introCopyTimer = setTimeout(hideIntroCopy, 4000),
  seed = 8316,
  disposed = false,
  introTime = 0,
  introIndex = 0,
  introActive = !state.gentle;
const player = new ShowPlayer(
  (cue) => launch(cue, false),
  () => {
    updateFinaleControls();
    toast("The last word is in the sky.");
  },
);

function toast(message, values = {}) {
  setCopy("toast", message, values);
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3600);
}
function persist() {
  if (sharedMode) {
    setCopy("save-note", "SHARED SHOW · ORIGINAL KEPT");
    return;
  }
  const ok = saveShow(safeStorage, show);
  setCopy(
    "save-note",
    ok ? "SAVED ON THIS DEVICE" : "USE SAVE FILE TO KEEP THIS SHOW",
  );
  if (!ok)
    toast(
      "Browser storage is unavailable. Save a show file to keep your finale.",
    );
}
function chosenPalette() {
  return state.palette;
}
function hideIntroCopy() {
  clearTimeout(introCopyTimer);
  const title = $("sky-title");
  if (title.contains(document.activeElement))
    $("sky").focus({ preventScroll: true });
  title.inert = true;
  title.setAttribute("aria-hidden", "true");
  title.classList.add("dismissed");
}
function dismissIntro() {
  introActive = false;
  hideIntroCopy();
}
function availableEffects() {
  return EFFECTS.filter((e) => e.group === state.group);
}
function renderBanks() {
  $("banks").innerHTML = GROUPS.map(
    (g) =>
      `<button class="bank" data-bank="${g.id}" aria-pressed="${state.group === g.id}" title="${h(g.name)}">${pictogram(g.icon, "bank-pic")}<span>${h(g.name)}</span></button>`,
  ).join("");
}
function renderPad() {
  $("effect-pad").style.setProperty("--keys", availableEffects().length);
  $("effect-pad").innerHTML = availableEffects()
    .map(
      (e, i) =>
        `<div class="effect-key ${state.selected === e.id ? "selected" : ""}" data-key="${e.id}"><button class="effect-fire" data-fire="${e.id}" aria-label="${h("Fire {name}", { name: t(e.name) })}" title="${h(e.name)} · ${i + 1}">${pictogram(e.id, "effect-pic")}<span class="effect-name">${h(e.name)}</span></button><button class="effect-add" data-add="${e.id}" aria-label="${h("Add {name} to finale", { name: t(e.name) })}" title="${h("Add {name} to finale", { name: t(e.name) })}">+<span>${h("LAYER")}</span></button></div>`,
    )
    .join("");
  updateAvailability();
}
function selectEffect(id) {
  if (!EFFECT_BY_ID[id]) return;
  state.selected = id;
  $("selected-name").textContent = t(EFFECT_BY_ID[id].name);
  $("selected-description").textContent = t(EFFECT_BY_ID[id].description);
  document
    .querySelectorAll("[data-key]")
    .forEach((n) => n.classList.toggle("selected", n.dataset.key === id));
  $("fire-selected").setAttribute(
    "aria-label",
    t("Fire selected: {name}", { name: t(EFFECT_BY_ID[id].name) }),
  );
  $("add-selected").setAttribute(
    "aria-label",
    t("Add selected to finale: {name}", { name: t(EFFECT_BY_ID[id].name) }),
  );
}
function renderPalettes() {
  $("swatches").innerHTML = PALETTES.map(
    (p) =>
      `<button class="swatch ${p.id === "signature" ? "signature" : ""}" data-palette="${p.id}" style="--swatch:${p.color}" aria-label="${h("{name} colour", { name: t(p.name) })}" aria-pressed="${state.palette === p.id}" title="${h(p.name)}"></button>`,
  ).join("");
}
function setPalette(id) {
  if (!PALETTES.some((p) => p.id === id)) return;
  state.palette = id;
  $("palette-name").textContent = t(PALETTES.find((p) => p.id === id).name);
  document
    .querySelectorAll("[data-palette]")
    .forEach((n) =>
      n.setAttribute("aria-pressed", String(n.dataset.palette === id)),
    );
}
function updateAvailability() {
  document
    .querySelectorAll(
      "[data-fire],#fire-selected,#watch-show,#capture,#clear-sky,#pause-toggle",
    )
    .forEach((n) => (n.disabled = !state.ready));
  updateFinaleControls();
}
function launch(options = {}, manual = true) {
  if (!engine || !state.ready) return false;
  const effectId = options.effectId || state.selected;
  if (!EFFECT_BY_ID[effectId]) return false;
  if (manual) {
    dismissIntro();
    if (state.paused) setPaused(false);
  }
  try {
    const result = engine.launch({
      effectId,
      palette: options.palette || chosenPalette(effectId),
      position: options.position ?? Math.sin(++seed) * 0.92,
      variation: options.variation,
      scale: options.scale ?? 1,
      loft: options.loft ?? 1,
      seed: options.seed ?? ++seed,
    });
    if (result?.ok === false) {
      if (manual)
        toast("The sky is full. Let a few stars fade, then fire again.");
      return false;
    }
    state.launches++;
    setCopy("fired-name", EFFECT_BY_ID[effectId].name);
    return true;
  } catch (error) {
    toast("Could not fire this effect: {error}", {
      error: () => errorCopy(error),
    });
    return false;
  }
}
function addLayer(id = state.selected) {
  if (show.layers.length >= MAX_LAYERS) {
    toast("The finale holds {count} layers. Remove one to make room.", {
      count: MAX_LAYERS,
    });
    return;
  }
  show.layers.push(createLayer(id, state.palette));
  persist();
  renderFinale();
  toast("{name} added to the finale.", {
    name: () => t(EFFECT_BY_ID[id].name),
  });
}
function renderFinale() {
  const focus = document.activeElement;
  const focusedId = focus?.closest("[data-layer]")?.dataset.layer;
  const focusedAction = focus?.dataset.action;
  $("show-title").value = show.title;
  $("duration").value = show.duration;
  $("duration-value").textContent = `${show.duration}s`;
  $("finale-count").textContent = show.layers.length;
  $("layer-empty").hidden = show.layers.length > 0;
  $("layer-list").innerHTML = show.layers
    .map((l, i) => {
      const e = EFFECT_BY_ID[l.effectId],
        palette = PALETTES.find((p) => p.id === l.palette);
      return `<li class="layer-tile" data-layer="${l.id}"><div class="layer-tile-head">${pictogram(l.effectId, "layer-pic")}<span class="layer-index">${String(i + 1).padStart(2, "0")}</span></div><h3>${h(e.name)}</h3><p class="layer-palette">${h(palette.name)}</p><div class="layer-controls"><button class="density-button" data-action="density" aria-label="${h("{name} density {density}. Change density", { name: t(e.name), density: l.density })}" title="${h("Density: {density}", { density: t(["", "sparse", "full", "intense"][l.density]) })}">${"Ⅰ".repeat(l.density)}</button><div class="layer-tools"><button data-action="left" aria-label="${h("Move {name} earlier", { name: t(e.name) })}" ${i === 0 ? "disabled" : ""}>‹</button><button data-action="right" aria-label="${h("Move {name} later", { name: t(e.name) })}" ${i === show.layers.length - 1 ? "disabled" : ""}>›</button><button data-action="remove" aria-label="${h("Remove {name} layer", { name: t(e.name) })}">×</button></div></div></li>`;
    })
    .join("");
  $("cue-ribbon").hidden = !show.layers.length;
  $("cue-ribbon").innerHTML = Array.from(
    { length: 48 },
    (_, i) =>
      `<span style="--cue-opacity:${0.18 + i / 58};--cue-height:${0.15 + Math.pow(i / 47, 1.8) * 0.85}"></span>`,
  ).join("");
  updateFinaleControls();
  if (focusedId && focusedAction) {
    const element = Array.from(document.querySelectorAll("[data-layer]"))
      .find((n) => n.dataset.layer === focusedId)
      ?.querySelector(`[data-action="${focusedAction}"]`);
    if (element && !element.disabled) element.focus({ preventScroll: true });
  }
}
function updateFinaleControls() {
  $("finale-fire").disabled =
    !state.ready || (!show.layers.length && !player?.running);
  $("finale-fire").classList.toggle("playing", Boolean(player?.running));
  $("finale-fire-label").textContent = player?.running
    ? t("STOP FINALE")
    : t("FIRE FINALE");
  $("show-progress").hidden = !player?.running;
  $("clear-finale").disabled = show.layers.length === 0;
  $("export-show").disabled = show.layers.length === 0;
  $("share-show").disabled = show.layers.length === 0;
}
function openFinale(open = true) {
  $("finale-panel").hidden = !open;
  $("finale-open").setAttribute("aria-expanded", String(open));
  if (open) dismissIntro();
}
function startFinale() {
  if (player.running) {
    player.stop();
    audio.stop();
    updateFinaleControls();
    toast("Finale stopped. Stars already in the sky will fade.");
    return;
  }
  if (!state.ready || !show.layers.length) {
    openFinale();
    return;
  }
  dismissIntro();
  setPaused(false);
  player.start(show.layers, { duration: show.duration, seed: ++seed });
  updateFinaleControls();
  openFinale(false);
  toast("{title} · {count} layers", {
    title: show.title || (() => t("Your finale")),
    count: show.layers.length,
  });
}
function setPaused(value) {
  state.paused = Boolean(value);
  $("pause-toggle").setAttribute("aria-pressed", String(state.paused));
  $("pause-toggle").setAttribute(
    "aria-label",
    t(state.paused ? "Resume the show" : "Pause the show"),
  );
  $("pause-toggle").innerHTML = state.paused ? ICONS.play : ICONS.pause;
  $("paused-label").hidden = !state.paused;
  if (state.paused) audio.stop();
  lastTime = 0;
}
function clearSky() {
  player.stop();
  introActive = false;
  engine?.reset();
  audio.stop();
  setCopy("fired-name", "A clean slate.");
  updateFinaleControls();
}
async function toggleSound() {
  if (disposed || document.hidden || pageSuspended) return;
  if (state.sound || soundPending) {
    muteSound();
    return;
  }
  rememberSound(true);
  return startSound(false);
}
async function startSound(restoring) {
  if (disposed || document.hidden || pageSuspended || soundPending) return;
  const request = ++soundRequest;
  soundPending = true;
  renderSound();
  try {
    // Returning resumes an existing consented context; it cannot grant consent.
    const enabled = Boolean(
      await (restoring ? audio.resume() : audio.enable()),
    );
    if (
      request !== soundRequest ||
      disposed ||
      document.hidden ||
      pageSuspended
    ) {
      if (disposed || !state.soundPreferred) audio.setEnabled(false);
      else if (document.hidden || pageSuspended) await audio.suspend();
      return;
    }
    state.sound = enabled;
    if (!enabled)
      toast(
        restoring
          ? "Tap Sound to resume."
          : "Sound could not start. Tap Sound again to retry.",
      );
  } catch {
    if (
      request === soundRequest &&
      !disposed &&
      !document.hidden &&
      !pageSuspended
    ) {
      state.sound = false;
      toast("Audio is unavailable in this browser.");
    }
  } finally {
    if (request === soundRequest) {
      soundPending = false;
      if (!disposed) renderSound();
    }
  }
}
function renderSound() {
  $("sound-toggle").setAttribute("aria-busy", String(soundPending));
  $("sound-toggle").setAttribute("aria-pressed", String(state.sound));
  $("sound-toggle").setAttribute(
    "aria-label",
    t(
      soundPending
        ? "Cancel starting sound"
        : state.sound
          ? "Mute sound"
          : "Enable sound",
    ),
  );
  $("sound-toggle").querySelector("[data-icon]").innerHTML = state.sound
    ? ICONS["sound-on"]
    : ICONS["sound-off"];
  $("sound-label").textContent = t(
    soundPending ? "STARTING…" : state.sound ? "SOUND ON" : "SOUND OFF",
  );
}
function readSoundPreference() {
  try {
    return safeStorage.getItem("afterlight:sound:v1") === "on";
  } catch {
    return false;
  }
}
function rememberSound(enabled) {
  state.soundPreferred = Boolean(enabled);
  try {
    safeStorage.setItem("afterlight:sound:v1", enabled ? "on" : "off");
  } catch {
    // The same-page preference still works with storage unavailable.
  }
}
function muteSound() {
  rememberSound(false);
  soundRequest++;
  soundPending = false;
  audio.setEnabled(false);
  audio.stop();
  state.sound = false;
  renderSound();
}
function suspendSoundForVisibility() {
  soundRequest++;
  soundPending = false;
  state.sound = false;
  // Cancel old voices, but keep consent and preference through this pause.
  void audio.suspend();
  renderSound();
}
function resumeSoundForVisibility() {
  if (
    disposed ||
    document.hidden ||
    pageSuspended ||
    soundPending ||
    !state.soundPreferred
  )
    return;
  const stats = audio.getStats();
  if (stats.consented && (!state.sound || stats.contextState !== "running"))
    void startSound(true);
}
function restoreRememberedSound(event) {
  if (!event.isTrusted || event.target.closest?.("#sound-toggle")) return;
  // Mouse activation arrives on down; touch/pen activation arrives on up.
  if (
    (event.type === "pointerdown" && event.pointerType !== "mouse") ||
    (event.type === "pointerup" && event.pointerType === "mouse")
  )
    return;
  if (
    event.type === "keydown" &&
    (event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !/^(Enter| |[1-8fp])$/i.test(event.key))
  )
    return;
  if (state.soundPreferred && !state.sound && !soundPending)
    void startSound(false);
}
function rendererFailed(error) {
  state.ready = false;
  state.error = error?.message || String(error);
  $("canvas-error").hidden = false;
  setCopy("stage-status", "");
  $("sky").classList.remove("ready");
  player.stop();
  audio.stop();
  updateAvailability();
}
function resize() {
  const deck = $("app").querySelector(".deck").getBoundingClientRect();
  $("app").style.setProperty("--deck-height", `${deck.height}px`);
  if (engine) {
    const r = $("film").getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      engine.resize(r.width, r.height, devicePixelRatio || 1);
      engine.render();
    }
  }
}
async function initRenderer() {
  const generation = ++rendererGeneration;
  try {
    $("canvas-error").hidden = true;
    setCopy("stage-status", "Preparing the sky…");
    const { AfterlightEngine } = await import("./engine/engine.js");
    if (disposed || generation !== rendererGeneration) return;
    if (engine) engine.dispose();
    engine = new AfterlightEngine($("sky"), {
      quality: state.quality,
      reducedMotion: state.gentle,
      onError: rendererFailed,
      onEvent: (event) => {
        if (state.sound) audio.emit(event);
      },
    });
    engine.setOptions({
      wind: state.wind,
      quality: state.quality,
      reducedMotion: state.gentle,
      reflections: state.reflections,
    });
    engine.setView(state.view);
    audio.setListener(engine.getCameraPosition());
    state.ready = true;
    state.error = null;
    resize();
    engine.render();
    $("sky").classList.add("ready");
    setCopy("stage-status", "");
    updateAvailability();
    if (state.gentle) {
      introActive = false;
      toast("Gentle mode is on. The sky starts still.");
    }
    if (Object.hasOwn(EFFECT_BY_ID, fromGuide)) {
      launch({ effectId: fromGuide });
    }
  } catch (error) {
    rendererFailed(error);
  }
}
function update(dt, draw = true) {
  if (state.ready && !state.paused) {
    if (introActive) {
      introTime += dt;
      const opening = [
        {
          at: 0.35,
          effectId: "willow",
          position: 0.42,
          palette: "gold",
          scale: 1.2,
        },
        {
          at: 1.2,
          effectId: "pistil",
          position: -0.2,
          palette: "azure",
          scale: 0.8,
        },
        {
          at: 2.2,
          effectId: "chrysanthemum",
          position: 0.05,
          palette: "gold",
          scale: 1.05,
        },
      ];
      while (
        introIndex < opening.length &&
        introTime >= opening[introIndex].at
      ) {
        launch(opening[introIndex++], false);
      }
      if (introIndex >= opening.length) introActive = false;
    }
    player.update(dt);
    engine.update(dt);
    if (player.running)
      $("show-progress-fill").style.width = `${player.progress * 100}%`;
  }
  if (engine && state.ready && draw) {
    engine.render();
    state.frame++;
  }
}
function frame(t) {
  if (disposed || document.hidden) return;
  const dt = lastTime ? Math.min((t - lastTime) / 1000, 0.05) : 0;
  lastTime = t;
  try {
    update(state.manualClock ? 0 : dt);
  } catch (error) {
    rendererFailed(error);
  }
  raf = requestAnimationFrame(frame);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportShow() {
  download(
    new Blob([JSON.stringify(validateShow(show), null, 2)], {
      type: "application/json",
    }),
    "afterlight-show.json",
  );
  toast("Show file saved.");
}
async function shareShow() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = `show=${encodeShow(show)}`;
  try {
    await navigator.clipboard.writeText(url.href);
    toast("Show link copied. The finale travels in the link.");
  } catch {
    if (navigator.share) {
      try {
        await navigator.share({
          title: show.title || "Afterlight",
          url: url.href,
        });
      } catch (error) {
        if (error.name !== "AbortError")
          toast(
            "This browser could not share the link. Save a show file instead.",
          );
      }
    } else {
      window.prompt(t("Copy this show link:"), url.href);
    }
  }
}
function replaceShow(incoming, description) {
  const next = validateShow(incoming);
  const stored = sharedMode ? readSaved(safeStorage) : null;
  const originalAtRisk = Boolean(stored && (stored.show || stored.error));
  if (
    (show.layers.length || originalAtRisk) &&
    !window.confirm(
      t(
        "{action} with {description}? Save a show file first if you want to keep both.",
        {
          action: t(
            originalAtRisk
              ? "Replace this shared finale and your saved original"
              : "Replace the current finale",
          ),
          description: t(description),
        },
      ),
    )
  )
    return false;
  player.stop();
  audio.stop();
  dismissIntro();
  show = next;
  sharedMode = false;
  if (location.hash.startsWith("#show=")) {
    const url = new URL(location.href);
    url.hash = "";
    history.replaceState(history.state, "", url.href);
  }
  persist();
  renderFinale();
  return true;
}
function choosePreset(index, play = false) {
  const preset = PRESETS[index];
  if (!preset) return;
  const next = {
    version: 1,
    title: t(preset.name),
    duration: preset.duration,
    layers: preset.types.map(([id, palette]) => createLayer(id, palette)),
  };
  if (!replaceShow(next, "this composed show")) return;
  $("presets").close();
  if (play) startFinale();
  else openFinale();
}
function renderPresets() {
  $("preset-list").innerHTML = PRESETS.map(
    (p, i) =>
      `<article class="preset"><div><h3>${h(p.name)}</h3><p>${h(p.description)}</p><div class="preset-icons">${p.types.map(([id]) => pictogram(id)).join("")}</div></div><button data-preset="${i}">${h("LOAD {duration}s SHOW ↗", { duration: p.duration })}</button></article>`,
  ).join("");
}
function setGentle(value) {
  state.gentle = Boolean(value);
  $("gentle").checked = state.gentle;
  if (state.gentle) {
    introActive = false;
  }
  engine?.setOptions({ reducedMotion: state.gentle });
}
function setCinema(value) {
  $("app").classList.toggle("cinema", value);
  openFinale(false);
  $("fullscreen-toggle").setAttribute(
    "aria-label",
    t(value ? "Leave cinema fullscreen" : "Enter cinema fullscreen"),
  );
  resize();
  (value ? $("sky") : $("fullscreen-toggle")).focus({ preventScroll: true });
}
async function exitCinema() {
  setCinema(false);
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      toast("Press Escape to leave browser fullscreen.");
    }
  }
}

renderStaticCopy(getLanguage());
applyIcons();
renderBanks();
renderPad();
selectEffect(state.selected);
renderPalettes();
renderFinale();
renderPresets();
$("gentle").checked = state.gentle;
if (sharedMode) setCopy("save-note", "SHARED SHOW · ORIGINAL KEPT");
on($("banks"), "click", (e) => {
  const b = e.target.closest("[data-bank]");
  if (!b) return;
  state.group = b.dataset.bank;
  document
    .querySelectorAll("[data-bank]")
    .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
  renderPad();
});
on($("effect-pad"), "click", (e) => {
  const fire = e.target.closest("[data-fire]"),
    add = e.target.closest("[data-add]");
  if (fire) {
    selectEffect(fire.dataset.fire);
    launch();
  }
  if (add) {
    selectEffect(add.dataset.add);
    addLayer(add.dataset.add);
  }
});
on($("swatches"), "click", (e) => {
  const b = e.target.closest("[data-palette]");
  if (b) setPalette(b.dataset.palette);
});
on($("fire-selected"), "click", () => launch());
on($("add-selected"), "click", () => addLayer());
let pointerStart = null;
on($("sky"), "pointerdown", (e) => {
  if (!e.isPrimary || e.button > 0) return;
  pointerStart = {
    x: e.clientX,
    y: e.clientY,
    id: e.pointerId,
    time: performance.now(),
  };
});
on($("sky"), "pointerup", (e) => {
  if (!pointerStart || pointerStart.id !== e.pointerId) return;
  const d = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
  pointerStart = null;
  if (d > 14) return;
  const r = $("sky").getBoundingClientRect();
  launch({
    position: Math.max(
      -1,
      Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2),
    ),
    loft: Math.max(
      0.7,
      Math.min(1.3, 1.4 - ((e.clientY - r.top) / r.height) * 0.7),
    ),
  });
});
on($("sky"), "pointercancel", () => {
  pointerStart = null;
});
on($("sound-toggle"), "click", toggleSound);
// A saved preference does not grant autoplay on a fresh page. Unlock it from
// the first ordinary interaction, without another Sound-button click.
on(document, "pointerdown", restoreRememberedSound, { capture: true });
on(document, "pointerup", restoreRememberedSound, { capture: true });
on(document, "keydown", restoreRememberedSound, { capture: true });
on($("pause-toggle"), "click", () => setPaused(!state.paused));
on($("resume-inline"), "click", () => setPaused(false));
on($("clear-sky"), "click", clearSky);
on($("finale-open"), "click", () => openFinale($("finale-panel").hidden));
on($("finale-close"), "click", () => {
  openFinale(false);
  $("finale-open").focus();
});
on($("finale-fire"), "click", startFinale);
on($("show-title"), "input", (e) => {
  show.title = e.target.value.slice(0, 64);
  persist();
});
on($("duration"), "input", (e) => {
  show.duration = Number(e.target.value);
  $("duration-value").textContent = `${show.duration}s`;
  persist();
});
on($("layer-list"), "click", (e) => {
  const button = e.target.closest("[data-action]"),
    li = button?.closest("[data-layer]");
  if (!li) return;
  const i = show.layers.findIndex((l) => l.id === li.dataset.layer);
  if (i < 0) return;
  const a = button.dataset.action;
  if (a === "remove") {
    if (
      !window.confirm(
        t("Remove the {name} layer from this finale?", {
          name: t(EFFECT_BY_ID[show.layers[i].effectId].name),
        }),
      )
    )
      return;
    show.layers.splice(i, 1);
  }
  if (a === "density")
    show.layers[i].density = (show.layers[i].density % 3) + 1;
  if (a === "left" && i > 0)
    [show.layers[i - 1], show.layers[i]] = [show.layers[i], show.layers[i - 1]];
  if (a === "right" && i < show.layers.length - 1)
    [show.layers[i + 1], show.layers[i]] = [show.layers[i], show.layers[i + 1]];
  persist();
  renderFinale();
});
on($("clear-finale"), "click", () => {
  if (window.confirm(t("Clear all layers from this finale?"))) {
    show.layers = [];
    player.stop();
    audio.stop();
    persist();
    renderFinale();
  }
});
on($("export-show"), "click", exportShow);
on($("share-show"), "click", shareShow);
on($("presets-open"), "click", () => $("presets").showModal());
on($("preset-list"), "click", (e) => {
  const b = e.target.closest("[data-preset]");
  if (b) choosePreset(Number(b.dataset.preset));
});
on($("watch-show"), "click", () => {
  if (show.layers.length) startFinale();
  else choosePreset(2, true);
});
on($("settings-open"), "click", () => $("settings").showModal());
document
  .querySelectorAll("[data-close-dialog]")
  .forEach((b) => on(b, "click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((d) =>
  on(d, "click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  }),
);
on($("volume"), "input", (e) => {
  audio.setVolume(Number(e.target.value) / 100);
  $("volume-value").textContent = `${e.target.value}%`;
});
on($("wind"), "input", (e) => {
  state.wind = Number(e.target.value);
  engine?.setOptions({ wind: state.wind });
  $("wind-value").textContent =
    state.wind === 0
      ? t("Still")
      : `${Math.abs(state.wind)} m/s ${state.wind > 0 ? "→" : "←"}`;
});
on($("quality"), "change", (e) => {
  state.quality = e.target.value;
  engine?.setOptions({ quality: state.quality });
  resize();
});
on($("view"), "change", (e) => {
  state.view = e.target.value;
  engine?.setView(state.view);
  if (engine) audio.setListener(engine.getCameraPosition());
  engine?.render();
});
on($("reflections"), "change", (e) => {
  state.reflections = e.target.checked;
  engine?.setOptions({ reflections: state.reflections });
  engine?.render();
});
on($("gentle"), "change", (e) => setGentle(e.target.checked));
on(media, "change", (e) => setGentle(e.matches));
on($("retry-renderer"), "click", initRenderer);
on($("fullscreen-toggle"), "click", async () => {
  setCinema(true);
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* The in-page cinema view remains usable when native fullscreen is unavailable. */
  }
});
on($("cinema-exit"), "click", exitCinema);
on(document, "fullscreenchange", () => {
  if (!document.fullscreenElement && $("app").classList.contains("cinema"))
    setCinema(false);
  else resize();
});
on($("capture"), "click", () => {
  if (!state.ready) return;
  engine.render();
  $("sky").toBlob((blob) => {
    if (blob) {
      download(blob, "afterlight-sky.png");
      toast("Sky saved.");
    } else toast("This browser could not save the picture.");
  }, "image/png");
});
on($("import-show"), "click", () => $("import-file").click());
on($("import-file"), "change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 65536) {
    toast("This file is too large for an Afterlight show.");
    return;
  }
  try {
    const incoming = validateShow(JSON.parse(await file.text()));
    if (!replaceShow(incoming, "this show file")) return;
    $("settings").close();
    openFinale();
    toast("Show file opened.");
  } catch (error) {
    toast(() =>
      errorCopy(
        error,
        "The file could not be read. Choose a valid Afterlight JSON show file.",
      ),
    );
  }
});
on(document, "keydown", (e) => {
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
    if ($("app").classList.contains("cinema")) exitCinema();
    else openFinale(false);
    return;
  }
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.target.closest("input,select,textarea,button,a,dialog")
  )
    return;
  const n = Number(e.key);
  if (n >= 1 && n <= 8) {
    const effect = availableEffects()[n - 1];
    if (effect) {
      e.preventDefault();
      selectEffect(effect.id);
      if (e.shiftKey) addLayer(effect.id);
      else launch();
    }
    return;
  }
  // Shifted number keys yield punctuation on many keyboards; code preserves the physical shortcut.
  if (e.shiftKey && /^Digit[1-8]$/.test(e.code)) {
    const effect = availableEffects()[Number(e.code.slice(-1)) - 1];
    if (effect) {
      e.preventDefault();
      selectEffect(effect.id);
      addLayer(effect.id);
    }
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    launch();
  } else if (e.key.toLowerCase() === "p") setPaused(!state.paused);
  else if (e.key.toLowerCase() === "m") toggleSound();
  else if (e.key.toLowerCase() === "f") startFinale();
});
const observer = new ResizeObserver(resize);
observer.observe($("film"));
observer.observe(document.querySelector(".deck"));
on(window, "resize", resize);
on(document, "visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    suspendSoundForVisibility();
  } else {
    lastTime = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    resumeSoundForVisibility();
  }
});
on(window, "focus", resumeSoundForVisibility);
on(window, "pagehide", (e) => {
  pageSuspended = true;
  cancelAnimationFrame(raf);
  suspendSoundForVisibility();
  if (!e.persisted) dispose();
});
on(window, "pageshow", (e) => {
  if (e.persisted) {
    pageSuspended = false;
    lastTime = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    resumeSoundForVisibility();
  }
});
let pwaSnapshot;
function renderPWA(s) {
  pwaSnapshot = s;
  $("pwa-status").textContent = t(
    s.message ||
      (s.offlineReady
        ? "Ready offline. Install to keep your own night sky."
        : "Preparing the offline sky…"),
  );
  $("install-app").textContent = t(
    s.installed
      ? "INSTALLED"
      : s.installable
        ? "INSTALL APP"
        : "HOW TO INSTALL",
  );
  $("install-app").disabled = Boolean(s.installed);
  $("update-app").hidden = !s.updateAvailable;
}
const pwa = setupPWA({ onStatus: renderPWA });
on($("install-app"), "click", async () => {
  try {
    // The PWA owner retains manual guidance across download-status updates too.
    await pwa.install();
  } catch (error) {
    toast(() => errorCopy(error));
  }
});
on($("update-app"), "click", async () => {
  if (
    window.confirm(
      t(
        "Update Afterlight now? The sky will restart; your saved finale will stay.",
      ),
    )
  ) {
    player.stop();
    audio.stop();
    await pwa.applyUpdate();
  }
});
function dispose() {
  if (disposed) return;
  disposed = true;
  soundRequest++;
  soundPending = false;
  state.sound = false;
  audio.setEnabled(false);
  rendererGeneration++;
  cancelAnimationFrame(raf);
  clearTimeout(toastTimer);
  observer.disconnect();
  clearTimeout(introCopyTimer);
  abort.abort();
  pwa.dispose();
  player.stop();
  audio.dispose();
  engine?.dispose();
}
window.__afterlight = {
  get ready() {
    return state.ready;
  },
  get state() {
    return {
      ...state,
      show: structuredClone(show),
      player: {
        running: player.running,
        elapsed: player.elapsed,
        index: player.index,
        total: player.cues.length,
      },
    };
  },
  stats: () => ({
    engine: engine?.getStats(),
    audio: audio.getStats(),
    pwa: pwa.getState(),
    frame: state.frame,
  }),
  fire: (options) => launch(options),
  select: selectEffect,
  clear: clearSky,
  pause: setPaused,
  addLayer,
  setTestClock(value) {
    if (!new URLSearchParams(location.search).has("test"))
      throw new Error("Deterministic stepping is available with ?test=1");
    state.manualClock = Boolean(value);
    introActive = false;
  },
  step(seconds) {
    if (!state.manualClock)
      throw new Error("Enable the deterministic test clock first");
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 120)
      throw new Error("Invalid step");
    let remaining = seconds;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 60);
      update(dt, false);
      remaining -= dt;
    }
    if (engine && state.ready) {
      engine.render();
      state.frame++;
    }
  },
  dispose,
};
function renderLanguage() {
  renderStaticCopy(getLanguage());
  $("language").value = getLanguage();
  renderBanks();
  renderPad();
  selectEffect(state.selected);
  renderPalettes();
  setPalette(state.palette);
  renderFinale();
  renderPresets();
  renderSound();
  $("pause-toggle").setAttribute(
    "aria-label",
    t(state.paused ? "Resume the show" : "Pause the show"),
  );
  $("fullscreen-toggle").setAttribute(
    "aria-label",
    t(
      $("app").classList.contains("cinema")
        ? "Leave cinema fullscreen"
        : "Enter cinema fullscreen",
    ),
  );
  $("wind-value").textContent =
    state.wind === 0
      ? t("Still")
      : `${Math.abs(state.wind)} m/s ${state.wind > 0 ? "→" : "←"}`;
  for (const [id, { key, values }] of textCopies)
    $(id).textContent = t(key, values);
  if (pwaSnapshot) renderPWA(pwaSnapshot);
  resize();
}
on($("language"), "change", (event) => setLanguage(event.target.value));
on(window, "afterlight:language", renderLanguage);
renderLanguage();
resize();
initRenderer();
raf = requestAnimationFrame(frame);
if (initialMessage) setTimeout(() => toast(initialMessage), 700);
