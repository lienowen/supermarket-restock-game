import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const WIDTH = 1600;
const HEIGHT = 900;
const SHELF_COUNT = 6;
const ITEMS_PER_SHELF = 3;

const restock = (number, id, label, initial, complete, interactionsPerShelf = ITEMS_PER_SHELF) => Object.freeze({
  number, id, label, mode: "restock", initial, complete, interactionsPerShelf
});
const checkout = (number, id, label, customerCount, initial, complete) => Object.freeze({
  number, id, label, mode: "checkout", customerCount, initial, complete
});
const clean = (number, id, label, spots, initial, complete) => Object.freeze({
  number, id, label, mode: "clean", spots: Object.freeze(spots), initial, complete
});
const findItems = (number, id, label, items, initial, complete) => Object.freeze({
  number, id, label, mode: "find-items", items: Object.freeze(items), initial, complete
});

const LEVELS = Object.freeze([
  restock(1, "starter-level-001", "Cola first delivery",
    { coins: 100, stars: 0 },
    { step: "complete", stockedRows: 6, coins: 200, stars: 1 },
    1),
  restock(2, "starter-level-002", "Water promotion restock",
    { coins: 200, stars: 1 },
    { step: "complete", stockedRows: 6, coins: 320, stars: 2 }),
  checkout(3, "starter-level-003", "Checkout rush", 6,
    { step: "open", customersServed: 0, totalCustomers: 6, coins: 320, stars: 2, reputation: 0 },
    { step: "complete", customersServed: 6, coins: 400, stars: 3, reputation: 5 }),
  clean(4, "starter-level-004", "Spill patrol", [
    { x: 620, y: 742 }, { x: 790, y: 672 }, { x: 970, y: 748 }, { x: 1135, y: 685 }
  ],
  { step: "collect-tools", progress: 0, total: 4, coins: 400, stars: 3, reputation: 5 },
  { step: "complete", progress: 4, coins: 490, stars: 4, reputation: 7 }),
  findItems(5, "starter-level-005", "Order hunt", [
    { productId: "milk-bottle", approach: { x: 520, y: 700 } },
    { productId: "apple", approach: { x: 1180, y: 720 } },
    { productId: "cereal-box", approach: { x: 820, y: 650 } }
  ],
  { step: "find", progress: 0, total: 3, coins: 490, stars: 4, reputation: 7 },
  { step: "complete", progress: 3, coins: 600, stars: 5, reputation: 10 }),
  restock(6, "starter-level-006", "Closing stock sprint",
    { coins: 600, stars: 5 },
    { step: "complete", stockedRows: 6, coins: 740, stars: 6 }),
  checkout(7, "starter-level-007", "Evening checkout", 8,
    { step: "open", customersServed: 0, totalCustomers: 8, coins: 740, stars: 6, reputation: 10 },
    { step: "complete", customersServed: 8, coins: 860, stars: 7, reputation: 16 }),
  clean(8, "starter-level-008", "Closing clean-up", [
    { x: 535, y: 720 }, { x: 680, y: 660 }, { x: 820, y: 742 },
    { x: 955, y: 675 }, { x: 1085, y: 748 }, { x: 1195, y: 690 }
  ],
  { step: "collect-tools", progress: 0, total: 6, coins: 860, stars: 7, reputation: 16 },
  { step: "complete", progress: 6, coins: 990, stars: 8, reputation: 19 }),
  findItems(9, "starter-level-009", "Priority order", [
    { productId: "cereal-box", approach: { x: 820, y: 650 } },
    { productId: "milk-bottle", approach: { x: 520, y: 700 } },
    { productId: "apple", approach: { x: 1180, y: 720 } }
  ],
  { step: "find", progress: 0, total: 3, coins: 990, stars: 8, reputation: 19 },
  { step: "complete", progress: 3, coins: 1140, stars: 9, reputation: 23 }),
  restock(10, "starter-level-010", "Final cooler rush",
    { coins: 1140, stars: 9 },
    { step: "complete", stockedRows: 6, coins: 1340, stars: 11 })
]);

const PRODUCT_POINTS = Object.freeze({
  "milk-bottle": Object.freeze({ x: 330, y: 410 }),
  apple: Object.freeze({ x: 1430, y: 560 }),
  "cereal-box": Object.freeze({ x: 690, y: 432 })
});

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing");
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
  screenshots: [],
  snapshots: [],
  sdkEvents: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  fatalError: null,
  regressions: {
    architectureV3: false,
    productionAssetRuntime: false,
    englishHud: false,
    guidedStationReady: false,
    emptyShelfHasNoGhostProducts: false,
    guidedShelfAutoFillsThreeBottles: false,
    challengeShelvesRequireThreePlacements: false,
    allRestockLevelsRepresentEighteenItems: false,
    level1: false,
    level2: false,
    level3: false,
    level4: false,
    level5: false,
    level6: false,
    level7: false,
    level8: false,
    level9: false,
    level10: false,
    campaignEconomyCarry: false,
    crazyGamesSdkLifecycle: false,
    finalSdkProgress: false
  }
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  await context.addInitScript(() => {
    const events = [];
    window.__CRAZY_GAMES_TEST_EVENTS__ = events;
    window.CrazyGames = {
      SDK: {
        init: async () => events.push("init"),
        game: {
          settings: { muteAudio: false },
          gameplayStart: () => events.push("gameplayStart"),
          gameplayStop: () => events.push("gameplayStop"),
          loadingStart: () => events.push("loadingStart"),
          loadingStop: () => events.push("loadingStop"),
          setGameContext: (value) => events.push(`context:${value.mode ?? value.version ?? "unknown"}`),
          clearGameContext: () => events.push("context:clear"),
          reportGameCompletedPercentage: (value) => events.push(`progress:${value}`),
          addSettingsChangeListener: () => undefined,
          removeSettingsChangeListener: () => undefined
        }
      }
    };
  });

  const initialSnapshots = [];
  const restockTotals = [];
  for (const level of LEVELS) {
    const page = await openLevel(context, level);
    attachListeners(page, report);
    const initial = await readSnapshot(page);
    initialSnapshots.push({ snapshot: initial, expected: level.initial });
    report.snapshots.push({ label: `level${level.number}-initial`, snapshot: initial });

    if (level.number === 1) {
      await waitReady(page);
      const metadata = await readMetadata(page);
      report.regressions.architectureV3 = metadata.architecture === "architecture-v3" && metadata.version === "architecture-v3";
      report.regressions.englishHud = metadata.language === "en";
      report.regressions.productionAssetRuntime = (
        metadata.visualTarget === "production-v1-five-mode-campaign" &&
        metadata.actorType === "Image" &&
        ["cut-restock-worker-idle", "cut-level-one-worker-idle-matte-clean-v2"].includes(metadata.actorTexture) &&
        metadata.actorComposition === "action-pose-and-layered-cart" &&
        metadata.loadVisual === "cart-back-case-cart-front"
      );
      report.regressions.guidedStationReady = (
        metadata.actorControl === "fixed-position-action-swap" &&
        await interactionReady(page)
      );
      await capture(page, screenshotName(level.number, "initial"), `${level.label} initial`);
    } else if (level.number >= 6) {
      await capture(page, screenshotName(level.number, "initial"), `${level.label} initial`);
    }

    const completed = await completeLevel(page, level, level.number === 1);
    report.regressions[`level${level.number}`] = matches(initial, level.initial) && matches(completed, level.complete);
    report.snapshots.push({ label: `level${level.number}-complete`, snapshot: completed });
    await page.waitForTimeout(300);
    await capture(page, screenshotName(level.number, "complete"), `${level.label} complete`);

    if (level.mode === "restock") restockTotals.push((await readRush(page))?.totalItemsStocked ?? 0);
    const events = await page.evaluate(() => [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]);
    report.sdkEvents.push({ level: level.id, events });
    if (level.number === 1) {
      const metadata = await readMetadata(page);
      report.regressions.crazyGamesSdkLifecycle = (
        metadata.sdk === "ready" && metadata.loading === "stopped" && metadata.gameplay === "stopped" &&
        hasOrderedEvents(events, ["init", "loadingStart", "loadingStop", "gameplayStart", "progress:10", "gameplayStop"])
      );
    }
    if (level.number === 10) {
      report.regressions.finalSdkProgress = hasOrderedEvents(events, ["gameplayStart", "progress:100", "gameplayStop"]);
    }
    await page.close();
  }

  report.regressions.campaignEconomyCarry = initialSnapshots.every(({ snapshot, expected }) => matches(snapshot, expected));
  report.regressions.allRestockLevelsRepresentEighteenItems = (
    restockTotals.length === 4 && restockTotals.every((count) => count === SHELF_COUNT * ITEMS_PER_SHELF)
  );

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (failed.length || issueCount) {
    throw new Error(`Production ten-level regressions failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "ui-audit-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ regressions: report.regressions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function openLevel(context, level) {
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/?test=1&level=${encodeURIComponent(level.id)}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(({ id, mode }) => (
    document.body.dataset.gameArchitecture === "architecture-v3" &&
    document.body.dataset.activeLevel === id &&
    document.body.dataset.activeMode === mode &&
    Boolean(window.__IMMERSIVE_GAME__?.scene?.getScene("starter-market-shift"))
  ), { id: level.id, mode: level.mode }, { timeout: 30000 });
  await page.waitForTimeout(750);
  return page;
}

async function completeLevel(page, level, detailedRestock) {
  if (level.mode === "restock") return completeRestock(page, level, detailedRestock);
  if (level.mode === "checkout") return completeCheckout(page, level.customerCount);
  if (level.mode === "clean") return completeClean(page, level.spots);
  return completeFindItems(page, level.items);
}

async function completeRestock(page, level, detailed) {
  await clickGame(page, 1228, 850);
  await waitSnapshot(page, { step: "load", boxCollected: true });

  if (level.number === 1 || level.number === 2) {
    await waitReady(page);
    await clickGame(page, 1228, 850);
    await waitSnapshot(page, { step: "push", boxLoaded: true });
    await waitReady(page);
    await clickGame(page, 1228, 850);
    await waitSnapshot(page, { step: "park", boxLoaded: true });
    await waitReady(page);
    await clickGame(page, 1228, 850);
    await waitSnapshot(page, { step: "open", boxLoaded: true });
    await waitReady(page);
    await clickGame(page, 1228, 850);
  } else {
    await clickGame(page, 1228, 850);
  }

  await waitSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true });
  await waitReady(page);

  const initialRush = await waitRushTarget(page);
  const interactionsPerShelf = initialRush.itemsPerRow;
  const unitsPerInteraction = initialRush.unitsPerInteraction ?? 1;
  const physicalItemsPerShelf = interactionsPerShelf * unitsPerInteraction;
  if (interactionsPerShelf !== level.interactionsPerShelf || physicalItemsPerShelf !== ITEMS_PER_SHELF) {
    throw new Error(`Restock pacing does not match level contract: ${JSON.stringify({
      level: level.id, interactionsPerShelf, unitsPerInteraction, physicalItemsPerShelf
    })}`);
  }

  const firstRow = initialRush.activeRowIndex;
  if (detailed) {
    const empty = await renderedShelf(page, firstRow);
    report.regressions.emptyShelfHasNoGhostProducts = (
      initialRush.totalItemsStocked === 0 &&
      initialRush.rowItemCounts.every((count) => count === 0) &&
      empty.itemCount === 0
    );
    await capture(page, "restock-shelf-empty.png", "Empty shelf before guided stocking");
  }

  for (let completedRows = 0; completedRows < SHELF_COUNT; completedRows += 1) {
    await waitReady(page);
    const rowIndex = (await waitRushTarget(page)).activeRowIndex;
    const target = await renderedTarget(page, rowIndex);

    for (let interaction = 1; interaction <= interactionsPerShelf; interaction += 1) {
      await waitReady(page);
      const beforeController = detailed ? await readSnapshot(page) : null;
      await clickGame(page, target.x, target.y);
      const physicalCount = interaction * unitsPerInteraction;
      await waitRowCount(page, rowIndex, interaction, physicalCount);

      if (detailed && completedRows === 0) {
        const afterController = await readSnapshot(page);
        const rush = await readRush(page);
        const shelf = await renderedShelf(page, rowIndex);
        await capture(
          page,
          `restock-shelf-${physicalCount}-of-${ITEMS_PER_SHELF}.png`,
          `Physical shelf growth ${physicalCount}/${ITEMS_PER_SHELF}`
        );
        if (interactionsPerShelf === 1) {
          report.regressions.guidedShelfAutoFillsThreeBottles = (
            beforeController.stockedRows === completedRows &&
            afterController.stockedRows === completedRows + 1 &&
            shelf.itemCount === ITEMS_PER_SHELF &&
            rush.totalItemsStocked === ITEMS_PER_SHELF &&
            rush.filledRowIndexes.includes(rowIndex)
          );
        }
      }
    }
    await waitSnapshot(page, { stockedRows: completedRows + 1 });
  }

  const complete = await waitSnapshot(page, { step: "complete", stockedRows: SHELF_COUNT });
  const rush = await readRush(page);
  const renderedShelves = await Promise.all(
    Array.from({ length: SHELF_COUNT }, (_, rowIndex) => renderedShelf(page, rowIndex))
  );
  if (
    rush.totalItemsStocked !== SHELF_COUNT * ITEMS_PER_SHELF ||
    !renderedShelves.every((shelf) => shelf.itemCount === ITEMS_PER_SHELF)
  ) {
    throw new Error(`Restock completed without eighteen visible products: ${JSON.stringify({
      rush, renderedShelves
    })}`);
  }
  if (interactionsPerShelf === ITEMS_PER_SHELF && unitsPerInteraction === 1) {
    report.regressions.challengeShelvesRequireThreePlacements = (
      rush.rowItemCounts.every((count) => count === ITEMS_PER_SHELF)
    );
  }
  return complete;
}

async function completeCheckout(page, customerCount) {
  await movePlayer(page, { x: 900, y: 690 });
  await waitReady(page);
  await clickGame(page, 1035, 690);
  await waitSnapshot(page, { step: "serve" });
  for (let index = 0; index < customerCount; index += 1) {
    await waitReady(page);
    await clickGame(page, 1035, 690);
    await waitSnapshot(page, { customersServed: index + 1 });
  }
  return waitSnapshot(page, { step: "complete", customersServed: customerCount });
}

async function completeClean(page, spots) {
  await moveAndInteract(page, { x: 1060, y: 760 }, { x: 1190, y: 760 });
  await waitSnapshot(page, { step: "clean" });
  for (let index = 0; index < spots.length; index += 1) {
    await moveAndInteract(page, spots[index], spots[index]);
    await waitSnapshot(page, { progress: index + 1 });
  }
  return waitSnapshot(page, { step: "complete", progress: spots.length });
}

async function completeFindItems(page, items) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await movePlayer(page, item.approach);
    await waitReady(page);
    await clickGame(page, PRODUCT_POINTS[item.productId].x, PRODUCT_POINTS[item.productId].y);
    await waitSnapshot(page, { progress: index + 1 });
  }
  return waitSnapshot(page, { step: "complete", progress: items.length });
}

async function moveAndInteract(page, approach, target) {
  await movePlayer(page, approach);
  await waitReady(page);
  await clickGame(page, target.x, target.y);
}

async function movePlayer(page, point) {
  await clickGame(page, point.x, point.y);
  await page.waitForFunction(({ point, sceneKey }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const position = scene?.playerPosition?.();
    return position && Math.hypot(position.x - point.x, position.y - point.y) <= 10;
  }, { point, sceneKey: SCENE_KEY }, { timeout: 20000 });
}

async function waitReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 20000 });
}

async function waitRushTarget(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Number.isInteger(scene?.rush?.snapshot?.(scene.time.now)?.activeRowIndex);
  }, SCENE_KEY, { timeout: 20000 });
  return readRush(page);
}

async function waitRowCount(page, rowIndex, logicalCount, physicalCount) {
  await page.waitForFunction(({ sceneKey, rowIndex, logicalCount, physicalCount }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${rowIndex}`);
    return (
      rush?.rowItemCounts?.[rowIndex] === logicalCount &&
      Array.isArray(holder?.list) &&
      holder.list.length === physicalCount
    );
  }, { sceneKey: SCENE_KEY, rowIndex, logicalCount, physicalCount }, { timeout: 10000 });
}

async function waitSnapshot(page, expected) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return snapshot && Object.entries(expected).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: SCENE_KEY, expected }, { timeout: 20000 });
  return readSnapshot(page);
}

async function readSnapshot(page) {
  return page.evaluate((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.() ?? null, SCENE_KEY);
}

async function readRush(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now) ?? null;
  }, SCENE_KEY);
}

async function renderedShelf(page, rowIndex) {
  return page.evaluate(({ sceneKey, rowIndex }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${rowIndex}`);
    const label = scene?.children?.getByName?.(`beverage-cooler-row-count-${rowIndex}`);
    return { itemCount: Array.isArray(holder?.list) ? holder.list.length : -1, countText: label?.text ?? null };
  }, { sceneKey: SCENE_KEY, rowIndex });
}

async function renderedTarget(page, rowIndex) {
  const target = await page.evaluate(({ sceneKey, rowIndex }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const object = scene?.children?.getByName?.(`beverage-cooler-row-target-${rowIndex}`);
    return object ? { x: object.x, y: object.y, enabled: Boolean(object.input?.enabled) } : null;
  }, { sceneKey: SCENE_KEY, rowIndex });
  if (!target?.enabled) throw new Error(`Shelf target ${rowIndex} is not ready`);
  return target;
}

async function readMetadata(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const actor = scene?.children?.getByName?.("restock-worker");
    return {
      architecture: document.body.dataset.gameArchitecture,
      version: document.body.dataset.gameVersion,
      visualTarget: document.body.dataset.visualTarget,
      language: document.body.dataset.uiLanguage,
      actorType: actor?.type,
      actorTexture: actor?.texture?.key,
      actorComposition: document.body.dataset.restockActorComposition,
      actorControl: document.body.dataset.restockActorControl,
      loadVisual: document.body.dataset.restockLoadVisual,
      sdk: document.body.dataset.crazyGamesSdk,
      loading: document.body.dataset.crazyGamesLoading,
      gameplay: document.body.dataset.crazyGamesGameplay
    };
  }, SCENE_KEY);
}

async function interactionReady(page) {
  return page.evaluate((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  await page.mouse.click(box.x + gameX / WIDTH * box.width, box.y + gameY / HEIGHT * box.height);
}

async function capture(page, filename, label) {
  await page.screenshot({ path: join(OUTPUT_DIR, filename), fullPage: true });
  report.screenshots.push({ filename, label });
}

function attachListeners(page, target) {
  page.on("console", (message) => {
    if (message.type() === "error") target.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => target.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push({ url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) target.badResponses.push({ url: response.url(), status: response.status() });
  });
}

function matches(value, expected) {
  return Boolean(value) && Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

function hasOrderedEvents(events, expected) {
  let cursor = 0;
  for (const event of events) {
    if (event === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return true;
  }
  return false;
}

function screenshotName(level, phase) {
  return `${String(level).padStart(2, "0")}-level${level}-${phase}.png`;
}

function mimeType(path) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml"
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
