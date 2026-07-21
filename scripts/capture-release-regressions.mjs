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

const LEVELS = {
  restockCola: { id: "starter-level-001", mode: "restock" },
  restockWater: { id: "starter-level-002", mode: "restock" },
  checkout: { id: "starter-level-003", mode: "checkout" },
  clean: { id: "starter-level-004", mode: "clean" },
  findItems: { id: "starter-level-005", mode: "find-items" }
};

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
    colaRestock: false,
    waterRestock: false,
    checkoutLevel: false,
    cleanLevel: false,
    findItemsLevel: false,
    campaignEconomyCarry: false,
    crazyGamesSdkLifecycle: false
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

  const colaPage = await openLevel(context, report, LEVELS.restockCola);
  const runtimeMetadata = await colaPage.evaluate((sceneKey) => {
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

  const colaInitial = await readSnapshot(colaPage);
  report.regressions.movementRequired = await interactionReady(colaPage) === false;
  recordSnapshot(report, "level1-initial", colaInitial);
  await capture(colaPage, report, "01-level1-production.png", "Production PNG restock level");

  const colaComplete = await completeRestockLevel(colaPage, report, "level1");
  report.regressions.colaRestock = matches(colaComplete, {
    step: "complete",
    stockedRows: 6,
    coins: 200,
    stars: 1
  });
  await colaPage.waitForTimeout(420);
  await capture(colaPage, report, "02-level1-complete.png", "Cola restock rush complete");
  const colaEvents = await readSdkEvents(colaPage);
  report.sdkEvents.push({ level: LEVELS.restockCola.id, events: colaEvents });
  report.regressions.crazyGamesSdkLifecycle = (
    runtimeMetadata.sdk === "ready" &&
    runtimeMetadata.loading === "stopped" &&
    runtimeMetadata.gameplay === "started" &&
    hasOrderedEvents(colaEvents, [
      "init",
      "loadingStart",
      "loadingStop",
      "gameplayStart",
      "progress:20",
      "gameplayStop"
    ])
  );
  await colaPage.close();

  const waterPage = await openLevel(context, report, LEVELS.restockWater);
  const waterInitial = await readSnapshot(waterPage);
  const waterComplete = await completeRestockLevel(waterPage, report, "level2");
  report.regressions.waterRestock = (
    matches(waterInitial, { coins: 200, stars: 1 }) &&
    matches(waterComplete, { step: "complete", stockedRows: 6, coins: 320, stars: 2 })
  );
  recordSnapshot(report, "level2-complete", waterComplete);
  await capture(waterPage, report, "03-level2-complete.png", "Water promotion restock rush complete");
  await waterPage.close();

  const checkoutPage = await openLevel(context, report, LEVELS.checkout);
  const checkoutInitial = await readSnapshot(checkoutPage);
  await capture(checkoutPage, report, "04-level3-checkout-initial.png", "Right-side checkout and left customer queue");
  await movePlayerByTap(checkoutPage, { x: 900, y: 690 });
  await waitForInteractionReady(checkoutPage);
  await clickGame(checkoutPage, 1035, 690);
  await waitForSnapshot(checkoutPage, { step: "serve" });
  for (let customer = 0; customer < 6; customer += 1) {
    await waitForInteractionReady(checkoutPage);
    await clickGame(checkoutPage, 1035, 690);
    await waitForSnapshot(checkoutPage, { customersServed: customer + 1 });
  }
  const checkoutComplete = await waitForSnapshot(checkoutPage, {
    step: "complete",
    customersServed: 6,
    coins: 400,
    stars: 3,
    reputation: 5
  });
  report.regressions.checkoutLevel = (
    matches(checkoutInitial, {
      step: "open",
      customersServed: 0,
      totalCustomers: 6,
      coins: 320,
      stars: 2,
      reputation: 0
    }) && matches(checkoutComplete, {
      step: "complete",
      coins: 400,
      stars: 3,
      reputation: 5
    })
  );
  recordSnapshot(report, "level3-complete", checkoutComplete);
  await capture(checkoutPage, report, "05-level3-checkout-complete.png", "Checkout queue complete");
  await checkoutPage.close();

  const cleanPage = await openLevel(context, report, LEVELS.clean);
  const cleanInitial = await readSnapshot(cleanPage);
  await capture(cleanPage, report, "06-level4-clean-initial.png", "Cleaning gameplay with four dynamic spills");
  await moveNearAndInteract(cleanPage, { x: 1040, y: 620 }, { x: 1120, y: 620 });
  await waitForSnapshot(cleanPage, { step: "clean" });
  const cleanSpots = [
    { x: 690, y: 590 },
    { x: 865, y: 700 },
    { x: 1035, y: 535 },
    { x: 1145, y: 735 }
  ];
  for (let index = 0; index < cleanSpots.length; index += 1) {
    const spot = cleanSpots[index];
    await moveNearAndInteract(cleanPage, spot, spot);
    await waitForSnapshot(cleanPage, { progress: index + 1 });
  }
  const cleanComplete = await waitForSnapshot(cleanPage, {
    step: "complete",
    progress: 4,
    coins: 490,
    stars: 4,
    reputation: 7
  });
  report.regressions.cleanLevel = (
    matches(cleanInitial, {
      step: "collect-tools",
      progress: 0,
      total: 4,
      coins: 400,
      stars: 3,
      reputation: 5
    }) && matches(cleanComplete, {
      step: "complete",
      coins: 490,
      stars: 4,
      reputation: 7
    })
  );
  recordSnapshot(report, "level4-complete", cleanComplete);
  await capture(cleanPage, report, "07-level4-clean-complete.png", "All four spills cleaned");
  await cleanPage.close();

  const findPage = await openLevel(context, report, LEVELS.findItems);
  const findInitial = await readSnapshot(findPage);
  await capture(findPage, report, "08-level5-find-initial.png", "Find-items gameplay with dynamic order targets");
  const findTargets = [
    { target: { x: 1010, y: 480 }, approach: { x: 855, y: 480 } },
    { target: { x: 1125, y: 610 }, approach: { x: 970, y: 610 } },
    { target: { x: 1190, y: 505 }, approach: { x: 1035, y: 505 } }
  ];
  for (let index = 0; index < findTargets.length; index += 1) {
    const entry = findTargets[index];
    await moveNearAndInteract(findPage, entry.approach, entry.target);
    await waitForSnapshot(findPage, { progress: index + 1 });
  }
  const findComplete = await waitForSnapshot(findPage, {
    step: "complete",
    progress: 3,
    coins: 600,
    stars: 5,
    reputation: 10
  });
  report.regressions.findItemsLevel = (
    matches(findInitial, {
      step: "find",
      progress: 0,
      total: 3,
      coins: 490,
      stars: 4,
      reputation: 7
    }) && matches(findComplete, {
      step: "complete",
      coins: 600,
      stars: 5,
      reputation: 10
    })
  );
  report.regressions.campaignEconomyCarry = (
    matches(waterInitial, { coins: 200, stars: 1 }) &&
    matches(checkoutInitial, { coins: 320, stars: 2, reputation: 0 }) &&
    matches(cleanInitial, { coins: 400, stars: 3, reputation: 5 }) &&
    matches(findInitial, { coins: 490, stars: 4, reputation: 7 })
  );
  recordSnapshot(report, "level5-complete", findComplete);
  await capture(findPage, report, "09-level5-find-complete.png", "Five-level campaign complete");
  await findPage.close();

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (issueCount > 0 || failed.length > 0) {
    throw new Error(`Production five-level regressions failed: ${failed.join(", ") || "browser runtime"}; browser issues ${issueCount}`);
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

async function completeRestockLevel(page, auditReport, prefix) {
  // Use the persistent task button for the setup tutorial. It proves the
  // player can always recover even when the world target is partially hidden.
  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true });

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true });

  for (let progress = 0; progress < 6; progress += 1) {
    await waitForInteractionReady(page);
    const rush = await waitForRushTarget(page);
    const rowIndex = rush.activeRowIndex;
    await clickGame(page, 1325, 400 + rowIndex * 55);
    await waitForSnapshot(page, { stockedRows: progress + 1 });
  }

  const completed = await waitForSnapshot(page, { step: "complete", stockedRows: 6 });
  recordSnapshot(auditReport, `${prefix}-complete`, completed);
  return completed;
}

async function moveNearAndInteract(page, approach, target) {
  await movePlayerByTap(page, approach);
  await waitForInteractionReady(page);
  await clickGame(page, target.x, target.y);
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
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.rush?.snapshot?.(scene.time.now) ?? null;
  }, GAME_SCENE_KEY);
}

async function waitForSnapshot(page, expected) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout: 15000 });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY, { timeout: 15000 });
}

async function movePlayerByTap(page, point) {
  await clickGame(page, point.x, point.y);
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const position = scene?.playerPosition?.();
    if (!position) return false;
    return Math.hypot(position.x - target.x, position.y - target.y) <= 10;
  }, { sceneKey: GAME_SCENE_KEY, target: point }, { timeout: 15000 });
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
