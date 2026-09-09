import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:4187/";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync(
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    )
      ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      : undefined),
});
await mkdir("public/assets", { recursive: true });
await mkdir("evidence", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1180 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}?test=1`);
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => {
    const a = window.__afterlight;
    a.setTestClock(true);
    a.clear();
    a.fire({
      effectId: "willow",
      palette: "gold",
      position: -0.43,
      seed: 172,
      scale: 1.2,
    });
    a.fire({
      effectId: "nishiki",
      palette: "gold",
      position: 0.43,
      seed: 92,
      scale: 1.13,
    });
    a.step(1.25);
    a.fire({
      effectId: "pistil",
      palette: "azure",
      position: -0.02,
      seed: 391,
      scale: 0.85,
    });
    a.step(5.55);
  });
  const canvasImage = await page.evaluate(() =>
    document.getElementById("sky").toDataURL("image/jpeg", 0.95),
  );
  await writeFile(
    "public/assets/poster.jpg",
    Buffer.from(canvasImage.split(",")[1], "base64"),
  );
  const stats = await page.evaluate(() => window.__afterlight.stats());
  await writeFile("evidence/media-render.json", JSON.stringify(stats, null, 2));
  const image = (await readFile("public/assets/poster.jpg")).toString("base64");
  const display = (
    await readFile("public/assets/fonts/Oxanium-wght.woff2")
  ).toString("base64");
  const mono = (
    await readFile("public/assets/fonts/DepartureMono-Regular.woff2")
  ).toString("base64");
  const cover = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await cover.setContent(
    `<html><head><style>@font-face{font-family:Oxanium;src:url(data:font/woff2;base64,${display});font-weight:200 800}@font-face{font-family:Departure;src:url(data:font/woff2;base64,${mono})}*{box-sizing:border-box}body{margin:0;background:#050A0F;color:#EDE8E4;height:630px;overflow:hidden}img{position:absolute;width:1200px;height:630px;object-fit:cover;object-position:center}section{position:absolute;inset:0;background:linear-gradient(0deg,rgba(2,7,11,.94),transparent 62%);padding:46px 58px;display:flex;flex-direction:column;justify-content:flex-end}h1{font:350 94px/1 Oxanium;letter-spacing:.07em;margin:0}h1 span{font-weight:650}p{font:15px Departure;letter-spacing:.22em;margin:18px 0 0;color:#30B0D0}.mark{position:absolute;left:58px;top:36px;font:12px Departure;letter-spacing:.16em;color:#EDE8E4}</style></head><body><img alt="" src="data:image/jpeg;base64,${image}"><section><span class="mark">AN OPEN-SOURCE FIREWORKS INSTRUMENT</span><h1><span>AFTER</span>LIGHT</h1><p>PAINT THE NIGHT.</p></section></body></html>`,
  );
  await cover.evaluate(() => document.fonts.ready);
  await cover.screenshot({
    path: "public/assets/social.jpg",
    type: "jpeg",
    quality: 95,
  });
  await cover.close();
  for (const [name, viewport] of [
    ["wide", { width: 1280, height: 720 }],
    ["narrow", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `public/assets/screenshot-${name}.png` });
  }
  console.log(
    "Rendered poster, 1200×630 social card and real wide/narrow PWA screenshots from the running 3D engine.",
  );
} finally {
  await browser.close();
}
