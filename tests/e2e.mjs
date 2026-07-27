import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = 4173;
const ORIGIN = "http://" + HOST + ":" + PORT;
const vercelConfig = JSON.parse(
  await readFile(join(ROOT, "vercel.json"), "utf8")
);
const CSP = vercelConfig.headers
  .flatMap((rule) => rule.headers)
  .find((header) => header.key === "Content-Security-Policy").value;

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function waitForText(locator, expected) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((await locator.textContent()) === expected) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  assert.equal(await locator.textContent(), expected);
}

async function auditAccessibility(page, context, theme) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate((nextTheme) => {
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, theme);
  await page.waitForTimeout(20);

  const audit = await page.evaluate(() => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) || [];
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const composite = (foreground, background) => ({
      r: foreground.r * foreground.a + background.r * (1 - foreground.a),
      g: foreground.g * foreground.a + background.g * (1 - foreground.a),
      b: foreground.b * foreground.a + background.b * (1 - foreground.a),
      a: 1,
    });
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (foreground, background) => {
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    };
    const backgroundFor = (element) => {
      let current = element;
      while (current) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color.a > 0) return color;
        current = current.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    const selectors = [
      ".generator__title",
      ".generator__password",
      ".field__label",
      ".field__value",
      ".field__hint",
      ".option__label",
      ".form-error",
      ".strength__label",
      ".strength__text",
      ".btn__label",
      ".generator__footnote",
    ];
    const contrast = selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => {
          const background = backgroundFor(element);
          const foreground = composite(
            parse(getComputedStyle(element).color),
            background
          );
          return { selector, ratio: ratio(foreground, background) };
        })
    );

    const targets = [
      ...document.querySelectorAll("button, input[type='range'], .option"),
    ]
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.textContent.trim() ||
            element.className,
          width: rect.width,
          height: rect.height,
        };
      });
    return { contrast, targets };
  });

  for (const result of audit.contrast) {
    assert.equal(
      result.ratio >= 7,
      true,
      `${theme} ${result.selector} contrast ${result.ratio.toFixed(2)}:1`
    );
  }
  for (const target of audit.targets) {
    assert.equal(
      target.width >= 44 && target.height >= 44,
      true,
      `${target.label} target ${target.width}x${target.height}`
    );
  }

  const session = await context.newCDPSession(page);
  const { nodes } = await session.send("Accessibility.getFullAXTree");
  const interactiveRoles = new Set(["button", "checkbox", "link", "slider"]);
  const unnamed = nodes.filter(
    (node) =>
      !node.ignored &&
      interactiveRoles.has(node.role?.value) &&
      !node.name?.value?.trim()
  );
  assert.deepEqual(unnamed, [], `${theme} has unnamed interactive controls`);
  await session.detach();
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = normalize(join(ROOT, requested));
  return filePath.startsWith(ROOT) ? filePath : null;
}

const server = createServer(async (request, response) => {
  const filePath = safePath(request.url || "/");
  try {
    if (!filePath) throw new Error("unsafe path");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": CSP,
    });
    response.end(body);
  } catch {
    const body = await readFile(join(ROOT, "404.html"));
    response.writeHead(404, { "Content-Type": TYPES[".html"] });
    response.end(body);
  }
});

await new Promise((resolveListen) => server.listen(PORT, HOST, resolveListen));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error")
      runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));

  await page.goto(ORIGIN, { waitUntil: "networkidle" });
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(
    await page.locator("[data-password-output]").textContent(),
    "Generate a password"
  );
  assert.equal(
    await page.locator("[data-password-output]").getAttribute("aria-live"),
    null
  );
  assert.equal(await page.locator("[data-strength-text]").textContent(), "—");
  assert.equal(await page.locator(".strength").getAttribute("aria-live"), null);
  assert.equal(await page.locator("[data-copy-button]").isDisabled(), true);
  assert.equal(
    await page.locator("[data-length-input]").getAttribute("aria-valuetext"),
    "16 characters"
  );
  const productionResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.(?:css|js)$/.test(new URL(name).pathname))
  );
  const resourcePaths = productionResources
    .map((name) => new URL(name).pathname)
    .sort();
  for (const required of [
    "/css/styles.css",
    "/js/clipboard.js",
    "/js/config.js",
    "/js/generator.js",
    "/js/main.js",
    "/js/pwa.js",
    "/js/random.js",
    "/js/theme.js",
  ]) {
    assert.equal(resourcePaths.includes(required), true, required);
  }

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("skip-link")
    ),
    true
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "generator-settings"
  );

  await page.locator("[data-form]").evaluate((form) => form.requestSubmit());
  const firstPassword =
    (await page.locator("[data-password-output]").textContent()) || "";
  assert.equal(firstPassword.length, 16);
  assert.match(firstPassword, /[A-Z]/);
  assert.match(firstPassword, /[a-z]/);
  assert.match(firstPassword, /[0-9]/);
  assert.equal(await page.locator("[data-copy-button]").isEnabled(), true);
  await waitForText(
    page.locator("[data-generation-status]"),
    "New password generated. Use the copy button to copy it."
  );
  assert.equal(
    await page.locator("[data-generation-status]").textContent(),
    "New password generated. Use the copy button to copy it."
  );
  assert.equal(
    await page.locator("[data-generate-label]").textContent(),
    "Generate another"
  );

  await page.locator("[data-copy-button]").click();
  await page.locator("[data-copy-text]").waitFor({ state: "visible" });
  await waitForText(
    page.locator("[data-copy-announcement]"),
    "Password copied to clipboard."
  );
  assert.equal(await page.locator("[data-copy-text]").textContent(), "Copied");
  assert.equal(
    await page.locator("[data-copy-announcement]").textContent(),
    "Password copied to clipboard."
  );
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    firstPassword
  );

  await page.locator("[data-length-input]").fill("4");
  assert.equal(
    await page.locator("[data-password-output]").textContent(),
    "Generate a password"
  );
  assert.equal(await page.locator("[data-copy-button]").isDisabled(), true);
  assert.equal(
    await page.locator("[data-generate-label]").textContent(),
    "Generate password"
  );
  await page.locator('[data-option="symbols"]').evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-form]").evaluate((form) => form.requestSubmit());
  const fourClassPassword =
    (await page.locator("[data-password-output]").textContent()) || "";
  assert.equal(fourClassPassword.length, 4);
  assert.match(fourClassPassword, /[A-Z]/);
  assert.match(fourClassPassword, /[a-z]/);
  assert.match(fourClassPassword, /[0-9]/);
  assert.match(fourClassPassword, /[^A-Za-z0-9]/);

  for (const option of ["uppercase", "lowercase", "numbers", "symbols"]) {
    await page.locator(`[data-option="${option}"]`).evaluate((input) => {
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await page.locator("[data-form]").evaluate((form) => form.requestSubmit());
  assert.equal(await page.locator("[data-error]").isVisible(), true);
  assert.equal(await page.locator("[data-strength-text]").textContent(), "—");

  await auditAccessibility(page, context, "dark");
  await auditAccessibility(page, context, "light");

  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await page.locator("[data-theme-toggle]").click({ position: { x: 4, y: 4 } });
  const toggledTheme = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(toggledTheme, initialTheme);
  assert.match(
    (await page.locator("[data-theme-toggle]").getAttribute("aria-label")) ||
      "",
    /^Switch to (light|dark) theme$/
  );

  const widths = [
    280, 320, 360, 375, 390, 414, 430, 480, 576, 768, 820, 834, 1024, 1280,
    1366, 1440, 1536, 1600, 1728, 1920, 2560,
  ];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('[data-option="uppercase"]').evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator('[data-option="lowercase"]').evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator('[data-option="numbers"]').evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator('[data-option="symbols"]').evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("[data-length-input]").fill("32");
    await page.locator("[data-form]").evaluate((form) => form.requestSubmit());
    await page.waitForTimeout(25);
    const passwordLayout = await page
      .locator("[data-password-output]")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight),
          text: element.textContent,
        };
      });
    assert.equal(
      passwordLayout.text.length,
      32,
      `password length at ${width}px`
    );
    assert.equal(
      passwordLayout.height <= passwordLayout.lineHeight * 2 + 1,
      true,
      `password wrapped beyond two lines at ${width}px`
    );
    const overflow = await page.evaluate(() => ({
      document:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    assert.equal(
      overflow.document <= 0,
      true,
      `document overflow at ${width}px`
    );
    assert.equal(overflow.body <= 0, true, `body overflow at ${width}px`);
  }

  for (const viewport of [
    { width: 1024, height: 600 },
    { width: 800, height: 600 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    assert.equal(
      horizontalOverflow <= 0,
      true,
      `landscape overflow at ${viewport.width}x${viewport.height}`
    );
  }

  const manifest = await (
    await page.request.get(`${ORIGIN}/manifest.webmanifest`)
  ).json();
  assert.equal(manifest.id, ".");
  assert.equal(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable"
    ),
    true
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ORIGIN, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(
    (await page.locator("h1").textContent())?.trim(),
    "Password Generator"
  );
  await context.setOffline(false);

  assert.deepEqual(runtimeErrors, []);
  await context.close();

  const fileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const filePage = await fileContext.newPage();
  const fileErrors = [];
  filePage.on("console", (message) => {
    if (message.type() === "error") fileErrors.push(message.text());
  });
  filePage.on("pageerror", (error) => fileErrors.push(error.message));
  await filePage.goto(`file://${join(ROOT, "index.html")}`, {
    waitUntil: "load",
  });
  await filePage
    .locator("[data-form]")
    .evaluate((form) => form.requestSubmit());
  assert.equal(
    ((await filePage.locator("[data-password-output]").textContent()) || "")
      .length,
    16
  );
  assert.deepEqual(fileErrors, []);
  await fileContext.close();

  console.log(
    "E2E, responsive, clipboard, file://, and offline checks passed."
  );
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
