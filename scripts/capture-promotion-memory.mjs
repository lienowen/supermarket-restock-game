import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-2");
const PORT = 4188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
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
    maturePresetActive: false,
    levelTwoVisualLayerIsNonBlocking: false,
    caseFollowsWorkerToCart: false,
    pushRouteUsesWorkerAndCart: false,
    reachesRestockWithOpenCase: false,
    compactHudActive: false,
    previewVisible: false,
    previewShowsSixShelves: false,
    previewMatchesRushSequence: false,
    previewShowsShuffledOrder: false,
    targetHiddenAfterPreview: false,
    wrongShelfCostsMistake: false,
    wrongShelfDoesNotAdvance: false,
    correctShelfPartialKeepsAnswer: false,
    correctShelfCompletesAtConfiguredCount: false,
    waterBottleAppearsOnShelf: false,
    fullMemorySequenceCompletes: false,
    noRuntimeIssues: false
  },
  route: {},
  preview: null,
  wrong: null,
  firstCorrect: null,
  final: null,
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
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
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
    } } };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-002`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-002",
    null,
    { timeout: 30000 }
  );

  const initial = await readSceneState(page);
  report.assertions.maturePresetActive = (
    initial.visualPresetId === "restock-golden-standard-v1" &&
    initial.actorControl === "routed-world-action-chain"
  );
  report.assertions.levelTwoVisualLayerIsNonBlocking = (
    initial.levelTwoActorControl === "routed-memory-restock"
  );

  await waitForHudAction(page);
  await clickHudAction(page);

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    const nav = scene?.actors?.navigationSnapshot?.();
    const worker = scene?.children?.getByName?.("restock-worker");
    const box = scene?.children?.getByName?.("restock-case");
    return Boolean(
      snapshot?.step === "load" &&
      snapshot?.boxCollected === true &&
      nav?.moving === true &&
      worker &&
      box?.visible === true &&
      Math.abs(box.x - worker.x) < 85 &&
      box.y < worker.y - 70
    );
  }, SCENE_KEY, { timeout: 10000 });
  report.assertions.caseFollowsWorkerToCart = true;
  report.route.carry = await readSceneState(page);

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.().step === "load" && scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 10000 });
  await waitForHudAction(page);
  await clickHudAction(page);

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    const nav = scene?.actors?.navigationSnapshot?.();
    const worker = scene?.children?.getByName?.("restock-worker");
    const cart = scene?.children?.getByName?.("restock-cart");
    return Boolean(
      ["push", "park"].includes(snapshot?.step) &&
      nav?.moving === true &&
      String(worker?.texture?.key ?? "").includes("worker-push") &&
      cart?.visible === true &&
      Math.abs((worker.x - cart.x) - 180) < 12 &&
      Math.abs(worker.y - cart.y) < 16
    );
  }, SCENE_KEY, { timeout: 10000 });
  report.assertions.pushRouteUsesWorkerAndCart = true;
  report.route.push = await readSceneState(page);

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(
      snapshot?.step === "restock" &&
      snapshot?.boxLoaded === true &&
      snapshot?.cartAtCooler === true &&
      snapshot?.boxOpened === true
    );
  }, SCENE_KEY, { timeout: 15000 });
  report.assertions.reachesRestockWithOpenCase = true;

  await page.waitForFunction(
    () => document.body.dataset.matureRestockHud === "compact-v1",
    null,
    { timeout: 5000 }
  );
  report.assertions.compactHudActive = true;

  await page.waitForFunction(() => {
    const preview = document.getElementById("restock-memory-preview");
    return document.body.dataset.restockMemory === "preview" && Boolean(preview?.isConnected);
  }, null, { timeout: 8000 });

  const preview = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const overlay = document.getElementById("restock-memory-preview");
    const cells = [...(overlay?.querySelectorAll?.("#restock-memory-grid > div") ?? [])]
      .map((cell) => ({
        slotIndex: Number(cell.dataset.slotIndex),
        order: Number(cell.dataset.order)
      }))
      .filter((cell) => Number.isInteger(cell.slotIndex) && Number.isInteger(cell.order) && cell.order > 0);
    const sequence = [...cells]
      .sort((a, b) => a.order - b.order)
      .map((cell) => cell.slotIndex);
    const planned = [...(scene?.rush?.plannedRowIndexes?.() ?? [])];
    return {
      datasetState: document.body.dataset.restockMemory ?? null,
      cellCount: cells.length,
      sequence,
      planned,
      rush: scene?.rush?.snapshot?.(scene.time.now) ?? null
    };
  }, SCENE_KEY);
  report.preview = preview;
  report.assertions.previewVisible = preview.datasetState === "preview";
  report.assertions.previewShowsSixShelves = preview.cellCount === 6 && preview.sequence.length === 6;
  report.assertions.previewMatchesRushSequence = (
    preview.sequence.length === preview.planned.length &&
    preview.sequence.every((value, index) => value === preview.planned[index])
  );
  report.assertions.previewShowsShuffledOrder = (
    preview.sequence.length === 6 &&
    new Set(preview.sequence).size === 6 &&
    preview.sequence.some((value, index) => value !== index)
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-memory-preview.png"), fullPage: true });

  await page.waitForFunction(
    () => document.body.dataset.restockMemory === "active",
    null,
    { timeout: 7000 }
  );
  await waitForInteractionReady(page);

  const activeStart = await readRushState(page);
  const activeRow = activeStart.activeRowIndex;
  const rowCount = activeStart.rowItemCounts.length;
  const wrongRow = Array.from({ length: rowCount }, (_, index) => index)
    .find((index) => index !== activeRow);
  if (!Number.isInteger(activeRow) || !Number.isInteger(wrongRow)) {
    throw new Error("Level 2 active/wrong row could not be resolved");
  }

  report.assertions.targetHiddenAfterPreview = await page.evaluate(({ sceneKey, row }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const count = scene?.children?.getByName?.(`beverage-cooler-row-count-${row}`);
    const target = scene?.children?.getByName?.(`beverage-cooler-row-target-${row}`);
    return count?.visible === false && target?.input?.enabled === true;
  }, { sceneKey: SCENE_KEY, row: activeRow });

  const mistakesBefore = activeStart.mistakes;
  const activeBeforeWrong = activeStart.activeRowIndex;
  await clickRowTarget(page, wrongRow);
  await page.waitForFunction(({ sceneKey, mistakesBefore }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return (scene?.rush?.snapshot?.(scene.time.now)?.mistakes ?? 0) > mistakesBefore;
  }, { sceneKey: SCENE_KEY, mistakesBefore }, { timeout: 5000 });
  const afterWrong = await readRushState(page);
  report.wrong = afterWrong;
  report.assertions.wrongShelfCostsMistake = afterWrong.mistakes === mistakesBefore + 1;
  report.assertions.wrongShelfDoesNotAdvance = (
    afterWrong.activeRowIndex === activeBeforeWrong &&
    afterWrong.rowItemCounts[activeBeforeWrong] === 0
  );

  const itemsPerRow = afterWrong.itemsPerRow;
  if (!Number.isInteger(itemsPerRow) || itemsPerRow < 1) {
    throw new Error("Invalid Level 2 itemsPerRow");
  }

  await waitForInteractionReady(page);
  await clickRowTarget(page, activeRow);
  await waitForRowLogicalCount(page, activeRow, 1);
  const firstCorrect = await readRushState(page);
  report.firstCorrect = firstCorrect;
  report.assertions.correctShelfPartialKeepsAnswer = itemsPerRow === 1 || (
    firstCorrect.activeRowIndex === activeRow &&
    firstCorrect.rowItemCounts[activeRow] === 1
  );
  report.assertions.waterBottleAppearsOnShelf = await rowContainsWaterTexture(page, activeRow);

  for (let logicalCount = 2; logicalCount <= itemsPerRow; logicalCount += 1) {
    await waitForInteractionReady(page);
    await clickRowTarget(page, activeRow);
    await waitForRowLogicalCount(page, activeRow, logicalCount);
  }

  await page.waitForFunction(({ sceneKey, row }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now)?.filledRowIndexes?.includes(row) === true;
  }, { sceneKey: SCENE_KEY, row: activeRow }, { timeout: 7000 });
  const afterFirstShelf = await readRushState(page);
  report.assertions.correctShelfCompletesAtConfiguredCount = (
    afterFirstShelf.filledRowIndexes.includes(activeRow)
  );

  while (true) {
    const rush = await readRushState(page);
    if (rush.complete || rush.filledRowIndexes.length === rush.rowItemCounts.length) break;
    const row = rush.activeRowIndex;
    if (!Number.isInteger(row)) throw new Error("Memory sequence lost active row");
    const currentCount = rush.rowItemCounts[row] ?? 0;
    for (let logicalCount = currentCount + 1; logicalCount <= rush.itemsPerRow; logicalCount += 1) {
      await waitForInteractionReady(page);
      await clickRowTarget(page, row);
      await waitForRowLogicalCount(page, row, logicalCount);
    }
    await page.waitForFunction(({ sceneKey, row }) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return scene?.rush?.snapshot?.(scene.time.now)?.filledRowIndexes?.includes(row) === true;
    }, { sceneKey: SCENE_KEY, row }, { timeout: 7000 });
  }

  const final = await readRushState(page);
  report.final = final;
  report.assertions.fullMemorySequenceCompletes = (
    final.complete === true &&
    final.filledRowIndexes.length === final.rowItemCounts.length
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-mature-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) {
    throw new Error(`Level 2 mature memory audit failed: ${failed.join(", ")}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readSceneState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("restock-worker");
    const cart = scene?.children?.getByName?.("restock-cart");
    const caseBox = scene?.children?.getByName?.("restock-case");
    return {
      visualPresetId: scene?.visualPreset?.id ?? null,
      actorControl: document.body.dataset.restockActorControl ?? null,
      levelTwoActorControl: document.body.dataset.levelTwoActorControl ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      navigation: scene?.actors?.navigationSnapshot?.() ?? null,
      worker: worker ? { x: worker.x, y: worker.y, texture: worker.texture?.key ?? null } : null,
      cart: cart ? { x: cart.x, y: cart.y, visible: cart.visible, texture: cart.texture?.key ?? null } : null,
      caseBox: caseBox ? { x: caseBox.x, y: caseBox.y, visible: caseBox.visible, texture: caseBox.texture?.key ?? null } : null
    };
  }, SCENE_KEY);
}

async function readRushState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now) ?? null;
  }, SCENE_KEY);
}

async function rowContainsWaterTexture(page, rowIndex) {
  return page.evaluate(({ sceneKey, rowIndex }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${rowIndex}`);
    return Array.isArray(holder?.list) && holder.list.some((entry) => (
      String(entry?.texture?.key ?? "").includes("product-water-bottle")
    ));
  }, { sceneKey: SCENE_KEY, rowIndex });
}

async function waitForHudAction(page) {
  await page.waitForFunction((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)
      ?.children?.getByName?.("shift-hud-action");
    return Boolean(action?.visible && action?.input?.enabled);
  }, SCENE_KEY, { timeout: 15000 });
}

async function clickHudAction(page) {
  const action = await page.evaluate((sceneKey) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)
      ?.children?.getByName?.("shift-hud-action");
    return object ? { x: object.x, y: object.y } : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Shift HUD action button is missing");
  await clickGame(page, action.x, action.y);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 15000 });
}

async function clickRowTarget(page, rowIndex) {
  const target = await page.evaluate(({ sceneKey, rowIndex }) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)
      ?.children?.getByName?.(`beverage-cooler-row-target-${rowIndex}`);
    return object ? { x: object.x, y: object.y } : null;
  }, { sceneKey: SCENE_KEY, rowIndex });
  if (!target) throw new Error(`Shelf target ${rowIndex} is missing`);
  await clickGame(page, target.x, target.y);
}

async function waitForRowLogicalCount(page, rowIndex, expectedCount) {
  await page.waitForFunction(({ sceneKey, rowIndex, expectedCount }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now)?.rowItemCounts?.[rowIndex] === expectedCount;
  }, { sceneKey: SCENE_KEY, rowIndex, expectedCount }, { timeout: 7000 });
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
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
    if (!error.includes("ERR_ABORTED")) {
      auditReport.failedRequests.push({ url: request.url(), error });
    }
  });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
