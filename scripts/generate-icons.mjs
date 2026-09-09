import { chromium } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
const root = process.cwd(),
  assets = path.join(root, "public/assets");
await mkdir(assets, { recursive: true });
const rays = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2,
    r1 = i % 3 === 0 ? 60 : 76,
    r2 = i % 3 === 0 ? 162 : 139;
  const x = (r) => 256 + Math.cos(angle) * r,
    y = (r) => 249 + Math.sin(angle) * r;
  return `<path d="M${x(r1)} ${y(r1)}L${x(r2)} ${y(r2)}" stroke="${i % 6 === 0 ? "#30B0D0" : "#EDE8E4"}" stroke-width="${i % 3 === 0 ? 5 : 3}"/><circle cx="${x(r2 + 15)}" cy="${y(r2 + 15)}" r="${i % 3 === 0 ? 5 : 3}" fill="#EDE8E4"/>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#050A0F"/><g stroke-linecap="round">${rays}</g><path d="M256 219L266 239L286 249L266 259L256 279L246 259L226 249L246 239Z" fill="#EDE8E4"/></svg>`;
await writeFile(path.join(assets, "icon.svg"), svg);
const edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH || (existsSync(edge) ? edge : undefined),
});
try {
  const page = await browser.newPage();
  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512],
    ["apple-touch-icon.png", 180],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0">${svg.replace("viewBox=", 'width="100%" height="100%" viewBox=')}</body></html>`,
    );
    await page.screenshot({ path: path.join(assets, name) });
  }
} finally {
  await browser.close();
}
for (const [source, target] of [
  ["LICENSE", "MIT.txt"],
  ["node_modules/three/LICENSE", "Three-MIT.txt"],
  ["node_modules/@phosphor-icons/core/LICENSE", "Phosphor-MIT.txt"],
]) {
  await mkdir(path.join(root, "public/licenses"), { recursive: true });
  await copyFile(
    path.join(root, source),
    path.join(root, "public/licenses", target),
  );
}
console.log(
  "Generated SVG, 192/512px icons, maskable icon and Apple touch icon; preserved runtime licence notices.",
);
