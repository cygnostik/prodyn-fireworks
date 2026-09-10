const KEY = "afterlight:language:v1";
let sessionLanguage;

export function detectLanguage(languages = []) {
  for (const language of languages) {
    if (typeof language !== "string") continue;
    if (/^es(?:-|$)/i.test(language)) return "es-MX";
    if (/^en(?:-|$)/i.test(language)) return "en";
  }
  return "en";
}

export function getLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (saved === "en" || saved === "es-MX") return saved;
  } catch {
    // Private browsing can deny storage without preventing translation.
  }
  if (sessionLanguage) return sessionLanguage;
  const nav = globalThis.navigator;
  return detectLanguage(
    nav?.languages?.length ? nav.languages : [nav?.language],
  );
}

export function setLanguage(language) {
  if (language !== "en" && language !== "es-MX") {
    throw new RangeError("Unsupported language");
  }
  sessionLanguage = language;
  try {
    globalThis.localStorage?.setItem(KEY, language);
  } catch {
    // The current document still switches when persistence is unavailable.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("afterlight:language", { detail: language }),
    );
  }
  return language;
}
