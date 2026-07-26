import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4176;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
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
  sequence: [],
  shelfSteps: [],
  assertions: {
    previewAppears: false,
    sixUniqueSteps: false,
    challengeStartsAfterPreview: false,
    activeTargetHidden: false,
    wrongTapKeepsAnswer: false,
    partialShelfKeepsAnswer: false,
    threeItemsRequiredPerShelf: false,
    eighteenItemsStocked: false,
    memorySequenceCompletes: false
  },
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
  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-002`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-002",
    null,
    { timeout: 30000 }
  );

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true });
  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true }, 25000);

  await page.waitForSelector("#restock-memory-preview", { state: "visible", timeout: 10000 });
  report.assertions.previewAppears = documentState(
    await page.evaluate(() => document.body.dataset.restockMemory)
  ) === "preview";
  report.sequence = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return [...(scene?.rush?.plannedRowIndexes?.() ?? [])];
  }, GAME_SCENE_KEY);
  report.assertions.sixUniqueSteps = (
    report.sequence.length === 6 &&
    new Set(report.sequence).size === 6
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "promotion-memory-preview.png"),
    fullPage: true
  });

  await page.waitForFunction(
    () => document.body.dataset.restockMemory === "active",
    null,
    { timeout: 10000 }
  );
  await waitForInteractionReady(page);
  const firstRush = await readRush(page);
  report.assertions.challengeStartsAfterPreview = Boolean(
    firstRush?.started &&
    Number.isInteger(firstRush.activeRowIndex) &&
    firstRush.totalItemsStocked === 0
  );

  const visualState = await readRenderedShelf(page, firstRush.activeRowIndex);
  report.assertions.activeTargetHidden = (
    visualState.itemCount === 0 &&
    visualState.countVisible === false &&
    visualState.targetEnabled
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "promotion-memory-hidden-targets.png"),
    fullPage: true
  });

  const wrongRow = report.sequence.find((rowIndex) => rowIndex !== firstRush.activeRowIndex);
  const wrongTarget = await readRenderedTarget(page, wrongRow);
  await clickGame(page, wrongTarget.x, wrongTarget.y);
  await page.waitForTimeout(300);
  const afterWrong = await readRush(page);
  report.assertions.wrongTapKeepsAnswer = (
    afterWrong.activeRowIndex === firstRush.activeRowIndex &&
    afterWrong.mistakes === firstRush.mistakes + 1 &&
    afterWrong.totalItemsStocked === 0
  );

  for (let shelfIndex = 0; shelfIndex < report.sequence.length; shelfIndex += 1) {
    const rowIndex = report.sequence[shelfIndex];
    const target = await readRenderedTarget(page, rowIndex);

    for (let itemNumber = 1; itemNumber <= ITEMS_PER_SHELF; itemNumber += 1) {
      await waitForInteractionReady(page);
      const before = await readRush(page);
      const beforeController = await readSnapshot(page);
      await clickGame(page, target.x, target.y);
      await waitForRowItemCount(page, rowIndex, itemNumber);
      const after = await readRush(page);
      const afterController = await readSnapshot(page);
      const rendered = await readRenderedShelf(page, rowIndex);

      report.shelfSteps.push({
        shelfIndex,
        rowIndex,
        itemNumber,
        before,
        after,
        beforeController,
        afterController,
        rendered
      });

      if (rendered.itemCount !== itemNumber) {
        throw new Error(`Memory shelf ${rowIndex} rendered ${rendered.itemCount} items at ${itemNumber}/3`);
      }
      if (itemNumber < ITEMS_PER_SHELF) {
        if (
          after.activeRowIndex !== rowIndex ||
          afterController.stockedRows !== shelfIndex
        ) {
          throw new Error(`Memory shelf ${rowIndex} advanced before 3/3`);
        }
      } else {
        await waitForSnapshot(page, { stockedRows: shelfIndex + 1 }, 15000);
        if (!after.filledRowIndexes.includes(rowIndex)) {
          throw new Error(`Memory shelf ${rowIndex} did not complete at 3/3`);
        }
      }

      if (shelfIndex === 0 && itemNumber === 1) {
        report.assertions.partialShelfKeepsAnswer = (
          beforeController.stockedRows === 0 &&
          afterController.stockedRows === 0 &&
          after.activeRowIndex === rowIndex &&
          rendered.itemCount === 1
        );
      }
      if (shelfIndex === 0 && itemNumber === ITEMS_PER_SHELF) {
        report.assertions.threeItemsRequiredPerShelf = (
          afterController.stockedRows === 1 &&
          rendered.itemCount === ITEMS_PER_SHELF &&
          after.filledRowIndexes.includes(rowIndex)
        );
      }
    }
  }

  const complete = await waitForSnapshot(page, { step: "complete", stockedRows: 6 }, 15000);
  const finalRush = await readRush(page);
  report.assertions.eighteenItemsStocked = (
    finalRush.totalItemsStocked === 18 &&
    finalRush.rowItemCounts.every((count) => count === 3)
  );
  report.assertions.memorySequenceCompletes = Boolean(
    complete &&
    complete.step === "complete" &&
    finalRush.complete
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "promotion-memory-complete.png"),
    fullPage: true
  });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Promotion memory audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "promotion-memory-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

function documentState(value) {
  return typeof value === "string" ? value : "";
}

async function readRush(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now) ?? null;
  }, GAME_SCENE_KEY);
}

async function readSnapshot(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.() ?? null;
  }, GAME_SCENE_KEY);
}

async function readRenderedShelf(page, rowIndex) {
  return page.evaluate(({ sceneKey, index }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${index}`);
    const label = scene?.children?.getByName?.(`beverage-cooler-row-count-${index}`);
    const target = scene?.children?.getByName?.(`beverage-cooler-row-target-${index}`);
    return {
      itemCount: Array.isArray(holder?.list) ? holder.list.length : -1,
      countText: label?.text ?? null,
      countVisible: label?.visible ?? false,
      targetEnabled: Boolean(target?.input?.enabled)
    };
  }, { sceneKey: GAME_SCENE_KEY, index: rowIndex });
}

async function waitForRowItemCount(page, rowIndex, expectedCount) {
  await page.waitForFunction(({ sceneKey, index, count }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${index}`);
    return (
      rush?.rowItemCounts?.[index] === count &&
      Array.isArray(holder?.list) &&
      holder.list.length === count
    );
  }, { sceneKey: GAME_SCENE_KEY, index: rowIndex, count: expectedCount }, { timeout: 15000 });
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY, { timeout: 15000 });
}

async function readRenderedTarget(page, rowIndex) {
  const target = await page.evaluate(({ sceneKey, index }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rowTarget = scene?.children?.getByName?.(`beverage-cooler-row-target-${index}`);
    return rowTarget ? { x: rowTarget.x, y: rowTarget.y } : null;
  }, { sceneKey: GAME_SCENE_KEY, index: rowIndex });
  if (!target) throw new Error(`Missing cooler target ${rowIndex}`);
  return target;
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
