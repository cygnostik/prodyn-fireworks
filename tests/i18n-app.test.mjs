import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { EFFECTS, GROUPS, PALETTES } from "../src/data/catalog.js";
import {
  translate,
  translateError,
  escapeHTML,
  messages,
  effectTranslations,
} from "../src/i18n.js";

test("every catalog effect has an explicit Spanish name and description", () => {
  assert.equal(Object.keys(effectTranslations).length, 40);
  for (const effect of EFFECTS) {
    assert.equal(effectTranslations[effect.id].length, 2);
    assert.ok(
      effectTranslations[effect.id].every(
        (value) => typeof value === "string" && value.length,
      ),
    );
    assert.notEqual(
      translate(effect.description, {}, "es-MX"),
      effect.description,
    );
    assert.equal(translate(effect.name, {}, "en"), effect.name);
  }
  for (const item of [...GROUPS, ...PALETTES])
    assert.ok(Object.hasOwn(messages, item.name), item.name);
});
test("substitutions are literal and HTML escaping covers attributes", () => {
  assert.equal(
    translate("Fire {name}", { name: '<img onerror="bad">' }, "es-MX"),
    'Lanzar <img onerror="bad">',
  );
  assert.equal(
    escapeHTML('<img onerror="bad">&\''),
    "&lt;img onerror=&quot;bad&quot;&gt;&amp;&#39;",
  );
  assert.equal(
    translate("Fire {name}", { name: "$& {name}" }, "en"),
    "Fire $& {name}",
  );
});
test("composed PWA status and validation errors localize without losing detail", () => {
  assert.equal(
    translate("Unknown colour in layer 3.", {}, "es-MX"),
    "Color desconocido en la capa 3.",
  );
  assert.match(
    translate(
      "Could not open this show: Unknown colour in layer 3.",
      {},
      "es-MX",
    ),
    /Color desconocido en la capa 3/,
  );
  assert.match(
    translate(
      "Offline. Your saved AFTERLIGHT copy is ready. On iPhone or iPad, open AFTERLIGHT in Safari, tap Share, then Add to Home Screen. If it is hidden, choose More in the Share menu.",
      {},
      "es-MX",
    ),
    /Compartir/,
  );
});

test("static instrument copy has explicit translations; only brand and keyboard tokens are exempt", () => {
  const html = readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  ).replace(/<(script|noscript|footer)\b[\s\S]*?<\/\1\s*>/g, "");
  const exemptions = new Set([
    "AFTER",
    "LIGHT",
    "English",
    "Español",
    "Shift + 1—8",
    "P",
    "F",
    "M",
    "22s",
    "1—8",
  ]);
  for (const source of html
    .split(/<[^>]+>/)
    .map((text) => text.trim().replace(/\s+/g, " "))
    .filter((text) => /[a-zA-Z]/.test(text))) {
    assert.ok(
      Object.hasOwn(messages, source) || exemptions.has(source),
      `Missing static copy: ${source}`,
    );
  }
  for (const [, source] of html.matchAll(/(?:aria-label|alt|title)="([^"]+)"/g))
    assert.ok(
      Object.hasOwn(messages, source),
      `Missing accessible copy: ${source}`,
    );
  assert.doesNotMatch(html, /class="portrait-note"/);
});

test("all current long PWA status literals have explicit translations", () => {
  const source = readFileSync(
    new URL("../src/pwa/pwa.js", import.meta.url),
    "utf8",
  );
  const statuses = [...source.matchAll(/"([^"\n]{55,})"/g)].map(
    (match) => match[1],
  );
  assert.ok(statuses.length > 15);
  for (const status of statuses)
    assert.ok(Object.hasOwn(messages, status), status);
});

test("unrecognized browser diagnostics use Spanish guidance, not invented translated details", () => {
  const error = new SyntaxError("Unexpected token xyz");
  assert.equal(translateError(error, "en"), error.message);
  assert.equal(
    translateError(error, "es-MX"),
    "Ocurrió un error. Intenta de nuevo.",
  );
  assert.equal(
    translateError("Could not open this show: Unexpected token xyz", "es-MX"),
    "No se pudo abrir este espectáculo: Ocurrió un error. Intenta de nuevo.",
  );
});
