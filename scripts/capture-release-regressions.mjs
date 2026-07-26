import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const ITEMS_PER_SHELF = 3;
const SHELF_COUNT = 6;

const PRODUCT_DISPLAYS = Object.freeze({
  "milk-bottle": Object.freeze({ x: 330, y: 410 }),
  apple: Object.freeze({ x: 1430, y: 560 }),
  "cereal-box": Object.freeze({ x: 690, y: 432 })
});

const LEVELS = Object.freeze([
  Object.freeze({
    number: 1,
    id: "starter-level-001",
    mode: "restock",
    label: "Cola first delivery",
    initial: { coins: 100, stars: 0 },
    complete: { step: "complete", stockedRows: 6, coins: 200, stars: 1 }
  }),
  Object.freeze({
    number: 2,
    id: "starter-level-002",
    mode: "restock",
    label: "Water promotion restock",
    initial: { coins: 200, stars: 1 },
    complete: { step: "complete", stockedRows: 6, coins: 320, stars: 2 }
  }),
  Object.freeze({
    number: 3,
    id: "starter-level-003",
    mode: "checkout",
    label: "Checkout rush",
    customerCount: 6,
    initial: {
      step: "open",
      customersServed: 0,
      totalCustomers: 6,
      coins: 320,
      stars: 2,
      reputation: 0
    },
    complete: {
      step: "complete",
      customersServed: 6,
      coins: 400,
      stars: 3,
      reputation: 5
    }
  }),
  Object.freeze({
    number: 4,
    id: "starter-level-004",
    mode: "clean",
    label: "Spill patrol",
    spots: Object.freeze([
      Object.freeze({ x: 620, y: 742 }),
      Object.freeze({ x: 790, y: 672 }),
      Object.freeze({ x: 970, y: 748 }),
      Object.freeze({ x: 1135, y: 685 })
    ]),
    initial: {
      step: "collect-tools",
      progress: 0,
      total: 4,
      coins: 400,
      stars: 3,
      reputation: 5
    },
    complete: {
      step: "complete",
      progress: 4,
      coins: 490,
      stars: 4,
      reputation: 7
    }
  }),
  Object.freeze({
    number: 5,
    id: "starter-level-005",
    mode: "find-items",
    label: "Order hunt",
    items: Object.freeze([
      Object.freeze({ productId: "milk-bottle", approach: Object.freeze({ x: 520, y: 700 }) }),
      Object.freeze({ productId: "apple", approach: Object.freeze({ x: 1180, y: 720 }) }),
      Object.freeze({ productId: "cereal-box", approach: Object.freeze({ x: 820, y: 650 }) })
    ]),
    initial: {
      step: "find",
      progress: 0,
      total: 3,
      coins: 490,
      stars: 4,
      reputation: 7
    },
    complete: {
      step: "complete",
      progress: 3,
      coins: 600,
      stars: 5,
      reputation: 10
    }
  }),
  Object.freeze({
    number: 6,
    id: "starter-level-006",
    mode: "restock",
    label: "Closing stock sprint",
    initial: { coins: 600, stars: 5 },
    complete: { step: "complete", stockedRows: 6, coins: 740, stars: 6 }
  }),
  Object.freeze({
    number: 7,
    id: "starter-level-007",
    mode: "checkout",
    label: "Evening checkout",
    customerCount: 8,
    initial: {
      step: "open",
      customersServed: 0,
      totalCustomers: 8,
      coins: 740,
      stars: 6,
      reputation: 10
    },
    complete: {
      step: "complete",
      customersServed: 8,
      coins: 860,
      stars: 7,
      reputation: 16
    }
  }),
  Object.freeze({
    number: 8,
    id: "starter-level-008",
    mode: "clean",
    label: "Closing clean-up",
    spots: Object.freeze([
      Object.freeze({ x: 535, y: 720 }),
      Object.freeze({ x: 680, y: 660 }),
      Object.freeze({ x: 820, y: 742 }),
      Object.freeze({ x: 955, y: 675 }),
      Object.freeze({ x: 1085, y: 748 }),
      Object.freeze({ x: 1195, y: 690 })
    ]),
    initial: {
      step: "collect-tools",
      progress: 0,
      total: 6,
      coins: 860,
      stars: 7,
      reputation: 16
    },
    complete: {
      step: "complete",
      progress: 6,
      coins: 990,
      stars: 8,
      reputation: 19
    }
  }),
  Object.freeze({
    number: 9,
    id: "starter-level-009",
    mode: "find-items",
    label: "Priority order",
    items: Object.freeze([
      Object.freeze({ productId: "cereal-box", approach: Object.freeze({ x: 820, y: 650 }) }),
      Object.freeze({ productId: "milk-bottle", approach: Object.freeze({ x: 520, y: 700 }) }),
      Object.freeze({ productId: "apple", approach: Object.freeze({ x: 1180, y: 720 }) })
    ]),
    initial: {
      step: "find",
      progress: 0,
      total: 3,
      coins: 990,
      stars: 8,
      reputation: 19
    },
    complete: {
      step: "complete",
      progress: 3,
      coins: 1140,
      stars: 9,
      reputation: 23
    }
  }),
  Object.freeze({
    number: 10,
    id: "starter-level-010",
    mode: "restock",
    label: "Final cooler rush",
    initial: { coins: 1140, stars: 9 },
    complete: { step: "complete", stockedRows: 6, coins: 1340, stars: 11 }
  })
]);

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
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  sdkEvents: [],
  snapshots: [],
  fatalError: null,
  regressions: {
    architectureV3: false,
    productionAssetRuntime: false,
    englishHud: false,
    movementRequired: false,
    emptyShelfHasNoGhostProducts: false,
    shelfBuildsOneItemAtATime: false,
    threeItemsRequiredPerShelf: false,
    allRestockLevelsStockEighteenItems: false,
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
  const context = await browser.newContext({
    viewport: { width: GAME_WIDTH, height: GAME_HEIGHT },
    deviceScaleFactor: 1
  });

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
  const restockItemTotals = [];

  for (const level of LEVELS) {
    const page = await openLevel(context, report, level);
    const initial = await readSnapshot(page);
    initialSnapshots.push({ level: level.id, snapshot: initial, expected: level.initial });
    recordSnapshot(report, `level${level.number}-initial`, initial);

    if (level.number === 1) {
      const runtimeMetadata = await readRuntimeMetadata(page);
      report.regressions.architectureV3 = (
        runtimeMetadata.architecture === "architecture-v3" &&
        runtimeMetadata.version === "architecture-v3"
      );
      report.regressions.englishHud = runtimeMetadata.language === "en";
      report.regressions.productionAssetRuntime = (
        runtimeMetadata.visualTarget === "production-v1-five-mode-campaign" &&
        runtimeMetadata.actorType === "Image" &&
        runtimeMetadata.actorTexture === "worker-a-idle"
      );
      report.regressions.movementRequired = await interactionReady(page) === false;
      await capture(page, report, screenshotName(level.number, "initial"), `${level.label} initial state`);
    } else if (level.number >= 6) {
      await capture(page, report, screenshotName(level.number, "initial"), `${level.label} initial state`);
    }

    const completed = await completeConfiguredLevel(page, report, level);
    report.regressions[`level${level.number}`] = (
      matches(initial, level.initial) && matches(completed, level.complete)
    );
    recordSnapshot(report, `level${level.number}-complete`, completed);
    await page.waitForTimeout(360);
    await capture(page, report, screenshotName(level.number, "complete"), `${level.label} complete`);

    if (level.mode === "restock") {
      const finalRush = await readRushState(page);
      restockItemTotals.push(finalRush?.totalItemsStocked ?? 0);
    }

    const events = await readSdkEvents(page);
    report.sdkEvents.push({ level: level.id, events });
    if (level.number === 1) {
      const runtimeMetadata = await readRuntimeMetadata(page);
      report.regressions.crazyGamesSdkLifecycle = (
        runtimeMetadata.sdk === "ready" &&
        runtimeMetadata.loading === "stopped" &&
        runtimeMetadata.gameplay === "stopped" &&
        hasOrderedEvents(events, [
          "init",
          "loadingStart",
          "loadingStop",
          "gameplayStart",
          "progress:10",
          "gameplayStop"
        ])
      );
    }
    if (level.number === 10) {
      report.regressions.finalSdkProgress = hasOrderedEvents(events, [
        "gameplayStart",
        "progress:100",
        "gameplayStop"
      ]);
    }
    await page.close();
  }

  report.regressions.campaignEconomyCarry = initialSnapshots.every(({ snapshot, expected }) => (
    matches(snapshot, expected)
  ));
  report.regressions.allRestockLevelsStockEighteenItems = (
    restockItemTotals.length === 4 &&
    restockItemTotals.every((count) => count === SHELF_COUNT * ITEMS_PER_SHELF)
  );

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (issueCount > 0 || failed.length > 0) {
    throw new Error(`Production ten-level regressions failed: ${failed.join(", ") || "browser runtime"}; browser issues ${issueCount}`);
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

async function openLevel(context, auditReport, level) {
  const page = await context.newPage();
  attachRuntimeListeners(page, auditReport);
  const url = `${ORIGIN}/?test=1&level=${encodeURIComponent(level.id)}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await waitForGame(page, level.id, level.mode);
  return page;
}

async function completeConfiguredLevel(page, auditReport, level) {
  switch (level.mode) {
    case "restock":
      return completeRestockLevel(page, auditReport, `level${level.number}`, level.number === 1);
    case "checkout":
      return completeCheckoutLevel(page, level.customerCount);
    case "clean":
      return completeCleanLevel(page, level.spots);
    case "find-items":
      return completeFindItemsLevel(page, level.items);
    default:
      throw new Error(`Unsupported audit mode: ${level.mode}`);
  }
}

async function completeRestockLevel(page, auditReport, prefix, captureGrowth) {
  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true });

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true });

  const initialRush = await waitForRushTarget(page);
  const firstRowIndex = initialRush.activeRowIndex;
  const emptyShelf = await readRenderedShelf(page, firstRowIndex);
  if (captureGrowth) {
    auditReport.regressions.emptyShelfHasNoGhostProducts = (
      initialRush.totalItemsStocked === 0 &&
      initialRush.rowItemCounts.every((count) => count === 0) &&
      emptyShelf.itemCount === 0
    );
    await capture(page, auditReport, "restock-shelf-0-of-3.png", "Empty shelf before physical stocking");
  }

  for (let completedRows = 0; completedRows < SHELF_COUNT; completedRows += 1) {
    const rowStart = await waitForRushTarget(page);
    const rowIndex = rowStart.activeRowIndex;
    const target = await readRushTarget(page, rowIndex);

    for (let itemNumber = 1; itemNumber <= ITEMS_PER_SHELF; itemNumber += 1) {
      await waitForInteractionReady(page);
      const beforeRush = await readRushState(page);
      const beforeController = await readSnapshot(page);
      await clickGame(page, target.x, target.y);
      await waitForRushItemCount(page, rowIndex, itemNumber);
      await page.waitForTimeout(60);

      const afterController = await readSnapshot(page);
      const afterRush = await readRushState(page);
      const renderedShelf = await readRenderedShelf(page, rowIndex);
      recordSnapshot(auditReport, `${prefix}-row-${completedRows + 1}-item-${itemNumber}`, {
        selectedRowIndex: rowIndex,
        target,
        beforeRush,
        afterRush,
        beforeController,
        afterController,
        renderedShelf
      });

      if (renderedShelf.itemCount !== itemNumber) {
        throw new Error(`Shelf ${rowIndex} rendered ${renderedShelf.itemCount} items after item ${itemNumber}`);
      }
      if (afterRush?.rowItemCounts?.[rowIndex] !== itemNumber) {
        throw new Error(`Shelf ${rowIndex} state did not reach ${itemNumber}/${ITEMS_PER_SHELF}`);
      }

      const expectedCompletedRows = itemNumber === ITEMS_PER_SHELF
        ? completedRows + 1
        : completedRows;
      if (afterController?.stockedRows !== expectedCompletedRows) {
        throw new Error(
          `Shelf completion advanced at the wrong item: ` +
          JSON.stringify({ completedRows, itemNumber, expectedCompletedRows, afterController, afterRush })
        );
      }
      if (itemNumber < ITEMS_PER_SHELF && afterRush.activeRowIndex !== rowIndex) {
        throw new Error(`Shelf target changed before reaching ${ITEMS_PER_SHELF} products`);
      }

      if (captureGrowth && completedRows === 0) {
        await capture(
          page,
          auditReport,
          `restock-shelf-${itemNumber}-of-3.png`,
          `Physical shelf growth ${itemNumber}/${ITEMS_PER_SHELF}`
        );
        if (itemNumber === 1) {
          auditReport.regressions.shelfBuildsOneItemAtATime = (
            beforeController.stockedRows === 0 &&
            afterController.stockedRows === 0 &&
            renderedShelf.itemCount === 1
          );
        }
        if (itemNumber === ITEMS_PER_SHELF) {
          auditReport.regressions.threeItemsRequiredPerShelf = (
            afterController.stockedRows === 1 &&
            renderedShelf.itemCount === ITEMS_PER_SHELF &&
            afterRush.filledRowIndexes.includes(rowIndex)
          );
        }
      }
    }
  }

  const complete = await waitForSnapshot(page, { step: "complete", stockedRows: SHELF_COUNT });
  const finalRush = await readRushState(page);
  if (
    finalRush.totalItemsStocked !== SHELF_COUNT * ITEMS_PER_SHELF ||
    !finalRush.rowItemCounts.every((count) => count === ITEMS_PER_SHELF)
  ) {
    throw new Error(`Restock completed without eighteen physical products: ${JSON.stringify(finalRush)}`);
  }
  return complete;
}

async function completeCheckoutLevel(page, customerCount) {
  await movePlayerByTap(page, { x: 900, y: 690 });
  await waitForInteractionReady(page);
  await clickGame(page, 1035, 690);
  await waitForSnapshot(page, { step: "serve" });

  for (let order = 0; order < customerCount; order += 1) {
    await waitForInteractionReady(page);
    await clickGame(page, 1035, 690);
    await waitForSnapshot(page, { customersServed: order + 1 });
  }
  return waitForSnapshot(page, { step: "complete", customersServed: customerCount });
}

async function completeCleanLevel(page, spots) {
  await moveNearAndInteract(page, { x: 1060, y: 760 }, { x: 1190, y: 760 });
  await waitForSnapshot(page, { step: "clean" });

  for (let index = 0; index < spots.length; index += 1) {
    const spot = spots[index];
    await moveNearAndInteract(page, spot, spot);
    await waitForSnapshot(page, { progress: index + 1 });
  }
  return waitForSnapshot(page, { step: "complete", progress: spots.length });
}

async function completeFindItemsLevel(page, items) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const display = PRODUCT_DISPLAYS[item.productId];
    if (!display) throw new Error(`Missing audit display point for ${item.productId}`);
    await movePlayerByTap(page, item.approach);
    await waitForInteractionReady(page);
    await clickGame(page, display.x, display.y);
    await waitForSnapshot(page, { progress: index + 1 });
  }
  return waitForSnapshot(page, { step: "complete", progress: items.length });
}

async function moveNearAndInteract(page, approach, target) {
  await movePlayerByTap(page, approach);
  await waitForInteractionReady(page);
  await clickGame(page, target.x, target.y);
}

async function readRuntimeMetadata(page) {
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
      sdk: document.body.dataset.crazyGamesSdk,
      loading: document.body.dataset.crazyGamesLoading,
      gameplay: document.body.dataset.crazyGamesGameplay
    };
  }, GAME_SCENE_KEY);
}

function attachRuntimeListeners(page, auditReport) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      auditReport.consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => auditReport.pageErrors.push({ message: error.message, stack: error.stack ?? null }));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) auditReport.badResponses.push({ url: response.url(), status: response.status() });
  });
}

async function waitForGame(page, levelId, mode) {
  await waitForCanvas(page);
  await page.waitForFunction(
    ({ expectedLevelId, expectedMode }) => (
      document.body.dataset.gameArchitecture === "architecture-v3" &&
      document.body.dataset.gameScene === "starter-market" &&
      document.body.dataset.activeLevel === expectedLevelId &&
      document.body.dataset.activeMode === expectedMode
    ),
    { expectedLevelId: levelId, expectedMode: mode },
    { timeout: 30000 }
  );
  await page.waitForFunction(
    (sceneKey) => Boolean(window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)),
    GAME_SCENE_KEY,
    { timeout: 15000 }
  );
}

async function readSnapshot(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.() ?? null;
  }, GAME_SCENE_KEY);
}

async function readRushState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now) ?? null;
  }, GAME_SCENE_KEY);
}

async function readRenderedShelf(page, rowIndex) {
  return page.evaluate(({ sceneKey, index }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${index}`);
    const countLabel = scene?.children?.getByName?.(`beverage-cooler-row-count-${index}`);
    return {
      itemCount: Array.isArray(holder?.list) ? holder.list.length : -1,
      countText: countLabel?.text ?? null,
      countVisible: countLabel?.visible ?? false
    };
  }, { sceneKey: GAME_SCENE_KEY, index: rowIndex });
}

async function waitForRushItemCount(page, rowIndex, expectedCount) {
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

async function readRushTarget(page, rowIndex) {
  const target = await page.evaluate(({ sceneKey, index }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rowTarget = scene?.children?.getByName?.(`beverage-cooler-row-target-${index}`);
    if (!rowTarget || !Number.isFinite(rowTarget.x) || !Number.isFinite(rowTarget.y)) return null;
    return {
      x: rowTarget.x,
      y: rowTarget.y,
      width: rowTarget.displayWidth ?? rowTarget.width ?? 0,
      height: rowTarget.displayHeight ?? rowTarget.height ?? 0,
      interactionEnabled: Boolean(rowTarget.input?.enabled)
    };
  }, { sceneKey: GAME_SCENE_KEY, index: rowIndex });

  if (!target) throw new Error(`Missing rendered cooler target for row ${rowIndex}`);
  if (!target.interactionEnabled) {
    throw new Error(`Rendered cooler target for row ${rowIndex} is not interactive`);
  }
  return target;
}

async function readSdkEvents(page) {
  return page.evaluate(() => [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]);
}

async function interactionReady(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY);
}

async function waitForRushTarget(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.rush?.snapshot?.(scene.time.now);
    return Number.isInteger(snapshot?.activeRowIndex);
  }, GAME_SCENE_KEY, { timeout: 15000 });
  return readRushState(page);
}

async function waitForSnapshot(page, expected) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout: 20000 });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY, { timeout: 20000 });
}

async function movePlayerByTap(page, point) {
  await clickGame(page, point.x, point.y);
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const position = scene?.playerPosition?.();
    if (!position) return false;
    return Math.hypot(position.x - target.x, position.y - target.y) <= 10;
  }, { sceneKey: GAME_SCENE_KEY, target: point }, { timeout: 20000 });
}

function recordSnapshot(auditReport, label, snapshot) {
  auditReport.snapshots.push({ label, snapshot });
}

function matches(value, expected) {
  if (!value) return false;
  return Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

function hasOrderedEvents(events, expected) {
  let cursor = 0;
  for (const event of events) {
    if (event === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return true;
  }
  return false;
}

function screenshotName(levelNumber, phase) {
  return `${String(levelNumber).padStart(2, "0")}-level${levelNumber}-${phase}.png`;
}

async function waitForCanvas(page) {
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction((selector) => {
    const canvas = document.querySelector(selector);
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  }, GAME_CANVAS_SELECTOR, { timeout: 45000 });
  await page.waitForTimeout(850);
}

async function gamePoint(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  return {
    x: box.x + (gameX / GAME_WIDTH) * box.width,
    y: box.y + (gameY / GAME_HEIGHT) * box.height
  };
}

async function clickGame(page, gameX, gameY) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function capture(page, auditReport, filename, label) {
  await page.screenshot({ path: join(OUTPUT_DIR, filename), fullPage: true });
  auditReport.screenshots.push({ filename, label });
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
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav"
  }[extension] ?? "application/octet-stream";
}
