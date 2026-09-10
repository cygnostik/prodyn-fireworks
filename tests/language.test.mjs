import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { detectLanguage } from "../public/language.js";

test("language detection honors supported preference order and Spanish regions", () => {
  for (const region of ["es", "es-MX", "es-GT", "es-419", "es-ES"])
    assert.equal(detectLanguage([region]), "es-MX");
  assert.equal(detectLanguage(["fr", "es-GT", "en-US"]), "es-MX");
  assert.equal(detectLanguage(["en-GB", "es-MX"]), "en");
  assert.equal(detectLanguage(["fr", "de"]), "en");
  assert.equal(detectLanguage([null, "esperanto"]), "en");
});

test("denied storage still permits a same-document language choice", async () => {
  const source = await readFile(
    new URL("../public/language.js", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({
    navigator: { languages: ["es-GT"] },
    localStorage: {
      getItem() {
        throw new Error("Denied");
      },
      setItem() {
        throw new Error("Denied");
      },
    },
  });
  vm.runInContext(source.replaceAll("export function", "function"), context);
  assert.equal(context.getLanguage(), "es-MX");
  context.setLanguage("en");
  assert.equal(context.getLanguage(), "en");
  assert.throws(() => context.setLanguage("fr"), /Unsupported language/);
});
