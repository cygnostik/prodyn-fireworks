import { randomUUID } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { workerSource } from "../src/pwa/worker-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const excludedDirectories = new Set([
  "private",
  "server",
  "server-files",
  "functions",
  "api",
  "node_modules",
]);
const excludedNames = new Set([
  "sw.js",
  "pwa-inventory.json",
  "_headers",
  "_redirects",
  "web.config",
  "cname",
  "dockerfile",
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "netlify.toml",
  "vercel.json",
]);
const excludedExtensions =
  /\.(?:map|pem|key|p12|pfx|php|py|rb|sh|bat|ps1|ts|tsx|jsx|log|sql|bak)$/i;
const mediaTypes = {
  ".html": ["text/html"],
  ".css": ["text/css"],
  ".js": [
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
  ],
  ".mjs": ["text/javascript", "application/javascript"],
  ".json": ["application/json"],
  ".webmanifest": ["application/manifest+json", "application/json"],
  ".txt": ["text/plain"],
  ".svg": ["image/svg+xml"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".avif": ["image/avif"],
  ".gif": ["image/gif"],
  ".ico": ["image/x-icon", "image/vnd.microsoft.icon"],
  ".woff2": ["font/woff2", "application/font-woff2"],
  ".woff": ["font/woff", "application/font-woff"],
  ".ttf": ["font/ttf", "application/x-font-ttf"],
  ".otf": ["font/otf", "application/x-font-opentype"],
  ".wasm": ["application/wasm"],
  ".mp3": ["audio/mpeg"],
  ".ogg": ["audio/ogg", "application/ogg"],
  ".wav": ["audio/wav", "audio/x-wav", "audio/wave"],
  ".mp4": ["video/mp4"],
  ".webm": ["video/webm"],
  ".glb": ["model/gltf-binary", "application/octet-stream"],
  ".gltf": ["model/gltf+json", "application/json"],
  ".bin": ["application/octet-stream"],
  ".xml": ["application/xml", "text/xml"],
  ".pdf": ["application/pdf"],
};

async function inventory(directory, relative = "") {
  const entries = [];
  for (const file of await readdir(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    const name = file.name.toLowerCase();
    if (
      name.startsWith(".") ||
      excludedNames.has(name) ||
      excludedExtensions.test(name) ||
      /\.config\./i.test(name)
    )
      continue;
    const local = path.posix.join(relative, file.name);
    if (file.isDirectory()) {
      if (!excludedDirectories.has(name))
        entries.push(...(await inventory(directory, local)));
    } else if (file.isFile()) {
      const bytes = (await lstat(path.join(directory, local))).size;
      entries.push({
        url: local.split("/").map(encodeURIComponent).join("/"),
        bytes,
        types: mediaTypes[path.extname(name)] || [],
      });
    } else {
      throw new Error(`PWA inventory refuses non-regular file: ${local}`);
    }
  }
  return entries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

function manifestAsset(value, entries, label, directory) {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[?#]/.test(value)
  )
    throw new Error(`Manifest ${label} must use a local relative asset URL`);
  const base = pathToFileURL(`${directory}${path.sep}`);
  const url = new URL(value, base);
  if (
    url.protocol !== base.protocol ||
    url.host !== base.host ||
    !url.pathname.startsWith(base.pathname)
  )
    throw new Error(`Manifest ${label} must remain inside its relative scope`);
  const local = url.pathname.slice(base.pathname.length);
  if (!entries.some((entry) => entry.url === local))
    throw new Error(
      `Manifest ${label} is missing from the distribution: ${value}`,
    );
}

/** Generate an immutable release from the finished Vite output, never from source guesses. */
export async function buildPWA({
  distDir = path.join(root, "dist"),
  version,
  release,
} = {}) {
  const directory = path.resolve(distDir);
  if (!version)
    version = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ).version;
  if (typeof version !== "string" || !/^[a-zA-Z0-9.+-]{1,64}$/.test(version))
    throw new Error("Package version is not a bounded release identifier");
  release ??= `${version}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  if (!/^[a-zA-Z0-9.+-]{1,128}$/.test(release))
    throw new Error("Invalid PWA release identifier");
  const entries = await inventory(directory);
  if (!entries.some((entry) => entry.url === "index.html"))
    throw new Error("PWA build requires dist/index.html");
  if (!entries.some((entry) => entry.url === "manifest.webmanifest"))
    throw new Error("PWA build requires dist/manifest.webmanifest");
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.webmanifest"), "utf8"),
  );
  for (const key of ["id", "start_url", "scope"]) {
    if (manifest[key] !== "./")
      throw new Error(
        `Manifest ${key} must be './' for relative-subdirectory delivery`,
      );
  }
  if (!Array.isArray(manifest.icons) || !manifest.icons.length)
    throw new Error("Manifest requires local icons");
  for (const icon of manifest.icons)
    manifestAsset(icon.src, entries, "icon", directory);
  for (const screenshot of manifest.screenshots || [])
    manifestAsset(screenshot.src, entries, "screenshot", directory);
  const result = {
    release,
    version,
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  };
  await writeFile(path.join(directory, "sw.js"), workerSource(result), "utf8");
  await writeFile(
    path.join(directory, "pwa-inventory.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  return result;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--out-dir"))
      throw new Error(
        "Usage: node scripts/build-pwa.mjs [--out-dir DIRECTORY]",
      );
    const result = await buildPWA({ distDir: args[1] });
    console.log(
      `AFTERLIGHT PWA ${result.release}: ${result.entries.length} local assets, ${result.totalBytes} bytes. Offline readiness requires a completed browser install.`,
    );
  } catch (error) {
    console.error(`AFTERLIGHT PWA build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
