import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/p0-levels-3-5");
const PORT = 4187;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SCENE_KEY = "starter-market-shift";
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";

if (!existsSync(join(DIST_DIR, "index.html"))) {
  throw new Error("dist/index.html is missing. Run npm run build first.");
}
mkdirSync(OUTPUT_DIR, { recursive: true });

const server = createServer((request, response) => {
  const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(DIST_DIR, safePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(DIST_DIR, "index.html");
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeType(filePath));
  response.setHeader("Cache-Control", "no-store");
  response.end(readFileSync(filePath));
});
await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    level3SalesfloorDecodes: false,
    level3BagDecodes: false,
    level3ReceiptDecodes: false,
    level3BagAppears: false,
    level3ProductsPackIntoBag: false,
    level3ReceiptPrints: false,
    level4SalesfloorDecodes: false,
    level4ThreeSpillsDecode: false,
    level4SpillAppears: false,
    level4SpillChangesWhileCleaning: false,
    level5SalesfloorDecodes: false
  },
  details: {},
  errors: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: []
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript(() => {
    window.CrazyGames = {
      SDK: {
        init: async () => undefined,
        game: {
          settings: { muteAudio: false },
          gameplayStart: () => undefined,
          gameplayStop: () => undefined,
          loadingStart: () => undefined,
          loadingStop: () => undefined,
          setGameContext: () => undefined,
          clearGameContext: () => undefined,
          reportGameCompletedPercentage: () => undefined,
          addSettingsChangeListener: () => undefined,
          removeSettingsChangeListener: () => undefined
        }
      }
    };
  });

  await runAudit("level3", () => auditLevel3(context));
  await runAudit("level4", () => auditLevel4(context));
  await runAudit("level5", () => auditLevel5(context));
} finally {
  writeFileSync(join(OUTPUT_DIR, "p0-levels-3-5-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
const failedAssertions = Object.entries(report.assertions)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
if (
  failedAssertions.length > 0 ||
  report.errors.length > 0 ||
  report.pageErrors.length > 0 ||
  report.failedRequests.length > 0
) {
  throw new Error(`P0 Levels 3-5 audit failed: ${failedAssertions.join(", ")}`);
}

async function runAudit(name, audit) {
  try {
    await audit();
  } catch (error) {
    report.errors.push({ name, error: String(error?.stack ?? error) });
  }
}

async function auditLevel3(context) {
  const page = await openLevel(context, "starter-level-003", "checkout=1");
  try {
    const assets = await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      const equipment = scene?.context?.levelAssets?.equipment ?? [];
      return {
        environment: scene?.context?.levelAssets?.environment?.path ?? "",
        bag: equipment.find((asset) => asset.key === "equipment-checkout-bag-open")?.path ?? "",
        receipt: equipment.find((asset) => asset.key === "prop-checkout-receipt")?.path ?? ""
      };
    }, SCENE_KEY);
    report.details.level3Assets = assets;
    const decoded = await decodeImages(page, Object.values(assets));
    report.details.level3Decoded = decoded;
    report.assertions.level3SalesfloorDecodes = Boolean(
      assets.environment.endsWith("/market-salesfloor-v3.png") && decoded[assets.environment]?.ok
    );
    report.assertions.level3BagDecodes = Boolean(
      assets.bag.endsWith("/equipment-checkout-bag-open.png") && decoded[assets.bag]?.ok
    );
    report.assertions.level3ReceiptDecodes = Boolean(
      assets.receipt.endsWith("/prop-checkout-receipt.png") && decoded[assets.receipt]?.ok
    );

    await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      if (!scene?.controller) throw new Error("Checkout controller is unavailable");
      scene.isInteractionReady = () => true;
      if (!scene.controller.dispatch("OPEN_REGISTER")) {
        throw new Error("Checkout controller rejected OPEN_REGISTER");
      }
    }, SCENE_KEY);

    await page.waitForSelector("#checkout-scan-overlay", { state: "visible", timeout: 15000 });
    report.assertions.level3BagAppears = await page
      .locator('#checkout-bag-stage > img[src*="equipment-checkout-bag-open.png"]')
      .isVisible();

    const cards = page.locator(".checkout-product-card");
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      await cards.nth(index).focus();
      await cards.nth(index).press("Enter");
    }
    await page.waitForFunction(
      (expected) => document.querySelector("#checkout-bag-fill")?.childElementCount === expected,
      count,
      { timeout: 10000 }
    );
    report.assertions.level3ProductsPackIntoBag = count >= 2;

    await page.locator("#checkout-payment-button").click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#checkout-payment-button img[src*="prop-checkout-receipt.png"]');
      return Boolean(image && Number(getComputedStyle(image).opacity) >= 0.99);
    }, null, { timeout: 1500 });
    report.assertions.level3ReceiptPrints = true;
    await page.screenshot({ path: join(OUTPUT_DIR, "level3-bag-receipt.png"), fullPage: true });
  } finally {
    await page.close();
  }
}

async function auditLevel4(context) {
  const page = await openLevel(context, "starter-level-004", "hold=1");
  try {
    const assets = await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return {
        environment: scene?.context?.levelAssets?.environment?.path ?? "",
        spills: (scene?.context?.levelAssets?.spills ?? []).map((asset) => asset.path)
      };
    }, SCENE_KEY);
    report.details.level4Assets = assets;
    const decoded = await decodeImages(page, [assets.environment, ...assets.spills]);
    report.details.level4Decoded = decoded;
    report.assertions.level4SalesfloorDecodes = Boolean(
      assets.environment.endsWith("/market-salesfloor-v3.png") && decoded[assets.environment]?.ok
    );
    report.assertions.level4ThreeSpillsDecode = Boolean(
      assets.spills.length === 3 &&
      new Set(assets.spills).size === 3 &&
      assets.spills.every((path) => decoded[path]?.ok)
    );

    await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      if (!scene?.controller) throw new Error("Cleaning controller is unavailable");
      scene.isInteractionReady = () => true;
      if (!scene.controller.dispatch("COLLECT_TOOLS")) {
        throw new Error("Cleaning controller rejected COLLECT_TOOLS");
      }
    }, SCENE_KEY);

    await page.waitForSelector("#hold-work-overlay", { state: "visible", timeout: 15000 });
    const spill = page.locator('#hold-work-button img[src*="spill-"]');
    report.assertions.level4SpillAppears = await spill.isVisible();

    const button = await page.locator("#hold-work-button").boundingBox();
    if (!button) throw new Error("Hold button has no bounds");
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(350);
    const state = await spill.evaluate((image) => ({
      opacity: Number(getComputedStyle(image).opacity),
      transform: image.style.transform
    }));
    await page.mouse.up();
    report.details.level4CleaningState = state;
    report.assertions.level4SpillChangesWhileCleaning = (
      state.opacity < 0.95 && /scale\(0\./.test(state.transform)
    );
    await page.screenshot({ path: join(OUTPUT_DIR, "level4-real-spill.png"), fullPage: true });
  } finally {
    await page.close();
  }
}

async function auditLevel5(context) {
  const page = await openLevel(context, "starter-level-005");
  try {
    const environment = await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return scene?.context?.levelAssets?.environment?.path ?? "";
    }, SCENE_KEY);
    const decoded = await decodeImages(page, [environment]);
    report.details.level5Environment = { environment, decoded: decoded[environment] };
    report.assertions.level5SalesfloorDecodes = Boolean(
      environment.endsWith("/market-salesfloor-v3.png") && decoded[environment]?.ok
    );
    await page.screenshot({ path: join(OUTPUT_DIR, "level5-salesfloor-v3.png"), fullPage: true });
  } finally {
    await page.close();
  }
}

async function openLevel(context, levelId, extraQuery = "") {
  const page = await context.newPage();
  attachListeners(page);
  const query = ["test=1", "briefing=0", `level=${levelId}`, extraQuery].filter(Boolean).join("&");
  await page.goto(`${ORIGIN}/?${query}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    (expected) => document.body.dataset.activeLevel === expected,
    levelId,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    (sceneKey) => Boolean(window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)),
    SCENE_KEY,
    { timeout: 30000 }
  );
  return page;
}

async function decodeImages(page, paths) {
  return page.evaluate(async (assetPaths) => {
    const entries = await Promise.all(assetPaths.map(async (path) => {
      if (!path) return [path, { ok: false, width: 0, height: 0 }];
      const result = await new Promise((resolveImage) => {
        const image = new Image();
        image.onload = () => resolveImage({
          ok: image.naturalWidth > 0 && image.naturalHeight > 0,
          width: image.naturalWidth,
          height: image.naturalHeight
        });
        image.onerror = () => resolveImage({ ok: false, width: 0, height: 0 });
        image.src = `/${path.replace(/^\/+/, "")}`;
      });
      return [path, result];
    }));
    return Object.fromEntries(entries);
  }, paths);
}

function attachListeners(page) {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.startsWith(ORIGIN)) return;
    report.failedRequests.push({ url, failure: request.failure()?.errorText ?? "unknown" });
  });
}

function mimeType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}
