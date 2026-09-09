const IOS_INSTRUCTIONS =
  "On iPhone or iPad, open AFTERLIGHT in Safari, tap Share, then Add to Home Screen. If it is hidden, choose More in the Share menu.";

/**
 * No visible DOM. Call once from the entrypoint, then render snapshots in your own UI.
 * install() resolves to accepted/dismissed/ios/unavailable; applyUpdate() resolves to
 * whether activation was accepted (the consenting page then reloads exactly once).
 */
export function setupPWA({ onStatus = () => {} } = {}) {
  const browser =
    typeof window !== "undefined" && typeof navigator !== "undefined";
  const production = import.meta.env?.PROD === true;
  const media = browser
    ? window.matchMedia("(display-mode: standalone)")
    : null;
  const ios =
    browser &&
    (/iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const state = {
    supported: Boolean(
      browser &&
      production &&
      window.isSecureContext &&
      "serviceWorker" in navigator,
    ),
    offlineReady: false,
    installable: false,
    installed: Boolean(
      browser && (media.matches || navigator.standalone === true),
    ),
    updateAvailable: false,
    online: browser ? navigator.onLine : true,
    message: "",
    ios: Boolean(ios),
  };
  let disposed = false;
  let registration;
  let promptEvent;
  let installInstructions = "";
  let installingPrompt = false;
  let consentedWorker;
  let reloadIssued = false;
  let applying;
  let refreshSequence = 0;
  let lastUpdateCheck = 0;
  let expectedScope;
  let workerURL;
  let claiming = false;
  const cleanups = [];
  const pending = new Set();
  const watchedWorkers = new WeakSet();

  const getState = () => Object.freeze({ ...state });
  function emit(patch = {}) {
    if (disposed) return;
    if (
      patch.message &&
      installInstructions &&
      !patch.message.includes(installInstructions)
    )
      patch = { ...patch, message: `${patch.message} ${installInstructions}` };
    Object.assign(state, patch);
    try {
      onStatus(getState());
    } catch (error) {
      console.warn("AFTERLIGHT PWA status callback failed.", error);
    }
  }
  function statusMessage() {
    if (state.updateAvailable)
      return "An update is ready. Apply it when your show is finished; this tab will reload.";
    if (state.offlineReady)
      return state.online
        ? "Offline copy ready. You can launch AFTERLIGHT without a connection."
        : "Offline. Your saved AFTERLIGHT copy is ready.";
    return state.online
      ? "Preparing the offline copy. Keep this page online until it is ready."
      : "Offline copy is not ready. Reconnect to finish downloading.";
  }
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  }
  function ask(worker, data, timeout = 6000) {
    return new Promise((resolve) => {
      if (disposed || !worker) {
        resolve(null);
        return;
      }
      const channel = new MessageChannel();
      let timer;
      const finish = (value) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        pending.delete(cancel);
        resolve(value);
      };
      const cancel = () => finish(null);
      pending.add(cancel);
      channel.port1.onmessage = (event) => finish(event.data);
      channel.port1.onmessageerror = cancel;
      timer = setTimeout(cancel, timeout);
      try {
        worker.postMessage(data, [channel.port2]);
      } catch {
        cancel();
      }
    });
  }
  function checkWaiting() {
    const updateAvailable = Boolean(
      registration?.waiting && navigator.serviceWorker.controller,
    );
    emit({ updateAvailable });
    emit({ message: statusMessage() });
  }
  async function refresh() {
    const sequence = ++refreshSequence;
    const controller = navigator.serviceWorker.controller;
    if (
      !controller ||
      controller.scriptURL !== workerURL?.href ||
      controller.state !== "activated"
    ) {
      emit({ offlineReady: false });
      emit({ message: statusMessage() });
      // A navigation started during activation can miss clients.claim(). Claim the
      // now-loaded document without reloading it or activating a waiting update.
      const active = registration?.active;
      if (
        !claiming &&
        active?.state === "activated" &&
        active.scriptURL === workerURL?.href
      ) {
        claiming = true;
        try {
          await ask(active, { type: "AFTERLIGHT_CLAIM" });
        } finally {
          claiming = false;
        }
        if (
          !disposed &&
          navigator.serviceWorker.controller?.state === "activated"
        )
          void refresh();
      }
      return;
    }
    const answer = await ask(controller, { type: "AFTERLIGHT_STATUS" });
    if (
      disposed ||
      sequence !== refreshSequence ||
      controller !== navigator.serviceWorker.controller
    )
      return;
    const offlineReady = Boolean(
      answer?.type === "AFTERLIGHT_STATUS" &&
      answer.ready === true &&
      answer.scope === expectedScope?.href &&
      typeof answer.release === "string" &&
      answer.assets > 0,
    );
    emit({ offlineReady });
    checkWaiting();
  }
  function watchWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    let completed = ["installed", "activating", "activated"].includes(
      worker.state,
    );
    const changed = () => {
      if (worker.state === "installed" || worker.state === "activated") {
        completed = true;
        checkWaiting();
        void refresh();
      }
      if (worker.state === "redundant" && !completed) {
        checkWaiting();
        emit({
          message: state.offlineReady
            ? "Update could not be prepared. Your existing offline copy is still available."
            : "Offline copy could not be prepared. Keep the app online and retry when storage and the connection are available.",
        });
      }
    };
    listen(worker, "statechange", changed);
    changed();
  }
  async function checkForUpdate() {
    if (
      !registration ||
      !navigator.onLine ||
      Date.now() - lastUpdateCheck < 60000
    )
      return;
    lastUpdateCheck = Date.now();
    try {
      await registration.update();
    } catch {
      /* Existing offline copy remains usable. */
    }
  }
  function controllerChanged() {
    // controllerchange/ready can arrive while activation is still running.
    // Observe its final state even when registration.installing is already null.
    watchWorker(navigator.serviceWorker.controller);
    emit({ offlineReady: false });
    checkWaiting();
    void refresh();
    // No global reload. A peer can adopt the worker and keep playing its current show.
    if (
      !disposed &&
      consentedWorker &&
      navigator.serviceWorker.controller === consentedWorker &&
      !reloadIssued
    ) {
      reloadIssued = true;
      window.location.reload();
    }
  }
  async function install() {
    if (disposed || state.installed || installingPrompt) return "unavailable";
    if (!promptEvent) {
      installInstructions = ios
        ? IOS_INSTRUCTIONS
        : "Use your browser’s Install app or Add to Home Screen menu when available. Installation requires a supported browser and a secure connection.";
      emit({ message: installInstructions });
      return ios ? "ios" : "unavailable";
    }
    installInstructions = "";
    const event = promptEvent;
    promptEvent = null;
    installingPrompt = true;
    emit({ installable: false });
    try {
      // Invoke the browser prompt before the first await to preserve the user's gesture.
      const result = await event.prompt();
      const choice = await (event.userChoice || result);
      const outcome = choice?.outcome === "accepted" ? "accepted" : "dismissed";
      emit({
        message:
          outcome === "accepted"
            ? "Installation accepted. Follow your browser’s installation steps."
            : "Installation dismissed. You can keep using AFTERLIGHT in this tab.",
      });
      return outcome;
    } catch {
      emit({
        message:
          "The install prompt is unavailable. Use your browser’s installation menu instead.",
      });
      return "unavailable";
    } finally {
      installingPrompt = false;
    }
  }
  function applyUpdate() {
    if (disposed) return Promise.resolve(false);
    if (applying) return applying;
    const waiting = registration?.waiting;
    if (!waiting) return Promise.resolve(false);
    consentedWorker = waiting;
    emit({
      message:
        "Applying the downloaded update. This tab will reload; other tabs will keep their shows.",
    });
    applying = (async () => {
      const answer = await ask(
        waiting,
        { type: "AFTERLIGHT_ACTIVATE", consent: true },
        15000,
      );
      if (answer?.accepted !== true && !reloadIssued) {
        consentedWorker = null;
        emit({
          message:
            "The update could not be activated. Your current show has not been reloaded.",
        });
        return false;
      }
      return true;
    })().finally(() => {
      applying = null;
    });
    return applying;
  }
  function dispose() {
    disposed = true;
    refreshSequence++;
    for (const cleanup of cleanups) cleanup();
    for (const cancel of [...pending]) cancel();
    promptEvent = null;
    consentedWorker = null;
  }
  const api = { install, applyUpdate, getState, dispose };
  if (!state.supported) {
    emit({
      message: !production
        ? "Offline installation is available in the production build, not the development server."
        : "Offline installation is unavailable here. Use a supported browser over HTTPS; AFTERLIGHT can still run online.",
    });
    return api;
  }

  try {
    expectedScope = new URL(import.meta.env.BASE_URL || "./", document.baseURI);
    if (
      expectedScope.origin !== location.origin ||
      !/^https?:$/.test(expectedScope.protocol) ||
      !expectedScope.pathname.endsWith("/")
    )
      throw new Error("Invalid relative application scope");
    workerURL = new URL("sw.js", expectedScope);
  } catch {
    emit({
      supported: false,
      message:
        "Offline installation requires a same-origin application base URL ending with a slash.",
    });
    return api;
  }
  listen(window, "beforeinstallprompt", (event) => {
    if (state.installed || typeof event.prompt !== "function") return;
    event.preventDefault();
    promptEvent = event;
    emit({ installable: true });
  });
  listen(window, "appinstalled", () => {
    promptEvent = null;
    installInstructions = "";
    emit({
      installed: true,
      installable: false,
      message:
        "AFTERLIGHT is installed. Offline availability is shown separately.",
    });
  });
  listen(media, "change", () =>
    emit({
      installed: media.matches || navigator.standalone === true,
      installable: !media.matches && Boolean(promptEvent),
    }),
  );
  listen(navigator.serviceWorker, "controllerchange", controllerChanged);
  const connectionChanged = () => {
    emit({ online: navigator.onLine });
    emit({ message: statusMessage() });
    void refresh();
    if (navigator.onLine) void checkForUpdate();
  };
  listen(window, "online", connectionChanged);
  listen(window, "offline", connectionChanged);
  listen(document, "visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refresh();
      void checkForUpdate();
    }
  });
  emit({ message: statusMessage() });
  Promise.resolve()
    .then(() =>
      navigator.serviceWorker.register(workerURL.href, {
        scope: expectedScope.href,
        type: "classic",
        updateViaCache: "none",
      }),
    )
    .then((value) => {
      if (disposed) return;
      registration = value;
      listen(registration, "updatefound", () =>
        watchWorker(registration.installing),
      );
      watchWorker(registration.installing);
      watchWorker(registration.active);
      checkWaiting();
      void refresh();
      navigator.serviceWorker.ready
        .then((activeRegistration) => {
          if (!disposed && activeRegistration.scope === expectedScope.href) {
            watchWorker(activeRegistration.active);
            checkWaiting();
            void refresh();
          }
        })
        .catch(() => {});
    })
    .catch(() => {
      if (disposed) return;
      emit({
        message:
          "Offline storage or registration is unavailable. Online browsing still works; check browser privacy/storage settings and reconnect to retry.",
      });
      if (navigator.serviceWorker.controller) void refresh();
    });
  return api;
}
