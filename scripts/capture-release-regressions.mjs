import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/?test=1`;

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
  batchDisplayAudits: [],
  fatalError: null,
  regressions: {
    stockedLobby: false,
    milkCaseVisible: false,
    milkTextureTransparent: false,
    day3ReachedGame: false,
    day3MultiFixture: false,
    day4PromotionPressure: false,
    day5WeekendRush: false,
    promotionWingRealistic: false,
    crazyGamesSdkLifecycle: false
  }
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({ viewport: { width: 1330, height: 1182 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const events = [];
    window.__CRAZY_GAMES_TEST_EVENTS__ = events;
    window.CrazyGames = {
      SDK: {
        init: async () => {
          events.push("init");
        },
        game: {
          settings: { muteAudio: false },
          gameplayStart: () => events.push("gameplayStart"),
          gameplayStop: () => events.push("gameplayStop"),
          loadingStart: () => events.push("loadingStart"),
          loadingStop: () => events.push("loadingStop"),
          setGameContext: (contextValue) => events.push(`context:${contextValue.scene ?? "unknown"}`),
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
      report.consoleErrors.push({
        text: message.text(),
        location: message.location()
      });
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

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("supermarket.activeDay", "day03");
    localStorage.setItem("supermarket.bestStars", JSON.stringify({ day01: 3, day02: 3 }));
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);

  const lobbySdkState = await page.evaluate(() => ({
    sdk: document.body.dataset.crazyGamesSdk,
    loading: document.body.dataset.crazyGamesLoading,
    gameplay: document.body.dataset.crazyGamesGameplay,
    events: [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]
  }));
  if (lobbySdkState.sdk !== "ready") throw new Error(`CrazyGames SDK did not initialize: ${lobbySdkState.sdk}`);
  if (lobbySdkState.loading !== "stopped") throw new Error(`Initial loading did not stop: ${lobbySdkState.loading}`);
  if (lobbySdkState.events.includes("gameplayStart")) throw new Error("Gameplay started while still in the storefront lobby");

  report.regressions.stockedLobby = await page.evaluate(() => document.body.dataset.stockedLobbyVisual === "ready");
  await capture(page, report, "01-stocked-lobby.png", "Stocked supermarket lobby");

  await clickGame(page, 965, 770);
  await waitForScene(page, "opening", 60000);
  await page.waitForFunction(() => document.body.dataset.crazyGamesGameplay === "started", { timeout: 10000 });
  await capture(page, report, "02-day3-receiving.png", "Day 3 receiving area");

  await clickGame(page, 835, 1085);
  await page.waitForFunction(() => document.body.dataset.milkCaseVisual === "ready", { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.milkTextureTransparent === "ready", { timeout: 30000 });
  report.regressions.milkCaseVisible = true;
  report.regressions.milkTextureTransparent = true;
  await page.waitForTimeout(350);
  await capture(page, report, "03-visible-milk-case.png", "Transparent milk delivery case");

  await page.waitForFunction(() => typeof window.__GAME_TEST__?.finishReceiving === "function", { timeout: 10000 });
  await page.evaluate(() => window.__GAME_TEST__.finishReceiving());
  await waitForScene(page, "game", 20000);
  await page.waitForFunction(() => document.body.dataset.day3MultiFixture === "ready", { timeout: 10000 });
  await page.waitForTimeout(900);

  report.regressions.day3ReachedGame = await page.evaluate(() => document.body.dataset.gameScene === "game");
  report.regressions.day3MultiFixture = true;
  await capture(page, report, "04-day3-multi-fixture-floor.png", "Day 3 drinks, grocery and cold-case fixtures");

  await page.locator("#market-pause-button").click();
  await page.waitForFunction(() => document.body.dataset.marketPaused === "true", { timeout: 5000 });
  await page.waitForFunction(() => document.body.dataset.crazyGamesGameplay === "stopped", { timeout: 5000 });
  await page.locator('#market-pause-overlay [data-action="resume"]').click();
  await page.waitForFunction(() => document.body.dataset.marketPaused === "false", { timeout: 5000 });
  await page.waitForFunction(() => document.body.dataset.crazyGamesGameplay === "started", { timeout: 5000 });

  const sdkEvents = await page.evaluate(() => [...(window.__CRAZY_GAMES_TEST_EVENTS__ ?? [])]);
  report.sdkEvents = sdkEvents;
  report.regressions.crazyGamesSdkLifecycle = hasOrderedEvents(sdkEvents, [
    "init",
    "loadingStart",
    "loadingStop",
    "loadingStart",
    "loadingStop",
    "gameplayStart",
    "gameplayStop",
    "gameplayStart"
  ]);

  await captureBatchDay(page, report, "day04", "05-day4-promotion-pressure.png", "Day 4 promotion pressure full floor");
  report.regressions.day4PromotionPressure = true;

  await captureBatchDay(page, report, "day05", "06-day5-weekend-rush.png", "Day 5 weekend rush whole store");
  report.regressions.day5WeekendRush = true;

  await page.goto(`${BASE_URL}&promotionTest=1`, { waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await page.waitForFunction(() => document.body.dataset.promotionWingVisual === "ready", { timeout: 60000 });
  await page.waitForTimeout(1200);
  report.regressions.promotionWingRealistic = true;
  await capture(page, report, "07-promotion-wing.png", "Realistic supermarket promotion wing");

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (issueCount > 0 || failed.length > 0) {
    throw new Error(`Release regressions failed: ${failed.join(", ") || "browser runtime"}; browser issues ${issueCount}`);
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

async function captureBatchDay(page, auditReport, day, filename, label) {
  const priorStars = day === "day04"
    ? { day01: 3, day02: 3, day03: 3 }
    : { day01: 3, day02: 3, day03: 3, day04: 3 };
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(({ selectedDay, stars }) => {
    localStorage.setItem("supermarket.activeDay", selectedDay);
    localStorage.setItem("supermarket.bestStars", JSON.stringify(stars));
  }, { selectedDay: day, stars: priorStars });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await clickGame(page, 965, 770);
  await waitForScene(page, "opening", 60000);
  await page.waitForFunction(() => typeof window.__GAME_TEST__?.finishReceiving === "function", { timeout: 15000 });
  await page.evaluate(() => window.__GAME_TEST__.finishReceiving());
  await waitForScene(page, "game", 30000);
  await page.waitForFunction((expectedDay) => document.body.dataset.weekOneBatchFloor === expectedDay, day, { timeout: 30000 });
  await page.waitForFunction(() => Boolean(document.body.dataset.batchDisplayAudit), { timeout: 10000 });
  await page.waitForTimeout(1200);

  const displayAudit = await page.evaluate(() => {
    const raw = document.body.dataset.batchDisplayAudit;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { parseError: true, raw: raw.slice(0, 500) };
    }
  });
  auditReport.batchDisplayAudits.push({ day, audit: displayAudit });

  await capture(page, auditReport, filename, label);
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
  await page.waitForSelector("canvas", { state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  }, { timeout: 30000 });
  await page.waitForTimeout(850);
}

async function waitForScene(page, scene, timeout) {
  await page.waitForFunction((expected) => document.body.dataset.gameScene === expected, scene, { timeout });
}

async function gamePoint(page, gameX, gameY) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  return {
    x: box.x + (gameX / 1330) * box.width,
    y: box.y + (gameY / 1182) * box.height
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
