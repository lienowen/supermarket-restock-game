import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("restock-visual-audit");
const PORT = 4182;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const ITEMS_PER_SHELF = 3;

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
  rowIndex: null,
  states: [],
  assertions: {
    bakedBackgroundMarkedOccluded: false,
    opaqueEmptyShellExists: false,
    emptyShelfHasZeroItems: false,
    shelfBuildsOneItemAtATime: false,
    thirdItemCompletesShelf: false
  },
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({
    viewport: { width: GAME_WIDTH, height: GAME_HEIGHT },
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
    `${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-001`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-001",
    null,
    { timeout: 30000 }
  );

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true });
  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true }, 25000);
  await waitForInteractionReady(page);

  const initial = await readVisualState(page);
  report.rowIndex = initial.rush.activeRowIndex;
  report.states.push(initial);
  report.assertions.bakedBackgroundMarkedOccluded = initial.backgroundState === "occluded";
  report.assertions.opaqueEmptyShellExists = Boolean(
    initial.shell &&
    initial.shell.visible &&
    initial.shell.alpha === 1 &&
    initial.shell.backgroundStockOccluded === true &&
    initial.shell.depth < initial.rowDepth
  );
  report.assertions.emptyShelfHasZeroItems = (
    initial.itemCount === 0 &&
    initial.rush.activeRowItemCount === 0 &&
    initial.controller.stockedRows === 0
  );
  await captureCooler(page, "restock-visual-0-of-3.png");

  const rowIndex = initial.rush.activeRowIndex;
  const target = initial.target;
  for (let itemNumber = 1; itemNumber <= ITEMS_PER_SHELF; itemNumber += 1) {
    await waitForInteractionReady(page);
    await clickGame(page, target.x, target.y);
    await waitForRowItemCount(page, rowIndex, itemNumber);
    const state = await readVisualState(page, rowIndex);
    report.states.push(state);
    await captureCooler(page, `restock-visual-${itemNumber}-of-3.png`);
  }

  const one = report.states[1];
  const two = report.states[2];
  const three = report.states[3];
  report.assertions.shelfBuildsOneItemAtATime = Boolean(
    one?.itemCount === 1 &&
    two?.itemCount === 2 &&
    one?.controller.stockedRows === 0 &&
    two?.controller.stockedRows === 0
  );
  report.assertions.thirdItemCompletesShelf = Boolean(
    three?.itemCount === 3 &&
    three?.controller.stockedRows === 1 &&
    three?.rush.filledRowIndexes.includes(rowIndex)
  );

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Restock visual audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "restock-visual-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readVisualState(page, forcedRowIndex) {
  return page.evaluate(({ sceneKey, rowIndex }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now) ?? null;
    const activeRowIndex = Number.isInteger(rowIndex) ? rowIndex : rush?.activeRowIndex;
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${activeRowIndex}`);
    const target = scene?.children?.getByName?.(`beverage-cooler-row-target-${activeRowIndex}`);
    const shell = scene?.children?.getByName?.("beverage-cooler-empty-shell");
    return {
      backgroundState: document.body.dataset.restockCoolerBackground,
      controller: scene?.controller?.snapshot?.() ?? null,
      rush,
      itemCount: Array.isArray(holder?.list) ? holder.list.length : -1,
      rowDepth: holder?.depth ?? null,
      target: target ? { x: target.x, y: target.y } : null,
      shell: shell ? {
        visible: shell.visible,
        alpha: shell.alpha,
        depth: shell.depth,
        backgroundStockOccluded: shell.getData?.("background-stock-occluded") === true
      } : null
    };
  }, { sceneKey: SCENE_KEY, rowIndex: forcedRowIndex });
}

async function waitForRowItemCount(page, rowIndex, expectedCount) {
  await page.waitForFunction(({ sceneKey, rowIndex, expectedCount }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${rowIndex}`);
    return (
      rush?.rowItemCounts?.[rowIndex] === expectedCount &&
      Array.isArray(holder?.list) &&
      holder.list.length === expectedCount
    );
  }, { sceneKey: SCENE_KEY, rowIndex, expectedCount }, { timeout: 15000 });
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(expected).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, expected }, { timeout });
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 20000 });
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
}

async function captureCooler(page, filename) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const gameLeft = 1280;
  const gameTop = 155;
  const gameWidth = 320;
  const gameHeight = 535;
  await page.screenshot({
    path: join(OUTPUT_DIR, filename),
    clip: {
      x: box.x + (gameLeft / GAME_WIDTH) * box.width,
      y: box.y + (gameTop / GAME_HEIGHT) * box.height,
      width: (gameWidth / GAME_WIDTH) * box.width,
      height: (gameHeight / GAME_HEIGHT) * box.height
    }
  });
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
