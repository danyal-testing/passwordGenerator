import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

function pngDimensions(path) {
  const data = readFileSync(resolve(ROOT, path));
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function cspFromVercel() {
  const config = JSON.parse(read("vercel.json"));
  return config.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy").value;
}

function sha256(source) {
  return createHash("sha256").update(source).digest("base64");
}

test("all service-worker precache entries exist", () => {
  const source = read("sw.js");
  const list = source.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1];
  assert.ok(list, "ASSETS list was not found");
  const assets = [...list.matchAll(/"\.\/(.*?)"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 20);
  assert.equal(assets.includes("css/styles.css"), true);
  assert.equal(assets.includes("js/main.js"), true);
  for (const asset of assets) {
    assert.equal(existsSync(resolve(ROOT, asset || "index.html")), true, asset);
  }
});

test("manifest icons and screenshots exist", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, ".");
  assert.equal(manifest.start_url, ".");
  assert.equal(manifest.scope, "./");
  for (const asset of [...manifest.icons, ...manifest.screenshots]) {
    assert.equal(existsSync(resolve(ROOT, asset.src)), true, asset.src);
    if (asset.type === "image/png") {
      const [expectedWidth, expectedHeight] = asset.sizes.split("x").map(Number);
      assert.deepEqual(pngDimensions(asset.src), {
        width: expectedWidth,
        height: expectedHeight,
      });
    }
  }
});

test("repository stays source-first without generated bundle duplicates", () => {
  for (const file of [
    "css/styles.bundle.css",
    "css/styles.min.css",
    "js/app.js",
    "js/app.min.js",
    "scripts/build-assets.mjs",
    "sw.template.js",
    "FINAL-AUDIT.md",
    "UX-AUDIT.md",
    "netlify.toml",
    ".npmrc",
  ]) {
    assert.equal(existsSync(resolve(ROOT, file)), false, `${file} should be absent`);
  }
});

test("deployment CSP permits only the exact inline scripts", () => {
  const csp = cspFromVercel();
  assert.equal(csp.includes("'unsafe-inline'"), false);
  assert.equal(csp.includes("object-src 'none'"), true);
  assert.equal(csp.includes("frame-ancestors 'none'"), true);

  for (const file of ["index.html", "404.html"]) {
    const inlineScripts = [...read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .filter((source) => source.trim().length > 0);
    for (const source of inlineScripts) {
      assert.equal(csp.includes(`'sha256-${sha256(source)}'`), true, `${file} CSP hash`);
    }
  }
});

test("repository contains no broken GitHub badge placeholder", () => {
  assert.equal(read("README.md").includes("your-username"), false);
});
