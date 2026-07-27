import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLACEHOLDER = "https://your-domain.example";
const input = process.argv[2];

if (!input) {
  throw new Error("Usage: npm run release:url -- https://example.com");
}

const url = new URL(input);
if (url.protocol !== "https:") {
  throw new Error("The production URL must use HTTPS");
}
if (url.username || url.password || url.search || url.hash) {
  throw new Error("Provide only the production origin and optional base path");
}

const productionBase = url.href.replace(/\/$/, "");
const files = ["index.html", "robots.txt", "sitemap.xml"];
let replacements = 0;

for (const file of files) {
  const path = resolve(ROOT, file);
  const source = await readFile(path, "utf8");
  const matches = source.split(PLACEHOLDER).length - 1;
  replacements += matches;
  await writeFile(path, source.replaceAll(PLACEHOLDER, productionBase));
}

if (replacements === 0) {
  throw new Error(
    "No deployment placeholders found; the URL may already be set"
  );
}

console.log(
  `Updated ${replacements} production URL references to ${productionBase}`
);
