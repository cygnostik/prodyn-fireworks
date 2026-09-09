# AFTERLIGHT installation and offline delivery

AFTERLIGHT can launch offline **after one complete online precache**. Wait for “Offline copy ready” before closing the online session. Loading the page, seeing an install button, accepting installation, and having an active registration are not equivalent to offline readiness.

The production build registers `sw.js`; the Vite development server does not. A browser must support service workers and provide a secure context. HTTPS is required on a live site; loopback HTTP is suitable for local testing. Opening the files directly with `file:` does not work.

## UI integration

```js
import { setupPWA } from './pwa/pwa.js';

const pwa = setupPWA({
  onStatus(state) {
    // Render the snapshot using the application's own buttons and status region.
    // Bind native install visibility to state.installable; show iOS help via state.ios.
    // Bind an explicit "Apply update and reload this tab" action to updateAvailable.
  },
});

// Call these from user-initiated button handlers, never automatically:
// await pwa.install();
// await pwa.applyUpdate();
// pwa.dispose() removes observers when the enclosing UI is destroyed.
```

`setupPWA({ onStatus = () => {} } = {})` returns `{ install, applyUpdate, getState, dispose }`. It creates no visible DOM. `getState()` returns an immutable snapshot with these fields:

| Field | Meaning |
| --- | --- |
| `supported` | Production mode, secure context, and the service-worker API are available. Registration/storage can still fail. |
| `offlineReady` | The matching **activated controller** confirms a committed precache with every inventoried asset still present. |
| `installable` | A real `beforeinstallprompt` capability was captured and has not been consumed. It is not a browser-support guess. |
| `installed` | Standalone display, iOS standalone state, or the browser's `appinstalled` event has been observed. |
| `updateAvailable` | A complete replacement worker is waiting while this page has a controller. |
| `online` | The browser's `navigator.onLine` hint; it does not prove internet access. |
| `message` | Plain-language status or installation guidance, suitable for a non-intrusive status region. |
| `ios` | iPhone/iPad detection, including iPadOS desktop-style user agents. |

`install()` invokes the captured browser prompt synchronously before awaiting its result, preserving the click gesture. It resolves to `accepted`, `dismissed`, `ios`, or `unavailable`. An accepted prompt alone does not set `installed`. Browser capability can change after dismissal; no prompt is repeatedly forced.

On iPhone or iPad, present the manual path: **open in Safari → Share → Add to Home Screen**. The browser may put this action under More. A missing native prompt must not be presented as a broken download or as successful installation. Browser and operating-system installation menus vary; the `ios` flag is guidance, not proof of platform support.

`applyUpdate()` resolves to whether activation was accepted. Call it only after the user has agreed that the current tab may reload. Exactly the consenting tab reloads once; other open shows keep running. With no waiting worker it resolves to `false`. `dispose()` removes listeners, closes pending message channels, and prevents later callbacks/reloads; it does not unregister the worker or erase storage.

## Build and cache lifecycle

`npm run build` generates the public pages through `scripts/build-pages.mjs`, runs Vite, then runs `node scripts/build-pwa.mjs`. The page generator reads the original specifications and source references in [`research/field-guide-data.json`](research/field-guide-data.json); the quote and retrieval ledgers are not build dependencies. The post-build step reads the finished distribution, validates the relative manifest and referenced images, then emits:

- `dist/sw.js`: a self-contained classic worker with that release's actual asset inventory.
- `dist/pwa-inventory.json`: release ID, package version, relative asset URLs, byte lengths, accepted media types, and total byte count.

The release ID combines package version, a bounded build timestamp, and a random nonce. It is not derived from file contents. Every public local file is included except generated worker/metadata files, source maps, dotfiles, private/server directories, server configuration, package metadata, and source/secret file types. Symlinks and other non-regular public entries fail the build. Exclusion from precache is **not** a server access-control rule: only deploy intended public output.

Registration and asset resolution follow Vite's `BASE_URL` and the document URL. The default `./` supports both origin-root delivery and paths such as `/exhibits/afterlight/`. Manifest `id`, `start_url`, and `scope` remain `./`. Deploy the entire distribution together at a directory URL ending in `/`; do not spread the manifest, worker, or assets across origins. The instrument uses a single entry URL, not history-based deep routes. Unknown uncached navigations receive an honest offline error, not a misleading cached HTML substitute for an asset.

Each cache name has the exact form `afterlight:pwa:<encoded registration scope>:release:<release ID>`. The full origin and trailing-slash path are encoded into the prefix. Cleanup never uses a broad `afterlight` prefix and never deletes another app's or another scope's caches.

Installation downloads the complete inventory with bounded concurrency and per-request timeouts. Responses must be successful, non-opaque, unredirected, from the requested URL, of the expected media type, and exactly the distribution's decoded byte length. HTML substituted for a non-HTML asset is rejected, including common same-length SPA fallbacks. A completion marker is written only after every cache write succeeds. Failure waits for in-flight writers to settle, then removes only that incomplete release; the previous release remains usable.

Response lengths and media checks detect truncation and common hosting errors. They do not authenticate content or detect every same-size mixed deployment. Publish releases atomically over HTTPS, with no CDN rewriting; see [deployment.md](deployment.md).

The first complete installation claims the current app documents. Readiness handles the browser's `activating` → `activated` transition and documents that begin navigating during activation. An existing worker never calls `skipWaiting()` during install. A waiting update accepts an activation message only with explicit consent. If all old app documents are closed, the browser may naturally activate the waiting worker; there is no open show to interrupt.

Old documents are pinned to their release, including fixed-name audio/data assets and versioned JavaScript. Older activated caches remain while pre-activation documents are alive. Once those documents are gone, a status check retires unused predecessor caches within this scope. Concurrent installing/waiting releases are not pruned. Long-lived tabs and simultaneous old/new releases need extra storage.

Readiness is rechecked on controller transitions, installation transitions, visibility, and connection events. Cache eviction revokes readiness at the next check. Browser storage can be cleared or evicted even after OS installation. Private browsing, low disk space, or disabled storage can prevent offline use; online rendering should remain available. No persistent-storage permission is silently requested.

## Cached audio

Cached responses carry their verified decoded byte length. Single-byte ranges support explicit, open-ended and suffix requests, with `206`/`Content-Range` responses; unsatisfiable ranges return `416`. The selected document's release remains authoritative for partial responses. This lets native WAV players report finite durations and seek while offline.

## Verification

Run `node --test tests/pwa-build.test.mjs tests/pwa-browser.test.mjs` after `npm ci` with Node 22.12 or newer. Browser tests use Playwright Chromium, or Microsoft Edge when available on macOS. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing Chromium-family browser if needed, or install the test browser with `npx playwright install chromium`. These fixtures are also included in `npm test`; the separate `npm run test:browser` suite exercises the built app.

The browser suite builds the real helper and generated worker into isolated temporary Vite fixtures, serves them only on `127.0.0.1` with ephemeral ports, and closes each browser context/server. Its build output and browser profiles are separate from the app's `dist/` and your browsing session. It checks:

- Delayed final precache, exact controller readiness, and a new-page cold launch with the whole browser context offline.
- Actual offline response bytes against the finished distribution, including a dynamically imported module, an image, and fetched data. An uncached network request must fail.
- Root and nested-path operation, scope containment, private-file exclusion, and generated-worker syntax.
- Two-tab update consent, one caller reload, uninterrupted peers, same-name peer asset isolation, previous release retirement, and foreign-cache preservation.
- Rejection and cleanup for 404, wrong MIME, same-length HTML substitution, truncated bodies, redirects, and actual Chromium quota exhaustion.
- Failed-update rollback, readiness loss after cache eviction, unsupported browsers, disposal, native prompt gating, iOS guidance, and no development registration.

Synthetic installation events verify UI policy, not native installation. Validate Chrome/Edge desktop, Android home-screen and Safari iPhone/iPad installation against the actual HTTPS release. Cold offline launch must include rendering, controls, fonts, audio after a gesture and capture; viewport emulation alone cannot establish device support. See the [live-release checks](deployment.md#verify-the-live-release) for update consent, portrait/landscape layouts and isolated low-storage testing.
