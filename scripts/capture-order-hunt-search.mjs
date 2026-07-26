import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4179;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

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
    eightProductsVisible: false,
    fiveDecoysVisible: false,
    decoyCostsTime: false,
    decoyDoesNotAdvanceOrder: false,
    requestedItemsUseCanvasInteraction: false,
    orderCompletes: false
  },
  initialState: null,
  afterDecoyState: null,
  finalState: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
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

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(
    `${ORIGIN}/?test=1&briefing=0&level=starter-level-005`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-005",
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.findItemsVisibleCount === "8",
    null,
    { timeout: 15000 }
  );

  const initial = await readSearchState(page);
  report.initialState = initial;
  report.assertions.eightProductsVisible = initial.products.length === 8;
  report.assertions.fiveDecoysVisible = initial.decoys.length === 5;
  await page.screenshot({
    path: join(OUTPUT_DIR, "order-hunt-eight-products.png"),
    fullPage: true
  });

  const firstDecoy = initial.decoys[0];
  if (!firstDecoy) throw new Error("No visible decoy was found");
  await clickGame(page, firstDecoy.x, firstDecoy.y);
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.findChallenge?.snapshot?.().mistakes === 1;
  }, GAME_SCENE_KEY, { timeout: 10000 });

  const afterDecoy = await readSearchState(page);
  report.afterDecoyState = afterDecoy;
  report.assertions.decoyCostsTime = (
    initial.challenge.remainingMs - afterDecoy.challenge.remainingMs >= 4500
  );
  report.assertions.decoyDoesNotAdvanceOrder = (
    afterDecoy.controller.progress === 0 &&
    afterDecoy.challenge.collectedProductIds.length === 0
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "order-hunt-after-decoy.png"),
    fullPage: true
  });

  const requestedNames = [
    "find-item-milk-bottle",
    "find-item-apple",
    "find-item-cereal-box"
  ];
  for (let index = 0; index < requestedNames.length; index += 1) {
    const state = await readSearchState(page);
    const product = state.products.find((entry) => entry.name === requestedNames[index]);
    if (!product) throw new Error(`Missing requested product sprite: ${requestedNames[index]}`);
    await clickGame(page, product.x, product.y);
    await page.waitForFunction(({ sceneKey, progress }) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return scene?.controller?.snapshot?.().progress >= progress;
    }, { sceneKey: GAME_SCENE_KEY, progress: index + 1 }, { timeout: 20000 });
  }

  const finalState = await readSearchState(page);
  report.finalState = finalState;
  report.assertions.requestedItemsUseCanvasInteraction = (
    finalState.challenge.collectedProductIds.length === 3 &&
    finalState.challenge.mistakes === 1
  );
  report.assertions.orderCompletes = (
    finalState.controller.step === "complete" &&
    finalState.challenge.status === "complete"
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "order-hunt-complete.png"),
    fullPage: true
  });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Order hunt audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "order-hunt-search-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readSearchState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const list = scene?.children?.list ?? [];
    const products = list
      .filter((entry) => {
        if (typeof entry?.name !== "string") return false;
        return entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-");
      })
      .filter((entry) => entry.visible !== false && entry.active !== false)
      .map((entry) => ({
        name: entry.name,
        x: entry.x,
        y: entry.y,
        requested: entry.getData?.("requested") === true
      }));
    return {
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      products,
      decoys: products.filter((entry) => entry.name.startsWith("find-decoy-"))
    };
  }, GAME_SCENE_KEY);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
}

function attachListeners(page, auditReport) {
  page.on("console", (message) => {
    if (message.type() === "error") auditReport.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => auditReport.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  const extension = extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}
