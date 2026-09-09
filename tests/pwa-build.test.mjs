import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const builderURL = new URL("../scripts/build-pwa.mjs", import.meta.url);

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "afterlight-pwa-build-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const files = {
    "index.html": "<!doctype html><title>AFTERLIGHT</title>",
    "manifest.webmanifest": JSON.stringify({
      name: "AFTERLIGHT",
      id: "./",
      start_url: "./",
      scope: "./",
      icons: [{ src: "assets/icon.svg", sizes: "any", type: "image/svg+xml" }],
    }),
    "assets/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "assets/main.js": "window.booted = true;",
    "assets/space name.txt": "included",
    "robots.txt": "User-agent: *\nAllow: /\n",
    ".env": "NOT_PUBLIC",
    ".htaccess": "NOT_PUBLIC",
    ".private/data.json": "{}",
    "private/secret.json": "{}",
    "server/config.json": "{}",
    "assets/main.js.map": "{}",
    _headers: "NOT_PUBLIC",
    "web.config": "NOT_PUBLIC",
    "package.json": "{}",
    "old.php": "NOT_PUBLIC",
  };
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  return { dir, files };
}

test("PWA generation inventories actual bytes, excludes private/server files, and emits valid worker JavaScript", async (t) => {
  const { buildPWA } = await import(builderURL);
  const { dir, files } = await fixture(t);
  const result = await buildPWA({
    distDir: dir,
    version: "1.0.0",
    release: "test-first",
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.url),
    [
      "assets/icon.svg",
      "assets/main.js",
      "assets/space%20name.txt",
      "index.html",
      "manifest.webmanifest",
      "robots.txt",
    ],
  );
  for (const entry of result.entries)
    assert.equal(
      entry.bytes,
      Buffer.byteLength(files[decodeURIComponent(entry.url)]),
    );
  assert.equal(result.release, "test-first");
  const source = await readFile(path.join(dir, "sw.js"), "utf8");
  assert.doesNotThrow(() => new vm.Script(source));
  assert.ok(source.includes("test-first"));
  assert.deepEqual(
    JSON.parse(await readFile(path.join(dir, "pwa-inventory.json"), "utf8")),
    result,
  );
  const repeated = await buildPWA({
    distDir: dir,
    version: "1.0.0",
    release: "test-second",
  });
  assert.deepEqual(
    repeated.entries,
    result.entries,
    "worker and generated metadata are not recursively precached",
  );
});

test("PWA builds use unique bounded non-content release identifiers and reject a broken manifest", async (t) => {
  const { buildPWA } = await import(builderURL);
  const { dir } = await fixture(t);
  const first = await buildPWA({ distDir: dir, version: "1.2.3" });
  const second = await buildPWA({ distDir: dir, version: "1.2.3" });
  assert.notEqual(first.release, second.release);
  assert.match(first.release, /^1\.2\.3-[a-z0-9-]{1,50}$/);
  await writeFile(
    path.join(dir, "manifest.webmanifest"),
    JSON.stringify({ id: "./", start_url: "/", scope: "/" }),
  );
  await assert.rejects(
    buildPWA({ distDir: dir, version: "1.0.0" }),
    /relative|start_url|scope/i,
  );
});

test("PWA builds fail closed on missing manifest assets or missing application HTML", async (t) => {
  const { buildPWA } = await import(builderURL);
  const { dir } = await fixture(t);
  await rm(path.join(dir, "assets/icon.svg"));
  await assert.rejects(
    buildPWA({ distDir: dir, version: "1.0.0" }),
    /icon|missing/i,
  );
  await rm(path.join(dir, "index.html"));
  await assert.rejects(
    buildPWA({ distDir: dir, version: "1.0.0" }),
    /index\.html/i,
  );
});

test("PWA inventory refuses public symlinks rather than following files outside its distribution", async (t) => {
  const { buildPWA } = await import(builderURL);
  const { dir } = await fixture(t);
  await symlink(path.join(dir, "index.html"), path.join(dir, "linked.html"));
  await assert.rejects(
    buildPWA({ distDir: dir, version: "1.0.0" }),
    /non-regular file.*linked\.html/i,
  );
});

test("the production manifest has the required relative identity and real correctly-sized PNG icons", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.name, "AFTERLIGHT");
  assert.equal(manifest.short_name, "Afterlight");
  for (const property of ["id", "scope", "start_url"])
    assert.equal(manifest[property], "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.equal(manifest.theme_color, "#050A0F");
  assert.equal(manifest.background_color, "#050A0F");
  assert.equal(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    true,
  );
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\.\/assets\/[^/]+\.png$/);
    const bytes = await readFile(
      new URL(`../public/${icon.src}`, import.meta.url),
    );
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    const [width, height] = icon.sizes.split("x").map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
});
