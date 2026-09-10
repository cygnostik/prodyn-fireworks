import { EFFECTS } from "./data/catalog.js";
import { messages as copy, effectTranslations } from "./i18n-data.js";
export { effectTranslations };
export const messages = { ...copy };
for (const effect of EFFECTS) {
  const [name, description] = effectTranslations[effect.id];
  messages[effect.name] = name;
  messages[effect.description] = description;
}
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
const interpolate = (text, values) =>
  text.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole,
  );
/** Pure translator. Unknown browser diagnostics stay intact in English, but receive safe Spanish guidance. */
export function translate(source, values = {}, locale = "en") {
  source = String(source ?? "");
  if (locale !== "es-MX") return interpolate(source, values);
  if (Object.hasOwn(messages, source))
    return interpolate(messages[source], values);
  for (const key of [
    "A finale can hold {count} layers.",
    "Unknown firework in layer {count}.",
    "Unknown colour in layer {count}.",
    "Invalid density in layer {count}.",
  ]) {
    const pattern = key
      .split("{count}")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(\\d+)");
    const match = source.match(new RegExp(`^${pattern}$`));
    if (match) return interpolate(messages[key], { count: match[1] });
  }
  const prefix = "Could not open this show: ";
  if (source.startsWith(prefix))
    return translate(
      "Could not open this show: {error}",
      { error: translate(source.slice(prefix.length), {}, locale) },
      locale,
    );
  // PWA composes a status plus retained install instructions; translate each exact segment.
  for (const key of Object.keys(messages)
    .filter((key) => key.length > 20)
    .sort((a, b) => b.length - a.length)) {
    if (source.startsWith(key + " "))
      return (
        messages[key] +
        " " +
        translate(source.slice(key.length + 1), {}, locale)
      );
  }
  return interpolate(source, values);
}
export function translateError(
  error,
  locale = "en",
  fallback = "Something went wrong. Please try again.",
) {
  const source = error?.message ?? String(error);
  const prefix = "Could not open this show: ";
  if (source.startsWith(prefix))
    return translate(
      "Could not open this show: {error}",
      { error: translateError(source.slice(prefix.length), locale, fallback) },
      locale,
    );
  const result = translate(source, {}, locale);
  return locale === "es-MX" &&
    result === source &&
    !Object.hasOwn(messages, source)
    ? translate(fallback, {}, locale)
    : result;
}
/** Bind only original static text/attributes, never input values, icons or authored credit text.
 * Text nodes preserve inline kbd/strong markup; all output uses textContent/nodeValue.
 */
export function bindStaticCopy(root = document) {
  const bindings = [];
  const walker = root.createTreeWalker(root.documentElement, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      node.parentElement.closest(
        "script,style,noscript,.site-credit,#language option",
      )
    )
      continue;
    const source = node.nodeValue.trim().replace(/\s+/g, " ");
    if (Object.hasOwn(messages, source)) {
      const leading = node.nodeValue.match(/^\s*/)[0],
        trailing = node.nodeValue.match(/\s*$/)[0];
      bindings.push((locale) => {
        node.nodeValue = leading + translate(source, {}, locale) + trailing;
      });
    }
  }
  for (const node of root.querySelectorAll(
    "[aria-label],[title],[alt],meta[content]",
  )) {
    for (const attr of ["aria-label", "title", "alt", "content"]) {
      const source = node.getAttribute(attr);
      if (source && Object.hasOwn(messages, source))
        bindings.push((locale) =>
          node.setAttribute(attr, translate(source, {}, locale)),
        );
    }
  }
  return (locale) => {
    root.documentElement.lang = locale;
    for (const render of bindings) render(locale);
  };
}
