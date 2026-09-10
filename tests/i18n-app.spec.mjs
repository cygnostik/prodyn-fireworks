import { test, expect } from "@playwright/test";
import { EFFECTS, GROUPS } from "../src/data/catalog.js";
import { translate } from "../src/i18n.js";

test.use({ locale: "es-MX" });
async function ready(page) {
  await page.goto("/?test=1");
  await page.waitForFunction(() => window.__afterlight?.ready);
  await page.evaluate(() => window.__afterlight.setTestClock(true));
}
async function language(page, locale) {
  if (!(await page.locator("#settings").evaluate((node) => node.open)))
    await page.locator("#settings-open").click();
  await page.locator("#language").selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function closeSettings(page) {
  await page.locator("#settings [data-close-dialog]").click();
}

test("Spanish autodetection, accessible remembered switch, and untouched approved quote", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  await expect(page.locator("#selected-name")).toHaveText("Crisantemo");
  await expect(page.locator(".portrait-note")).toHaveCount(0);
  const quote = await page.locator(".site-credit").innerText();
  expect(quote).toContain(
    "“A sky without a little mystery of the universe, is just being alone in the dark.”",
  );
  await language(page, "en");
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toHaveValue("en");
  await expect(page.locator("#settings-title")).toHaveText(
    "Make yourself at home.",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("afterlight:language:v1")),
  ).toBe("en");
  await page.reload();
  await page.waitForFunction(() => window.__afterlight?.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#selected-name")).toHaveText("Chrysanthemum");
  await language(page, "es-MX");
  await expect(
    page.getByRole("combobox", { name: "Idioma", exact: true }),
  ).toHaveValue("es-MX");
  expect(await page.locator(".site-credit").innerText()).toBe(quote);
});

test("all forty pads, tooltips, descriptions, bank names and colors translate", async ({
  page,
}) => {
  await ready(page);
  let count = 0;
  for (const group of GROUPS) {
    const bank = page.locator(`[data-bank="${group.id}"]`);
    await expect(bank).toHaveAttribute(
      "title",
      translate(group.name, {}, "es-MX"),
    );
    await bank.click();
    for (const effect of EFFECTS.filter(
      (effect) => effect.group === group.id,
    )) {
      const name = translate(effect.name, {}, "es-MX");
      await expect(
        page.locator(`[data-fire="${effect.id}"]`),
      ).toHaveAccessibleName(`Lanzar ${name}`);
      await expect(page.locator(`[data-add="${effect.id}"]`)).toHaveAttribute(
        "title",
        `Agregar ${name} al gran final`,
      );
      await page.evaluate((id) => window.__afterlight.select(id), effect.id);
      await expect(page.locator("#selected-description")).toHaveText(
        translate(effect.description, {}, "es-MX"),
      );
      count++;
    }
  }
  expect(count).toBe(40);
  await page.locator('[data-palette="gold"]').click();
  await expect(page.locator("#palette-name")).toHaveText("Dorado");
  await expect(page.locator('[data-palette="gold"]')).toHaveAccessibleName(
    "Color Dorado",
  );
});

test("live language change preserves authored content, finale clock, effects and sound", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    window.__afterlight.addLayer("willow");
    window.__afterlight.addLayer("crackle");
  });
  await page.locator("#finale-open").click();
  await page
    .locator("#show-title")
    .fill("<img src=x onerror=alert(1)> Mi noche");
  await page.locator("#finale-fire").click();
  await page.evaluate(() => window.__afterlight.step(2));
  const before = await page.evaluate(() => window.__afterlight.state);
  await language(page, "en");
  const after = await page.evaluate(() => window.__afterlight.state);
  expect(after.show).toEqual(before.show);
  expect(after.player).toEqual(before.player);
  expect(after.sound).toBe(before.sound);
  expect(after.launches).toBe(before.launches);
  expect(after.selected).toBe(before.selected);
  expect(after.palette).toBe(before.palette);
  await expect(page.locator("#finale-fire-label")).toHaveText("STOP FINALE");
  await expect(page.locator("#toast")).toContainText(
    "<img src=x onerror=alert(1)> Mi noche",
  );
  await expect(page.locator("#toast img")).toHaveCount(0);
  await closeSettings(page);
  await page.locator("#finale-open").click();
  await expect(
    page.locator('[data-action="density"]').first(),
  ).toHaveAccessibleName("Willow density 1. Change density");
  await language(page, "es-MX");
  await expect(
    page.locator('[data-action="density"]').first(),
  ).toHaveAccessibleName("Sauce, densidad 1. Cambiar densidad");
});

test("visible toast, install guidance, validation and destructive confirmations follow language", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__afterlight.addLayer("willow"));
  await expect(page.locator("#toast")).toHaveText(
    "Se agregó Sauce al gran final.",
  );
  await language(page, "en");
  await expect(page.locator("#toast")).toHaveText(
    "Willow added to the finale.",
  );
  await page.locator("#install-app").click();
  await expect(page.locator("#pwa-status")).toContainText("Install app");
  await language(page, "es-MX");
  await expect(page.locator("#pwa-status")).toContainText("Instalar app");
  await page.locator("#import-file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        title: "Test",
        duration: 22,
        layers: [
          { id: "test", effectId: "willow", palette: "bad", density: 1 },
        ],
      }),
    ),
  });
  await expect(page.locator("#toast")).toHaveText(
    "Color desconocido en la capa 1.",
  );
  await language(page, "en");
  await expect(page.locator("#toast")).toHaveText("Unknown colour in layer 1.");
  await language(page, "es-MX");
  await closeSettings(page);
  await page.locator("#finale-open").click();
  let confirmation;
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.locator("#clear-finale").click();
  expect(confirmation).toBe("¿Borrar todas las capas de este gran final?");
  expect(
    await page.evaluate(() => window.__afterlight.state.show.layers.length),
  ).toBe(1);
});

test("Spanish settings and composer remain usable on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await language(page, "es-MX");
  await expect(page.locator("#language")).toBeVisible();
  await expect(page.locator("#settings-title")).toHaveText("Ponte a gusto.");
  await expect(page.locator('#quality option[value="low"]')).toHaveText(
    "Ahorro de batería",
  );
  await closeSettings(page);
  await page.locator('[data-add="chrysanthemum"]').click();
  await page.locator("#finale-open").click();
  await expect(page.locator("#finale-heading")).toHaveText("Tu gran final.");
  await expect(page.locator("#layer-list h3")).toHaveText("Crisantemo");
});
