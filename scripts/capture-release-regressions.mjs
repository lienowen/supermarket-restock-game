import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/?test=1`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
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
          setGameContext: (value) => events.push(`context:${value.version ?? "unknown"}`),
          clearGameContext: () => events.push("context:clear"),
          reportGameCompletedPercentage: (value) => events.push(`progress:${value}`),
          addSettingsChangeListener: () => undefined,
          removeSettingsChangeListener: () => undefined
        }
      }
    };
  });

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      report.consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => report.pageErrors.push({ message: error.message, stack: error.stack ?? null }));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) report.failedRequests.push({ url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) report.badResponses.push({ url: response.url(), status: response.status() });
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
  await waitForCanvas(page);
  await page.waitForFunction(
    () => (
      document.body.dataset.gameArchitecture === "architecture-v3" &&
      document.body.dataset.gameScene === "starter-market"
    ),
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => Boolean(window.__IMMERSIVE_GAME__?.scene?.getScene("immersive-day-one")),
    null,
    { timeout: 15000 }
  );

  const runtime = await page.evaluate(() => ({
    architecture: document.body.dataset.gameArchitecture,
    version: document.body.dataset.gameVersion,
    language: document.body.dataset.uiLanguage,
    sdk: document.body.dataset.crazyGamesSdk,
    loading: document.body.dataset.crazyGamesLoading,
    gameplay: document.body.dataset.crazyGamesGameplay
  }));
  report.regressions.architectureV3 = runtime.architecture === "architecture-v3" && runtime.version === "architecture-v3";
  report.regressions.englishHud = runtime.language === "en";

  const initial = await readSnapshot(page);
  recordSnapshot(report, "initial", initial);
  report.regressions.initialState = matches(initial, {
    step: "collect",
    stockedRows: 0,
    totalRows: 6,
    coins: 100,
    stars: 0
  });
  await capture(page, report, "01-day1-initial.png", "Immersive initial beverage task");

  await clickGame(page, 770, 510);
  const collected = await waitForSnapshot(page, { step: "load", boxCollected: true });
  recordSnapshot(report, "case-collected", collected);
  report.regressions.collectCase = true;

  await clickGame(page, 860, 730);
  const loaded = await waitForSnapshot(page, { step: "push", boxLoaded: true });
  recordSnapshot(report, "cart-loaded", loaded);
  report.regressions.loadCart = true;

  await clickGame(page, 860, 730);
  const travelling = await waitForSnapshot(page, { step: "park" });
  recordSnapshot(report, "cart-travelling", travelling);
  await waitForInteractionReady(page);
  report.regressions.cartTravel = true;
  await capture(page, report, "02-cart-at-cooler.png", "Employee and loaded cart beside the beverage cooler");

  await clickGame(page, 1120, 725);
  const parked = await waitForSnapshot(page, { step: "open", cartAtCooler: true });
  recordSnapshot(report, "cart-parked", parked);
  report.regressions.parkCart = true;

  await clickGame(page, 1138, 641);
  const opened = await waitForSnapshot(page, { step: "restock", boxOpened: true });
  recordSnapshot(report, "case-opened", opened);
  report.regressions.openCase = true;
  await capture(page, report, "03-case-opened.png", "Opened beverage case ready for row-by-row stocking");

  for (let row = 0; row < 6; row += 1) {
    await clickGame(page, 1325, 286 + row * 78);
    await waitForSnapshot(page, { stockedRows: row + 1 });
    if (row === 2) {
      await capture(page, report, "04-three-rows-stocked.png", "Three beverage cooler rows stocked");
    }
  }

  const completed = await waitForSnapshot(page, {
    step: "complete",
    stockedRows: 6,
    coins: 200,
    stars: 1
  });
  recordSnapshot(report, "complete", completed);
  report.regressions.rowRestock = true;

  await page.waitForFunction(
    () => document.body.dataset.crazyGamesGameplay === "stopped",
    null,
    { timeout: 10000 }
  );
  await page.waitForTimeout(550);
  await capture(page, report, "05-task-complete.png", "Completed beverage cooler task and reward");
  report.regressions.completionReward = true;

  const sdkEvents = await page.evaluate(() => [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]);
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
      "progress:20",
      "gameplayStop"
    ])
  );

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

async function readSnapshot(page) {
  return page.evaluate(() => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene("immersive-day-one");
    return scene?.controller?.snapshot?.() ?? null;
  });
}

async function waitForSnapshot(page, expected) {
  await page.waitForFunction((target) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene("immersive-day-one");
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, expected, { timeout: 10000 });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction(() => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene("immersive-day-one");
    return Boolean(scene?.isInteractionReady?.());
  }, null, { timeout: 10000 });
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
