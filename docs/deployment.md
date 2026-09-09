# Deploying AFTERLIGHT

AFTERLIGHT is a static Vite application. Build with the final public URL, then publish the contents of `dist/` to an HTTPS directory. No application server or database is required at runtime.

## Build and publish

1. Use Node 22.12 or newer, as required by `package.json`, and install the locked dependencies with `npm ci`.
2. Run the [project checks](../README.md#development-and-checks) and build with [`SITE_URL`](#site-metadata). `npm run build` first generates the public field guide, sound library and credits through `scripts/build-pages.mjs`, then runs `vite build && node scripts/build-pwa.mjs`. Vite alone does not produce the offline worker. The field-guide build reads `docs/research/field-guide-data.json`.
3. Inspect `dist/pwa-inventory.json`. Confirm the expected HTML, manifest, scripts, styles, fonts, images, audio, and license files are listed. Budget space for both current and replacement releases on clients. Do not edit files after inventory generation; rebuild instead.
4. Preview locally with `npm run preview`. Its loopback bind is intentional. A preview server is not a production HTTPS host.
5. Upload the entire finished distribution to a **new, non-public release directory**, then switch the public directory to that release atomically. Prefer the hosting platform's atomic static-deploy mechanism. Keep a complete previous release for rollback. Do not replace files one by one in the live directory.
6. Preserve older versioned asset URLs during the rollout window where the host supports it. Do not mix a new worker with old fixed-name assets, minify HTML at the CDN, rewrite JavaScript, transcode precached images, or inject host analytics into built files. Such changes can fail offline installation or deliver a mixed release.
7. Publish only `dist/` as the website, not the source tree, `.env` files or package-manager stores. The worker's exclusion list is not an access-control boundary. Prepare a public source repository or source ZIP separately using the [research distribution boundary](research/fireworks.md#evidence-and-distribution-boundary).

The default relative base `./` can be served at `/` or a directory such as `/exhibits/afterlight/`. Keep all distribution files in the same directory structure. Redirect the no-trailing-slash form to the trailing-slash URL while preserving query parameters. Test this path before publishing: browsers resolve relative assets from the document URL. AFTERLIGHT does not require an origin-wide worker scope or a `Service-Worker-Allowed: /` header; do not add one for a subdirectory installation.

The app does not implement arbitrary history routes. Return a real 404 for missing assets and unknown routes. In particular, never rewrite failed `sw.js`, `.js`, `.css`, image, font, audio, or manifest requests to `index.html` with a 200 status.

## HTTPS, response headers, and media types

Use a valid certificate for the actual hostname. Redirect public HTTP requests to HTTPS and eliminate mixed-content requests. Loopback HTTP is a browser development exception; public IP or LAN HTTP is not an equivalent installation test.

Use these cache policies as a safe starting point:

| Resource | Response policy |
| --- | --- |
| `sw.js` | `Cache-Control: no-store, max-age=0`; JavaScript media type; direct 200 response, no login or redirect. |
| `index.html` / directory entry | `Cache-Control: no-cache`; no HTML transformation or injected script. |
| `manifest.webmanifest` and `pwa-inventory.json` | `Cache-Control: no-cache`. |
| Fixed-name public assets, including audio, fonts, and icons | `Cache-Control: no-cache`. Do not mark changeable filenames immutable. |
| Versioned asset filenames that will never be reused | Long-lived immutable HTTP caching is optional. Retain these URLs across a rollout. |

The worker is registered with `updateViaCache: 'none'` and downloads installation assets with cache reload semantics. Those browser settings do not repair an incorrectly configured upstream CDN.

Configure at least these media types:

| Extension | Media type |
| --- | --- |
| `.js`, `.mjs` | `text/javascript` or `application/javascript` |
| `.css` | `text/css` |
| `.html` | `text/html; charset=utf-8` |
| `.webmanifest` | `application/manifest+json` |
| `.json` | `application/json` |
| `.woff2` | `font/woff2` |
| `.png`, `.jpg`, `.svg` | `image/png`, `image/jpeg`, `image/svg+xml` respectively |
| `.wav` | `audio/wav` or `audio/x-wav` |
| `.txt` | `text/plain; charset=utf-8` |

Compression is fine: the installer checks decoded body bytes, not the compressed transport length. Redirects and HTML error pages are not valid asset responses even when they return a successful status.

Recommended security headers:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), screen-wake-lock=(self)
```

Start the following CSP in `Content-Security-Policy-Report-Only`, verify controls, rendering, offline launch, audio, screenshots and recording on an HTTPS staging release, then enforce it as `Content-Security-Policy`:

```text
default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; media-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
```

Inline style attributes are limited to UI presentation; this policy does not permit inline scripts or HTML event handlers. Keep application code, fonts, and audio self-hosted. If a later feature needs additional permissions or origins, review that feature rather than adding wildcards or weakening `script-src`.

After HTTPS has been verified, enable HSTS with an appropriate initial lifetime and increase it deliberately. Use `Strict-Transport-Security: max-age=31536000` only when you can maintain HTTPS for that hostname for the full period. Do not add `includeSubDomains` or request preload until every affected subdomain is ready. Cross-origin isolation headers are not required for this WebGL app; do not add them without testing their effect on downloads and integrations.

## Site metadata

Set `SITE_URL` at build time, replacing the example with the actual HTTPS directory URL:

```sh
SITE_URL=https://your-domain.example/ npm run build
```

Include any deployment subdirectory. `vite.config.js` adds the canonical link and `og:url`, and makes the social-image URLs absolute using `assets/social.jpg`. It normalizes a missing trailing slash and rejects credentials, query strings and fragments in `SITE_URL`. Verify those generated values and the published image before release; do not edit built HTML after the PWA inventory is generated.

Without `SITE_URL`, no canonical link or `og:url` is generated. Leave unknown production values unset rather than publishing the example hostname or a localhost identity. No credentials belong in source files, public metadata, build arguments or screenshots.

Keep manifest `id`, `start_url`, `scope`, and icon paths relative. Link `manifest.webmanifest` and `assets/apple-touch-icon.png` from the HTML using the app-relative paths. The manifest uses separate ordinary and maskable icons. If adding richer install-dialog screenshots, first generate and verify `assets/screenshot-wide.png` and `assets/screenshot-narrow.png`; declare their actual sizes and `form_factor` in the manifest only after the files exist.

Search crawlers read `robots.txt` at the **origin root**, not a nested application's directory. The included file permits crawling and has no invented sitemap URL. For a nested installation, coordinate origin-root crawler rules with the site's owner; do not replace another application's rules. Add a sitemap reference only if a real sitemap is published at the final site.

## Verify the live release

Use the final HTTPS URL, not a `file:` URL, development server, or temporary host alias:

- Check directory redirects, certificate validity, expected media types, security headers, and cache policies. Request one missing script URL and confirm a real 404 rather than the application HTML.
- In a clean browser profile, verify the worker has exactly the app directory scope and that the inventory downloads fully. “Offline copy ready” must appear only after the activated controller confirms the complete cache.
- Close the page, disable networking for the whole browser/device, and launch the app again. Exercise WebGL, fonts, interactions, local audio after a gesture, and capture rather than checking only the HTML shell.
- Install on desktop Chrome/Edge, Android, and iOS Safari. Check the app name, ordinary/maskable icons, standalone chrome, portrait layout, rotation, and cold offline launch. Browser-fixture tests do not certify native installation.
- Keep a show running in a second tab while publishing a new release. Decline the update first; neither tab should reload. Accept in one tab; only that tab should reload. The peer's current show and release assets must remain intact.
- Test one deliberately broken release in an isolated staging origin. Its precache should fail, its incomplete cache should disappear, and the previous offline release should still launch. Never conduct destructive cache tests in a visitor's or personal profile.

For rollback, republish the complete archived distribution atomically, including its matching worker and assets. It follows the same waiting-update/consent lifecycle for open tabs. Do not fix a rollout by deleting all origin caches or unregistering other apps' workers. Old clients may need time to check for a replacement while online.

Local browser fixtures cover application and worker behavior. DNS, TLS, response headers, crawler metadata, native installation and device-level offline launch must be checked against the final live site.
