// Native module: generated text/attribute pairs, no HTML parsing or DOM replacement.
import { getLanguage, setLanguage } from "./language.js";
const switcher = document.querySelector("[data-language-switch]");
export function renderLanguage(language = getLanguage()) {
  const es = language === "es-MX";
  document.documentElement.lang = es ? "es-MX" : "en";
  for (const element of document.querySelectorAll("[data-en][data-es-mx]")) {
    const value = element.getAttribute(es ? "data-es-mx" : "data-en");
    const attribute = element.getAttribute("data-language-attribute");
    if (attribute) element.setAttribute(attribute, value);
    else element.textContent = value;
  }
  if (switcher) switcher.value = es ? "es-MX" : "en";
}
switcher?.addEventListener("change", () => {
  setLanguage(switcher.value);
  renderLanguage();
});
window.addEventListener("afterlight:language", () => renderLanguage());
window.addEventListener("pageshow", () => renderLanguage());
renderLanguage();
