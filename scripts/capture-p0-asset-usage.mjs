import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/p0-assets");
const PORT = 4186;
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
    level2UsesDistinctWaterCases: false,
    level2MemoryPreviewAppears: false,
    level3UsesSalesfloorV3: false,
    level3BagAppears: false,
    level3ScannedProductsFillBag: false,
    level3ReceiptPrints: false,
    level4UsesSalesfloorV3: false,
    level4HasThreeSpillSprites: false,
    level4SpillAppears: false,
    level4SpillShrinksWhileCleaning: false,
    level5UsesSalesfloorV3: false
  },
  details: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
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

  await auditLevel2(context);
  await auditLevel3(context);
  await auditLevel4(context);
  await auditLevel5(context);
} catch (error) {
  thrownError = error;
  report.fatalError = String(error?.stack ?? error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "p0-asset-usage-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
const failed = Object.entries(report.assertions).filter(([, value]) => !value).map(([key]) => key);
if (thrownError || failed.length > 0 || report.pageErrors.length > 0 || report.failedRequests.length > 0) {
  throw thrownError ?? new Error(`P0 asset usage audit failed: ${failed.join(", ")}`);
}

async function auditLevel2(context) {
  const page = await openLevel(context, "starter-level-002");
  try {
    const assets = await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return {
        closed: scene?.context?.levelAssets?.case?.path ?? null,
        open: scene?.context?.levelAssets?.caseOpen?.path ?? null
      };
    }, SCENE_KEY);
    report.details.level2 = assets;
    report.assertions.level2UsesDistinctWaterCases = Boolean(
      assets.closed?.endsWith("/water-case-closed.png") &&
      assets.open?.endsWith("/water-case-open.png") &&
      assets.closed !== assets.open
    );

    await triggerHudAction(page);
    await waitForSnapshot(page, { step: "load", boxCollected: true }, 45000);
    await triggerHudAction(page);
    await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true }, 60000);
    await page.waitForSelector("#restock-memory-preview", { state: "visible", timeout: 15000 });
    report.assertions.level2MemoryPreviewAppears = true;
    await page.screenshot({ path: join(OUTPUT_DIR, "level2-water-memory.png"), fullPage: true });
  } finally {
    await page.close();
  }
}

async function auditLevel3(context) {
  const page = await openLevel(context, "starter-level-003", "checkout=1");
  try {
    const environment = await readEnvironmentPath(page);
    report.details.level3Environment = environment;
    report.assertions.level3UsesSalesfloorV3 = environment.endsWith("/market-salesfloor-v3.png");

    await triggerHudAction(page);
    await waitForSnapshot(page, { step: "serve", customersServed: 0 }, 60000);
    await page.waitForSelector("#checkout-scan-overlay", { state: "visible", timeout: 15000 });

    const bag = page.locator('#checkout-bag-stage > img[src*="equipment-checkout-bag-open.png"]');
    report.assertions.level3BagAppears = await bag.isVisible();

    const cards = page.locator(".checkout-product-card");
    const itemCount = await cards.count();
    for (let index = 0; index < itemCount; index += 1) {
      await cards.nth(index).focus();
      await cards.nth(index).press("Enter");
    }
    await page.waitForFunction(
      (expected) => document.querySelector("#checkout-bag-fill")?.childElementCount === expected,
      itemCount,
      { timeout: 10000 }
    );
    report.assertions.level3ScannedProductsFillBag = itemCount >= 2;

    await page.locator("#checkout-payment-button").click();
    const receipt = page.locator('#checkout-payment-button img[src*="prop-checkout-receipt.png"]');
    await page.waitForFunction(() => {
      const image = document.querySelector('#checkout-payment-button img[src*="prop-checkout-receipt.png"]');
      return image && getComputedStyle(image).opacity === "1";
    }, null, { timeout: 1000 });
    report.assertions.level3ReceiptPrints = await receipt.isVisible();
    await page.screenshot({ path: join(OUTPUT_DIR, "level3-bag-receipt.png"), fullPage: true });
  } finally {
    await page.close();
  }
}

async function auditLevel4(context) {
  const page = await openLevel(context, "starter-level-004", "hold=1");
  try {
    const levelData = await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return {
        environment: scene?.context?.levelAssets?.environment?.path ?? "",
        spills: (scene?.context?.levelAssets?.spills ?? []).map((asset) => asset.path),
        toolPoint: scene?.context?.runtime?.toolPoint ?? null,
        firstSpot: scene?.context?.runtime?.spotPositions?.[0] ?? null
      };
    }, SCENE_KEY);
    report.details.level4 = levelData;
    report.assertions.level4UsesSalesfloorV3 = levelData.environment.endsWith("/market-salesfloor-v3.png");
    report.assertions.level4HasThreeSpillSprites = (
      levelData.spills.length === 3 &&
      new Set(levelData.spills).size === 3 &&
      levelData.spills.every((path) => /spill-(water|juice|dirt-smear)-large\.png$/.test(path))
    );
    if (!levelData.toolPoint || !levelData.firstSpot) throw new Error("Level 4 navigation points are missing");

    await moveScenePlayer(page, levelData.toolPoint);
    await waitForInteractionReady(page, 45000);
    await triggerHudAction(page);
    await waitForSnapshot(page, { step: "clean", progress: 0 }, 15000);
    await moveScenePlayer(page, levelData.firstSpot);
    await page.waitForSelector("#hold-work-overlay", { state: "visible", timeout: 45000 });

    const spill = page.locator('#hold-work-button img[src*="spill-"]');
    report.assertions.level4SpillAppears = await spill.isVisible();
    const button = await page.locator("#hold-work-button").boundingBox();
    if (!button) throw new Error("Hold button has no bounds");
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(320);
    const cleaningVisual = await spill.evaluate((image) => ({
      opacity: Number(getComputedStyle(image).opacity),
      transform: image.style.transform
    }));
    report.details.level4CleaningVisual = cleaningVisual;
    report.assertions.level4SpillShrinksWhileCleaning = (
      cleaningVisual.opacity < 0.95 && cleaningVisual.transform.includes("scale(")
    );
    await page.screenshot({ path: join(OUTPUT_DIR, "level4-real-spill.png"), fullPage: true });
    await page.mouse.up();
  } finally {
    await page.close();
  }
}

async function auditLevel5(context) {
  const page = await openLevel(context, "starter-level-005");
  try {
    const environment = await readEnvironmentPath(page);
    report.details.level5Environment = environment;
    report.assertions.level5UsesSalesfloorV3 = environment.endsWith("/market-salesfloor-v3.png");
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

async function triggerHudAction(page) {
  await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const action = scene?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("HUD action is missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function moveScenePlayer(page, point) {
  await page.evaluate(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const player = scene?.player ?? scene?.actors;
    if (!player?.setDestination) throw new Error("Scene player navigation is unavailable");
    player.setDestination(target);
  }, { sceneKey: SCENE_KEY, target: point });
}

async function waitForSnapshot(page, expected, timeout) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(target).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, target: expected }, { timeout });
}

async function waitForInteractionReady(page, timeout) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, SCENE_KEY, { timeout });
}

async function readEnvironmentPath(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.context?.levelAssets?.environment?.path ?? "";
  }, SCENE_KEY);
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
