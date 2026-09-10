import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const copy =
  "created by Promethean Dynamic | “A sky without a little mystery of the universe, is just being alone in the dark.” | powered by TrustEdge.gt";

async function ready(page) {
  await page.goto("./?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(async () => {
    window.__afterlight.setTestClock(true);
    window.__afterlight.clear();
    await document.fonts.ready;
  });
}

test("bottom credit line preserves the supplied text and opens the exact host link safely", async ({
  page,
  context,
}) => {
  await ready(page);
  const footer = page.locator(".site-credit");
  await expect(footer).toBeVisible();
  expect(
    await footer.evaluate((n) => n.textContent.replace(/\s+/g, " ").trim()),
  ).toBe(copy);
  const link = footer.getByRole("link", { name: "TrustEdge.gt", exact: true });
  await expect(link).toHaveAttribute("href", "https://trustedge.gt/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  // Keep this regression local: intercept the external navigation rather than
  // requesting the live hosting service from every test run.
  await context.route("https://trustedge.gt/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Host-link test fixture</title>",
    }),
  );
  await link.focus();
  await expect(link).toBeFocused();
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toBe("https://trustedge.gt/");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
  expect(page.url()).toContain("?test=1");
});

test("credits scale to one line below the controls at desktop, wide-phone and mobile sizes", async ({
  page,
}) => {
  await ready(page);
  const measurements = [];
  const dir = "evidence/footer";
  await mkdir(dir, { recursive: true });
  for (const [width, height] of [
    [1440, 1000],
    [1280, 900],
    [1024, 768],
    [700, 844],
    [390, 844],
    [320, 640],
    [320, 568],
    [844, 390],
    [700, 375],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".site-credit")).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          Math.abs(
            parseFloat(
              document
                .getElementById("app")
                .style.getPropertyValue("--deck-height"),
            ) - document.querySelector(".deck").getBoundingClientRect().height,
          ),
        ),
      )
      .toBeLessThan(1);
    const m = await page.evaluate(() => {
      const footer = document.querySelector(".site-credit");
      const link = footer.querySelector("a");
      const f = footer.getBoundingClientRect();
      const l = link.getBoundingClientRect();
      const controls = document
        .querySelector(".deck-foot")
        .getBoundingClientRect();
      const film = document.getElementById("film").getBoundingClientRect();
      const quote = footer
        .querySelector(".credit-quote")
        .getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        left: f.left,
        right: f.right,
        bottom: f.bottom,
        top: f.top,
        controlsBottom: controls.bottom,
        scrollWidth: document.documentElement.scrollWidth,
        footerScroll: footer.scrollWidth,
        footerClient: footer.clientWidth,
        clickable:
          document
            .elementFromPoint(l.x + l.width / 2, l.y + l.height / 2)
            ?.closest("a") === link,
        linkHeight: l.height,
        filmWidth: film.width,
        filmHeight: film.height,
        quoteHeight: quote.height,
        footerHeight: f.height,
        quoteLines: footer.querySelector(".credit-quote").getClientRects()
          .length,
        textSize: parseFloat(
          getComputedStyle(footer.querySelector(".credit-quote")).fontSize,
        ),
      };
    });
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(width);
    expect(m.bottom).toBeLessThanOrEqual(height);
    expect(m.top).toBeGreaterThanOrEqual(m.controlsBottom);
    expect(m.scrollWidth).toBeLessThanOrEqual(width);
    expect(m.footerScroll).toBeLessThanOrEqual(m.footerClient);
    expect(m.clickable).toBe(true);
    expect(m.linkHeight).toBeGreaterThanOrEqual(24);
    expect(m.filmHeight).toBeGreaterThan(100);
    expect(m.filmWidth / m.filmHeight).toBeCloseTo(16 / 9, 2);
    expect(m.footerHeight).toBeLessThanOrEqual(30);
    expect(m.quoteLines).toBe(1);
    expect(m.quoteHeight).toBeLessThan(25);
    measurements.push(m);
    await page.screenshot({ path: `${dir}/${width}x${height}.png` });
  }
  await writeFile(`${dir}/layout.json`, JSON.stringify(measurements, null, 2));
});

test("the credit line and destination remain available without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ javaScriptEnabled: false, baseURL });
  try {
    await page.goto("./");
    const footer = page.locator(".site-credit");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "TrustEdge.gt", exact: true }),
    ).toHaveAttribute("href", "https://trustedge.gt/");
  } finally {
    await page.close();
  }
});
