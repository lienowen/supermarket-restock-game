import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/?test=1`;
const DAY_TWO_URL = `http://127.0.0.1:${PORT}/?test=1&level=starter-level-002`;
const CHECKOUT_URL = `http://127.0.0.1:${PORT}/?test=1&level=starter-level-003`;
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
    englishHud: false,
    initialState: false,
    collectCase: false,
    loadCart: false,
    cartTravel: false,
    parkCart: false,
    openCase: false,
    rowRestock: false,
    completionReward: false,
    crazyGamesSdkLifecycle: false,
    dayTwoSharedScene: false,
    checkoutLevel: false,
    campaignEconomyCarry: false
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
          setGameContext: (value) => events.push(`context:${value.version ?? "unknown"}`),
          clearGameContext: () => events.push("context:clear"),
          reportGameCompletedPercentage: (value) => events.push(`progress:${value}`),
          addSettingsChangeListener: () => undefined,
          removeSettingsChangeListener: () => undefined
        }
      }
    };
  });

  const dayOnePage = await context.newPage();
  attachRuntimeListeners(dayOnePage, report);
  await dayOnePage.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
  await waitForGame(dayOnePage, "starter-shift-001", "1");

  const runtime = await dayOnePage.evaluate(() => ({
    architecture: document.body.dataset.gameArchitecture,
    version: document.body.dataset.gameVersion,
    language: document.body.dataset.uiLanguage,
    sdk: document.body.dataset.crazyGamesSdk,
    loading: document.body.dataset.crazyGamesLoading,
    gameplay: document.body.dataset.crazyGamesGameplay
  }));
  report.regressions.architectureV3 = runtime.architecture === "architecture-v3" && runtime.version === "architecture-v3";
  report.regressions.englishHud = runtime.language === "en";

  const initial = await readSnapshot(dayOnePage);
  recordSnapshot(report, "day1-initial", initial);
  report.regressions.initialState = matches(initial, {
    step: "collect",
    stockedRows: 0,
    totalRows: 6,
    coins: 100,
    stars: 0
  });
  await capture(dayOnePage, report, "01-day1-initial.png", "Day 1 cola restock task");

  const dayOneComplete = await completeRestockLevel(dayOnePage, report, {
    prefix: "day1",
    captureTravel: "02-cart-at-cooler.png",
    captureOpened: "03-case-opened.png",
    captureMidway: "04-three-rows-stocked.png"
  });
  report.regressions.completionReward = matches(dayOneComplete, {
    step: "complete",
    stockedRows: 6,
    coins: 200,
    stars: 1
  });
  await dayOnePage.waitForFunction(
    () => document.body.dataset.crazyGamesGameplay === "stopped",
    null,
    { timeout: 10000 }
  );
  await dayOnePage.waitForTimeout(550);
  await capture(dayOnePage, report, "05-day1-complete.png", "Completed Day 1 task and reward");

  const sdkEvents = await dayOnePage.evaluate(() => [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]);
  report.sdkEvents = sdkEvents;
  report.regressions.crazyGamesSdkLifecycle = (
    runtime.sdk === "ready" &&
    runtime.loading === "stopped" &&
    runtime.gameplay === "started" &&
    hasOrderedEvents(sdkEvents, [
      "init",
      "loadingStart",
      "loadingStop",
      "gameplayStart",
      "progress:33",
      "gameplayStop"
    ])
  );
  await dayOnePage.close();

  const dayTwoPage = await context.newPage();
  attachRuntimeListeners(dayTwoPage, report);
  await dayTwoPage.goto(DAY_TWO_URL, { waitUntil: "networkidle", timeout: 90000 });
  await waitForGame(dayTwoPage, "starter-shift-002", "2");
  const dayTwoRuntime = await dayTwoPage.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      sceneKey: scene?.sys?.settings?.key,
      levelId: document.body.dataset.activeLevel,
      mode: document.body.dataset.activeMode,
      shiftId: document.body.dataset.activeShift,
      day: document.body.dataset.activeDay,
      productId: scene?.controller?.config?.runtime?.product?.id,
      missionId: scene?.controller?.config?.runtime?.mission?.id,
      startTime: scene?.controller?.config?.runtime?.shift?.startTime,
      rewardCoins: scene?.controller?.config?.runtime?.reward?.totalCoins,
      initialSnapshot: scene?.controller?.snapshot?.()
    };
  }, GAME_SCENE_KEY);
  recordSnapshot(report, "day2-runtime", dayTwoRuntime);
  report.regressions.dayTwoSharedScene = (
    dayTwoRuntime.sceneKey === GAME_SCENE_KEY &&
    dayTwoRuntime.levelId === "starter-level-002" &&
    dayTwoRuntime.mode === "restock" &&
    dayTwoRuntime.shiftId === "starter-shift-002" &&
    dayTwoRuntime.day === "2" &&
    dayTwoRuntime.productId === "water-bottle" &&
    dayTwoRuntime.missionId === "restock-water-promotion" &&
    dayTwoRuntime.startTime === "10:30" &&
    dayTwoRuntime.rewardCoins === 120 &&
    matches(dayTwoRuntime.initialSnapshot, {
      step: "collect",
      stockedRows: 0,
      totalRows: 6,
      coins: 200,
      stars: 1
    })
  );
  await capture(dayTwoPage, report, "06-day2-initial.png", "Day 2 inherits Day 1 economy");

  const dayTwoComplete = await completeRestockLevel(dayTwoPage, report, {
    prefix: "day2"
  });
  recordSnapshot(report, "day2-complete", dayTwoComplete);
  await dayTwoPage.waitForTimeout(550);
  await capture(dayTwoPage, report, "07-day2-complete.png", "Day 2 completion carries economy into checkout");
  await dayTwoPage.close();

  const checkoutPage = await context.newPage();
  attachRuntimeListeners(checkoutPage, report);
  await checkoutPage.goto(CHECKOUT_URL, { waitUntil: "networkidle", timeout: 90000 });
  await waitForGame(checkoutPage, "starter-shift-002", "2");
  const checkoutInitial = await readSnapshot(checkoutPage);
  recordSnapshot(report, "checkout-initial", checkoutInitial);
  await capture(checkoutPage, report, "08-checkout-initial.png", "Checkout inherits two restock rewards");

  await clickGame(checkoutPage, 520, 680);
  await waitForSnapshot(checkoutPage, { step: "serve" });
  await checkoutPage.waitForTimeout(320);

  for (let customer = 0; customer < 6; customer += 1) {
    await clickGame(checkoutPage, 520, 680);
    await waitForSnapshot(checkoutPage, { customersServed: customer + 1 });
    await checkoutPage.waitForTimeout(930);
  }

  const checkoutComplete = await waitForSnapshot(checkoutPage, {
    step: "complete",
    customersServed: 6,
    coins: 400,
    stars: 3,
    reputation: 5
  });
  recordSnapshot(report, "checkout-complete", checkoutComplete);
  await checkoutPage.waitForTimeout(550);
  await capture(checkoutPage, report, "09-checkout-complete.png", "Checkout rush cleared with full campaign economy");

  const checkoutMetadata = await checkoutPage.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      sceneKey: scene?.sys?.settings?.key,
      levelId: document.body.dataset.activeLevel,
      mode: document.body.dataset.activeMode,
      missionId: scene?.controller?.config?.runtime?.mission?.id,
      storedEconomy: window.__CAMPAIGN_SESSION__?.initialEconomyFor?.("starter-level-003", 0)
    };
  }, GAME_SCENE_KEY);
  report.regressions.checkoutLevel = (
    checkoutMetadata.sceneKey === GAME_SCENE_KEY &&
    checkoutMetadata.levelId === "starter-level-003" &&
    checkoutMetadata.mode === "checkout" &&
    checkoutMetadata.missionId === "assist-checkout-rush"
  );
  report.regressions.campaignEconomyCarry = (
    matches(dayTwoComplete, { coins: 320, stars: 2 }) &&
    matches(checkoutInitial, {
      step: "open",
      customersServed: 0,
      totalCustomers: 6,
      coins: 320,
      stars: 2,
      reputation: 0
    }) &&
    matches(checkoutMetadata.storedEconomy, {
      coins: 400,
      stars: 3,
      reputation: 5
    })
  );
  await checkoutPage.close();

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (issueCount > 0 || failed.length > 0) {
    throw new Error(`Architecture V3 regressions failed: ${failed.join(", ") || "browser runtime"}; browser issues ${issueCount}`);
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

async function completeRestockLevel(page, auditReport, options) {
  await clickGame(page, 770, 510);
  const collected = await waitForSnapshot(page, { step: "load", boxCollected: true });
  recordSnapshot(auditReport, `${options.prefix}-case-collected`, collected);
  auditReport.regressions.collectCase = true;

  await clickGame(page, 860, 730);
  const loaded = await waitForSnapshot(page, { step: "push", boxLoaded: true });
  recordSnapshot(auditReport, `${options.prefix}-cart-loaded`, loaded);
  auditReport.regressions.loadCart = true;

  await clickGame(page, 860, 730);
  const travelling = await waitForSnapshot(page, { step: "park" });
  recordSnapshot(auditReport, `${options.prefix}-cart-travelling`, travelling);
  await waitForInteractionReady(page);
  auditReport.regressions.cartTravel = true;
  if (options.captureTravel) {
    await capture(page, auditReport, options.captureTravel, "Employee and loaded cart beside the beverage cooler");
  }

  await clickGame(page, 1120, 725);
  const parked = await waitForSnapshot(page, { step: "open", cartAtCooler: true });
  recordSnapshot(auditReport, `${options.prefix}-cart-parked`, parked);
  auditReport.regressions.parkCart = true;

  await clickGame(page, 1138, 641);
  const opened = await waitForSnapshot(page, { step: "restock", boxOpened: true });
  recordSnapshot(auditReport, `${options.prefix}-case-opened`, opened);
  auditReport.regressions.openCase = true;
  if (options.captureOpened) {
    await capture(page, auditReport, options.captureOpened, "Opened beverage case ready for row-by-row stocking");
  }

  for (let row = 0; row < 6; row += 1) {
    await clickGame(page, 1325, 286 + row * 78);
    await waitForSnapshot(page, { stockedRows: row + 1 });
    if (row === 2 && options.captureMidway) {
      await capture(page, auditReport, options.captureMidway, "Three beverage cooler rows stocked");
    }
  }

  auditReport.regressions.rowRestock = true;
  const completed = await waitForSnapshot(page, { step: "complete", stockedRows: 6 });
  recordSnapshot(auditReport, `${options.prefix}-complete`, completed);
  return completed;
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

async function waitForGame(page, shiftId, dayNumber) {
  await waitForCanvas(page);
  await page.waitForFunction(
    ({ expectedShiftId, expectedDay }) => (
      document.body.dataset.gameArchitecture === "architecture-v3" &&
      document.body.dataset.gameScene === "starter-market" &&
      document.body.dataset.activeShift === expectedShiftId &&
      document.body.dataset.activeDay === expectedDay
    ),
    { expectedShiftId: shiftId, expectedDay: dayNumber },
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

async function waitForSnapshot(page, expected) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout: 10000 });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY, { timeout: 10000 });
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
