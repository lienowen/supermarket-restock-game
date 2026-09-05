import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-10");
const PORT = 4205;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-010";
const WIDTH = 1600;
const HEIGHT = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
mkdirSync(OUTPUT_DIR, { recursive: true });

const server = createServer((request, response) => {
  const raw = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let path = join(DIST_DIR, safe);
  if (!existsSync(path) || !statSync(path).isFile()) path = join(DIST_DIR, "index.html");
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeType(path));
  response.setHeader("Cache-Control", "no-store");
  response.end(readFileSync(path));
});
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  plannedRoute: [],
  assertions: {
    integratedRushModeActive: false,
    memoryModalAbsent: false,
    sixShelfRouteUnique: false,
    activeShelfTargetValid: false,
    wrongShelfCostsMistake: false,
    threePlacementsPerShelf: false,
    eighteenPlacementsCompleteCampaign: false,
    noRuntimeIssues: false
  },
  consoleErrors: [], pageErrors: [], failedRequests: [], fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });
  const page = await context.newPage();
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-010", null, { timeout: 30000 });

  await completeDeliverySetup(page);
  report.deliveryState = await readState(page);
  const planned = await page.evaluate((key) => [...window.__IMMERSIVE_GAME__.scene.getScene(key).rush.plannedRowIndexes()], SCENE_KEY);
  report.plannedRoute = planned;
  let state = await readState(page);
  report.assertions.integratedRushModeActive = state.mode === "rush" && state.controller?.step === "restock";
  report.assertions.memoryModalAbsent = await page.locator("#restock-memory-preview").count() === 0;
  report.assertions.sixShelfRouteUnique = planned.length === 6 && new Set(planned).size === 6;
  report.assertions.activeShelfTargetValid = Number.isInteger(state.rush?.activeRowIndex) &&
    planned.includes(state.rush.activeRowIndex);
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-rush-active.png"), fullPage: true });

  const expectedBeforeMistake = state.rush.activeRowIndex;
  const wrongRow = (expectedBeforeMistake + 1) % 6;
  await clickRow(page, wrongRow);
  await page.waitForFunction((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    return rush?.mistakes === 1;
  }, SCENE_KEY, { timeout: 10000 });
  state = await readState(page);
  report.assertions.wrongShelfCostsMistake = state.rush.mistakes === 1 && state.rush.totalItemsStocked === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-wrong-shelf.png"), fullPage: true });

  let firstShelf = state.rush.activeRowIndex;
  for (let item = 1; item <= 18; item += 1) {
    await waitForGameReady(page);
    const activeRow = await page.evaluate((key) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
      return scene?.rush?.snapshot?.(scene.time.now)?.activeRowIndex;
    }, SCENE_KEY);
    await clickRow(page, activeRow);
    await waitForItemCount(page, item);
    if (item === 3) {
      state = await readState(page);
      report.assertions.threePlacementsPerShelf = state.rush?.filledRowIndexes?.length === 1 &&
        state.rush?.rowItemCounts?.[firstShelf] === 3;
    }
  }
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step === "complete", SCENE_KEY, { timeout: 15000 });
  state = await readState(page);
  report.assertions.eighteenPlacementsCompleteCampaign = state.controller?.stockedRows === 6 &&
    state.rush?.totalItemsStocked === 18 && state.rush?.complete === true && state.rush?.mistakes === 1;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 10 desktop audit failed: ${failed.join(", ")}`);
  await page.close();
  await context.close();
} catch (error) {
  thrown = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}
console.log(JSON.stringify({ assertions: report.assertions, plannedRoute: report.plannedRoute, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function completeDeliverySetup(page) {
  for (let action = 0; action < 6; action += 1) {
    const step = await currentStep(page);
    if (step === "restock") return;
    await advanceHudStep(page, step);
  }
  throw new Error(`Level 10 delivery did not reach restock; stopped at ${await currentStep(page)}`);
}

async function advanceHudStep(page, previousStep) {
  await waitForHudAction(page);
  await clickHudAction(page);
  const changedImmediately = await page.waitForFunction(
    ({ key, previous }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step !== previous,
    { key: SCENE_KEY, previous: previousStep },
    { timeout: 900 }
  ).then(() => true).catch(() => false);
  if (changedImmediately) return;
  await waitForGameReady(page);
  await waitForHudAction(page);
  await clickHudAction(page);
  await page.waitForFunction(
    ({ key, previous }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step !== previous,
    { key: SCENE_KEY, previous: previousStep },
    { timeout: 8000 }
  );
}

async function currentStep(page) {
  return page.evaluate((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step ?? null, SCENE_KEY);
}

async function readState(page) {
  return page.evaluate((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const list = scene?.children?.list ?? [];
    return {
      mode: document.body.dataset.restockChallenge ?? null,
      wave: document.body.dataset.restockFinaleWave ?? null,
      waveState: document.body.dataset.restockFinaleWaveState ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      rush: scene?.rush?.snapshot?.(scene.time.now) ?? null,
      visibleRowGlows: list.filter((entry) => entry?.visible === true && typeof entry?.name === "string" && entry.name.startsWith("beverage-cooler-row-glow-")).length,
      visibleTexts: list.filter((entry) => entry?.visible === true && typeof entry?.text === "string").map((entry) => entry.text)
    };
  }, SCENE_KEY);
}
async function waitForItemCount(page, count) {
  await page.waitForFunction(({ key, count }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.rush?.snapshot?.(window.__IMMERSIVE_GAME__.scene.getScene(key).time.now)?.totalItemsStocked === count, { key: SCENE_KEY, count }, { timeout: 10000 });
}
async function waitForGameReady(page) {
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 20000 });
}
async function waitForHudAction(page) {
  await page.waitForFunction((key) => { const a = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.children?.getByName?.("shift-hud-action"); return Boolean(a?.visible && a?.input?.enabled); }, SCENE_KEY, { timeout: 45000 });
}
async function clickHudAction(page) {
  const p = await page.evaluate((key) => { const a = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.children?.getByName?.("shift-hud-action"); return a ? { x: a.x, y: a.y } : null; }, SCENE_KEY);
  if (!p) throw new Error("HUD action missing");
  await clickLogical(page, p.x, p.y);
}
async function clickRow(page, rowIndex) {
  const p = await page.evaluate(({ key, rowIndex }) => { const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key); return scene?.cooler?.rowCentre?.(rowIndex) ?? null; }, { key: SCENE_KEY, rowIndex });
  if (!p) throw new Error(`Missing row ${rowIndex}`);
  await clickLogical(page, p.x, p.y);
}
async function clickLogical(page, x, y) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(box.x + (x / WIDTH) * box.width, box.y + (y / HEIGHT) * box.height);
}
function attach(page, target) {
  page.on("console", (message) => { if (message.type() === "error") target.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => target.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => { const text = request.failure()?.errorText ?? "failed"; if (!text.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${text}`); });
}
function mimeType(path) { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(path).toLowerCase()] ?? "application/octet-stream"; }
