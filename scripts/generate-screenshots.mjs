import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(ROOT, "docs", "screenshots");
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

mkdirSync(DOCS_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

const scenarios = [
  {
    file: "laptop-dark.png",
    theme: "dark",
    width: 1440,
    height: 900,
    length: 18,
  },
  {
    file: "laptop-light.png",
    theme: "light",
    width: 1440,
    height: 900,
    length: 18,
  },
  {
    file: "tablet-dark.png",
    theme: "dark",
    width: 834,
    height: 1194,
    length: 18,
  },
  {
    file: "tablet-light.png",
    theme: "light",
    width: 834,
    height: 1194,
    length: 18,
  },
  {
    file: "mobile-dark.png",
    theme: "dark",
    width: 390,
    height: 844,
    length: 16,
  },
  {
    file: "mobile-light.png",
    theme: "light",
    width: 390,
    height: 844,
    length: 16,
  },
];

for (const scenario of scenarios) {
  const page = await browser.newPage({
    viewport: { width: scenario.width, height: scenario.height },
    deviceScaleFactor: 1,
  });

  await page.addInitScript((theme) => {
    try {
      localStorage.setItem("pg-theme", theme);
    } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, scenario.theme);

  await page.emulateMedia({ colorScheme: scenario.theme, reducedMotion: "reduce" });
  await page.goto(`file://${join(ROOT, "index.html")}`, { waitUntil: "load" });

  for (const option of ["uppercase", "lowercase", "numbers", "symbols"]) {
    await page.locator(`[data-option="${option}"]`).evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  await page.locator("[data-length-input]").fill(String(scenario.length));
  await page.locator("[data-form]").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(DOCS_DIR, scenario.file) });
  await page.close();
}

await browser.close();
process.stdout.write("Screenshots regenerated.\n");
