import { test, expect } from "@playwright/test";

// Trace snapshots themselves can grant activation via Playwright evaluation.
// Keep the page genuinely unactivated until the trusted input under test.
test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
  trace: "off",
});

const cases = [
  { pointerType: "touch", preference: "on", target: "fire" },
  { pointerType: "pen", preference: "on", target: "fire" },
  { pointerType: "touch", preference: "off", target: "fire" },
  { pointerType: "pen", preference: "off", target: "fire" },
  { pointerType: "touch", preference: "on", target: "sound" },
];

for (const { pointerType, preference, target } of cases) {
  test(`first ${pointerType} ${target} interaction respects saved sound ${preference}`, async ({
    page,
  }) => {
    await page.addInitScript((saved) => {
      localStorage.setItem("afterlight:sound:v1", saved);
      window.soundGestureEvidence = [];
      for (const type of ["pointerdown", "pointerup"]) {
        document.addEventListener(
          type,
          (event) => {
            window.soundGestureEvidence.push({
              type,
              pointerType: event.pointerType,
              trusted: event.isTrusted,
              activation: navigator.userActivation.isActive,
              contextState: window.__afterlight?.stats().audio.contextState,
            });
          },
          { capture: true },
        );
      }
    }, preference);
    await page.goto("./?test=1");
    const session = await page.context().newCDPSession(page);
    const selector =
      target === "sound" ? "#sound-toggle" : '[data-fire="chrysanthemum"]';
    // CDP explicitly declines userGesture here. A normal page.evaluate can grant
    // activation and conceal the first-contact browser-policy defect.
    const prepared = await session.send("Runtime.evaluate", {
      expression: `new Promise((resolve, reject) => {
        const started = performance.now();
        function check() {
          if (window.__afterlight?.ready) {
            window.__afterlight.setTestClock(true);
            window.__afterlight.clear();
            const button = document.querySelector(${JSON.stringify(selector)});
            button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const rect = button.getBoundingClientRect();
            const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
            resolve({ x, y, hit: button.contains(document.elementFromPoint(x, y)),
              activation: navigator.userActivation.isActive,
              contextState: window.__afterlight.stats().audio.contextState });
            return;
          }
          if (performance.now() - started > 10000) return reject(new Error('Renderer not ready'));
          setTimeout(check, 20);
        }
        check();
      })`,
      userGesture: false,
      awaitPromise: true,
      returnByValue: true,
    });
    expect(prepared.exceptionDetails).toBeUndefined();
    const { x, y, hit, activation, contextState } = prepared.result.value;
    expect(hit).toBe(true);
    expect(activation).toBe(false);
    expect(contextState).toBe("uninitialized");
    if (pointerType === "touch") {
      await page.touchscreen.tap(x, y);
    } else {
      await session.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        pointerType: "pen",
        x,
        y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      await session.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        pointerType: "pen",
        x,
        y,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
    }
    const expectedOn = preference === "on" || target === "sound";
    await expect(page.locator("#sound-toggle")).toHaveAttribute(
      "aria-pressed",
      String(expectedOn),
    );
    const observed = await session.send("Runtime.evaluate", {
      expression:
        "({ events: window.soundGestureEvidence, audio: window.__afterlight.stats().audio })",
      userGesture: false,
      returnByValue: true,
    });
    const { events, audio } = observed.result.value;
    expect(events.map((event) => event.type)).toEqual([
      "pointerdown",
      "pointerup",
    ]);
    expect(
      events.every(
        (event) => event.pointerType === pointerType && event.trusted,
      ),
    ).toBe(true);
    // Chromium's CDP pen injection uses its mouse protocol and grants
    // activation at press. Touch exercises the native late-activation path;
    // the Node pen regression covers that same specified activation boundary.
    if (pointerType === "touch") expect(events[0].activation).toBe(false);
    expect(events[1].activation).toBe(true);
    expect(events[0].contextState).toBe("uninitialized");
    expect(events[1].contextState).toBe("uninitialized");
    expect(audio.contextState).toBe(expectedOn ? "running" : "uninitialized");
    expect(audio.lastError).toBeNull();
    await test.info().attach("trusted-gesture-observations", {
      body: JSON.stringify(
        { pointerType, preference, target, events, audio },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await session.detach();
  });
}
