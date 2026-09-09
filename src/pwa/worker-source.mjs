/** Serialized into dist/sw.js by the post-build step. No bundler/runtime dependencies. */
function serviceWorkerMain(config) {
  "use strict";
  const scope = new URL(self.registration.scope);
  const prefix = `afterlight:pwa:${encodeURIComponent(scope.href)}:release:`;
  const cacheName = `${prefix}${config.release}`;
  const markerURL = new URL("__afterlight_internal__/ready", scope).href;
  const lifecycleURL = new URL("__afterlight_internal__/clients", scope).href;
  const pinsURL = new URL("__afterlight_internal__/release-pins", scope).href;
  let pinWrites = Promise.resolve();
  const entries = config.entries.map((entry) => ({
    ...entry,
    href: new URL(entry.url, scope).href,
  }));
  const byURL = new Map(entries.map((entry) => [entry.href, entry]));
  const indexURL = new URL("index.html", scope).href;
  const sameScope = (url) =>
    url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  const json = (value) =>
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
    });

  async function complete(cache) {
    const marker = await cache.match(markerURL);
    if (!marker) return false;
    const data = await marker.json();
    if (
      data.release !== config.release ||
      JSON.stringify(data.entries) !== JSON.stringify(config.entries)
    )
      return false;
    // Cache eviction can remove assets after installation: a registration/marker alone is not readiness.
    for (const entry of entries)
      if (!(await cache.match(entry.href))) return false;
    return true;
  }

  async function isReady() {
    try {
      return (
        (await caches.has(cacheName)) &&
        (await complete(await caches.open(cacheName)))
      );
    } catch {
      return false;
    }
  }

  async function install() {
    // Re-registering the exact same release must not destroy a previously complete copy.
    if (await isReady()) return;
    const cache = await caches.open(cacheName);
    const cancellation = new AbortController();
    let cursor = 0;
    let failed;
    async function download() {
      while (!failed && cursor < entries.length) {
        const entry = entries[cursor++];
        const timer = setTimeout(
          () =>
            cancellation.abort(new Error(`Precache timed out: ${entry.url}`)),
          30000,
        );
        try {
          const response = await fetch(entry.href, {
            cache: "reload",
            credentials: "same-origin",
            redirect: "error",
            signal: cancellation.signal,
          });
          if (
            !response.ok ||
            response.status !== 200 ||
            response.type === "opaque" ||
            response.redirected ||
            response.url !== entry.href
          )
            throw new Error(`Invalid precache response: ${entry.url}`);
          const type = (response.headers.get("Content-Type") || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          if (entry.types.length && !entry.types.includes(type))
            throw new Error(`Wrong precache Content-Type: ${entry.url}`);
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength !== entry.bytes)
            throw new Error(
              `Incomplete or mixed-release precache response: ${entry.url}`,
            );
          const beginning = new TextDecoder()
            .decode(bytes.slice(0, 512))
            .trimStart();
          if (
            !entry.types.includes("text/html") &&
            /^<(?:!doctype\s+html|html\b|head\b|body\b)/i.test(beginning)
          )
            throw new Error(
              `HTML fallback substituted for asset: ${entry.url}`,
            );
          const headers = new Headers(response.headers);
          // Fetch exposes decoded bytes: use their verified length, not the transport length.
          headers.delete("Content-Encoding");
          headers.set("Content-Length", String(bytes.byteLength));
          headers.set("Accept-Ranges", "bytes");
          headers.set("X-Afterlight-Release", config.release);
          await cache.put(
            entry.href,
            new Response(bytes, { status: 200, headers }),
          );
        } catch (error) {
          failed ||= error;
          cancellation.abort(error);
        } finally {
          clearTimeout(timer);
        }
      }
    }
    try {
      // Settle all writers before cleanup; an in-flight put cannot recreate a failed release.
      await Promise.all(
        Array.from({ length: Math.min(4, entries.length) }, download),
      );
      if (failed) throw failed;
      await cache.put(
        markerURL,
        json({ release: config.release, entries: config.entries }),
      );
      if (!(await complete(cache)))
        throw new Error("Precache verification failed");
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
    // No skipWaiting here: replacing an open show always requires explicit user consent.
  }

  async function scopeClients() {
    return (
      await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    ).filter((client) => sameScope(new URL(client.url)));
  }

  async function pruneUnusedReleases() {
    if (!(await isReady())) return;
    const current = await caches.open(cacheName);
    const record = await current.match(lifecycleURL);
    // If lifecycle metadata was evicted, retaining old copies is safer than guessing.
    if (!record) return;
    const { protectedClientIds, generation } = await record.json();
    const live = new Set((await scopeClients()).map((client) => client.id));
    if (protectedClientIds.some((id) => live.has(id))) return;
    const retired = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix) || name === cacheName) continue;
      const other = await caches.open(name);
      const lifecycle = await other.match(lifecycleURL);
      // Never delete a concurrently installing/waiting release. Only retire activated predecessors.
      if (!lifecycle) continue;
      const data = await lifecycle.json();
      if (data.generation >= generation) return; // This worker was superseded during the async check.
      retired.push(name);
    }
    for (const name of retired) await caches.delete(name);
  }

  async function activate() {
    if (!(await isReady()))
      throw new Error("Refusing to activate an incomplete offline release");
    const cache = await caches.open(cacheName);
    let generation = 1;
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix)) continue;
      const lifecycle = await (await caches.open(name)).match(lifecycleURL);
      if (lifecycle)
        generation = Math.max(
          generation,
          (await lifecycle.json()).generation + 1,
        );
    }
    // Keep all older release assets while any pre-activation document is still open.
    // The consenting document gets a new client ID on reload; peers do not reload.
    await cache.put(
      lifecycleURL,
      json({
        generation,
        protectedClientIds: (await scopeClients()).map((client) => client.id),
      }),
    );
    await self.clients.claim();
    await pruneUnusedReleases().catch(() => {});
  }

  async function previousAsset(href) {
    for (const name of (await caches.keys()).reverse()) {
      if (!name.startsWith(prefix) || name === cacheName) continue;
      const cache = await caches.open(name);
      if (!(await cache.match(markerURL))) continue; // Never read an incomplete install.
      const response = await cache.match(href);
      if (response) return response;
    }
  }

  async function clientCache(clientId) {
    if (!clientId) return;
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix)) continue;
      const cache = await caches.open(name);
      if (!(await cache.match(markerURL))) continue;
      const pins = await cache.match(pinsURL);
      if (pins && (await pins.json()).includes(clientId)) return cache;
    }
  }

  function pinClient(clientId) {
    if (!clientId) return Promise.resolve();
    const work = pinWrites
      .catch(() => {})
      .then(async () => {
        if (await clientCache(clientId)) return;
        const cache = await caches.open(cacheName);
        const response = await cache.match(pinsURL);
        const live = new Set((await scopeClients()).map((client) => client.id));
        const ids = response
          ? (await response.json()).filter((id) => live.has(id))
          : [];
        ids.push(clientId);
        await cache.put(pinsURL, json(ids));
      });
    pinWrites = work;
    return work;
  }

  async function cachedResponse(request, response) {
    const range = request.headers.get("Range");
    if (!range || response.status !== 200) return response;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    // Unsupported multi-ranges and malformed syntax may be ignored as a full response.
    if (!match || (!match[1] && !match[2])) return response;
    const ifRange = request.headers.get("If-Range");
    if (
      ifRange &&
      (ifRange.startsWith("W/") ||
        (ifRange !== response.headers.get("ETag") &&
          ifRange !== response.headers.get("Last-Modified")))
    )
      return response;
    const bytes = await response.arrayBuffer();
    const total = bytes.byteLength;
    const first = match[1] ? Number(match[1]) : null;
    const last = match[2] ? Number(match[2]) : null;
    const start = first === null ? Math.max(0, total - last) : first;
    const end =
      first === null || last === null ? total - 1 : Math.min(last, total - 1);
    const headers = new Headers(response.headers);
    headers.set("Accept-Ranges", "bytes");
    if (
      (first !== null && !Number.isSafeInteger(first)) ||
      (last !== null && !Number.isSafeInteger(last)) ||
      start >= total ||
      end < start ||
      (first === null && last === 0)
    ) {
      headers.set("Content-Range", `bytes */${total}`);
      headers.set("Content-Length", "0");
      return new Response(null, {
        status: 416,
        statusText: "Range Not Satisfiable",
        headers,
      });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      statusText: "Partial Content",
      headers,
    });
  }

  async function respond(event, url) {
    const request = event.request;
    const href =
      url.pathname === scope.pathname
        ? indexURL
        : `${url.origin}${url.pathname}`;
    if (request.mode !== "navigate") {
      const pinned = await clientCache(event.clientId);
      const response = pinned && (await pinned.match(href));
      if (response && !url.pathname.includes("/__afterlight_internal__/"))
        return cachedResponse(request, response);
    }
    if (byURL.has(href)) {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(href);
      if (cached) {
        if (request.mode === "navigate")
          await pinClient(event.resultingClientId).catch(() => {});
        return cachedResponse(request, cached);
      }
      // Do not substitute a different release's same-name assets into the current one.
    } else if (!url.pathname.includes("/__afterlight_internal__/")) {
      const previous = await previousAsset(href);
      if (previous) return cachedResponse(request, previous);
    }
    try {
      return await fetch(request);
    } catch {
      if (request.mode === "navigate")
        return new Response(
          "AFTERLIGHT is offline. Open the saved app from its original installation URL after its offline copy is ready.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
            },
          },
        );
      return Response.error();
    }
  }

  self.addEventListener("install", (event) => event.waitUntil(install()));
  self.addEventListener("activate", (event) => event.waitUntil(activate()));
  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (
      request.method !== "GET" ||
      !sameScope(url) ||
      request.headers.has("Authorization") ||
      (request.cache === "only-if-cached" && request.mode !== "same-origin")
    )
      return;
    event.respondWith(respond(event, url).catch(() => fetch(request)));
  });
  self.addEventListener("message", (event) => {
    const port = event.ports?.[0];
    if (!port || !event.source?.url || !sameScope(new URL(event.source.url)))
      return;
    if (event.data?.type === "AFTERLIGHT_STATUS") {
      event.waitUntil(
        (async () => {
          const ready = await isReady();
          if (ready) await pinClient(event.source.id).catch(() => {});
          port.postMessage({
            type: "AFTERLIGHT_STATUS",
            ready,
            release: config.release,
            scope: scope.href,
            assets: entries.length,
          });
          // Only the active worker may prune. Asking a waiting worker for status must be read-only.
          if (
            self.registration.active?.scriptURL === self.location.href &&
            !self.registration.waiting &&
            !self.registration.installing
          )
            await pruneUnusedReleases().catch(() => {});
        })(),
      );
    } else if (event.data?.type === "AFTERLIGHT_CLAIM") {
      event.waitUntil(
        (async () => {
          try {
            if (!(await isReady())) {
              port.postMessage({ accepted: false });
              return;
            }
            await self.clients.claim();
            port.postMessage({ accepted: true });
          } catch {
            port.postMessage({ accepted: false });
          }
        })(),
      );
    } else if (
      event.data?.type === "AFTERLIGHT_ACTIVATE" &&
      event.data.consent === true
    ) {
      event.waitUntil(
        (async () => {
          if (!(await isReady())) {
            port.postMessage({ accepted: false });
            return;
          }
          await self.skipWaiting();
          port.postMessage({ accepted: true });
        })(),
      );
    }
  });
}

export function workerSource(config) {
  return `/* AFTERLIGHT — generated from the finished distribution. Do not edit. */\n(${serviceWorkerMain.toString()})(${JSON.stringify(config)});\n`;
}
