import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-10-mobile");
const PORT = 4206;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-010";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
mkdirSync(OUTPUT_DIR, { recursive: true });
const server = createServer((request, response) => {
  const raw = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let path = join(DIST_DIR, safe);
  if (!existsSync(path) || !statSync(path).isFile()) path = join(DIST_DIR, "index.html");
  response.statusCode = 200; response.setHeader("Content-Type", mimeType(path)); response.setHeader("Cache-Control", "no-store"); response.end(readFileSync(path));
});
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(), viewport: { width: 390, height: 844 },
  assertions: {
    portraitSoftwareLandscapeActive: false,
    touchInputUsesCanvasGeometry: false,
    integratedRushModeActive: false,
    memoryModalAbsent: false,
    sixShelfRouteUnique: false,
    wrongShelfCostsMistake: false,
    threeTouchesPerShelf: false,
    eighteenTouchesCompleteFinale: false,
    noRuntimeIssues: false
  },
  plannedRoute: [], consoleErrors: [], pageErrors: [], failedRequests: [], fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({
    viewport: report.viewport, screen: report.viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36"
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-010", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 15000 });
  report.assertions.portraitSoftwareLandscapeActive = await page.evaluate(() => window.innerWidth < window.innerHeight && document.body.dataset.softwareLandscape === "true");
  report.assertions.touchInputUsesCanvasGeometry = await page.evaluate(() => document.body.dataset.softwareLandscapeInput === "canvas-geometry-v2");

  await completeDeliverySetup(page, cdp);
  report.deliveryState = await readState(page);
  report.plannedRoute = await page.evaluate((key) => [...window.__IMMERSIVE_GAME__.scene.getScene(key).rush.plannedRowIndexes()], SCENE_KEY);
  let state = await readState(page);
  report.assertions.integratedRushModeActive = state.mode === "rush" && state.controller?.step === "restock";
  report.assertions.memoryModalAbsent = await page.locator("#restock-memory-preview").count() === 0;
  report.assertions.sixShelfRouteUnique = report.plannedRoute.length === 6 && new Set(report.plannedRoute).size === 6;

  const wrongRow = (state.rush.activeRowIndex + 1) % 6;
  await touchRow(page, cdp, wrongRow);
  await page.waitForFunction((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    return scene?.rush?.snapshot?.(scene.time.now)?.mistakes === 1;
  }, SCENE_KEY, { timeout: 10000 });
  state = await readState(page);
  report.assertions.wrongShelfCostsMistake = state.rush?.mistakes === 1 && state.rush?.totalItemsStocked === 0;

  const firstShelf = state.rush.activeRowIndex;
  for (let item = 1; item <= 18; item += 1) {
    await waitForGameReady(page);
    const activeRow = await page.evaluate((key) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
      return scene?.rush?.snapshot?.(scene.time.now)?.activeRowIndex;
    }, SCENE_KEY);
    await touchRow(page, cdp, activeRow);
    await waitForItemCount(page, item);
    if (item === 3) {
      state = await readState(page);
      report.assertions.threeTouchesPerShelf = state.rush?.filledRowIndexes?.length === 1 &&
        state.rush?.rowItemCounts?.[firstShelf] === 3;
    }
  }
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step === "complete", SCENE_KEY, { timeout: 15000 });
  state = await readState(page);
  report.assertions.eighteenTouchesCompleteFinale = state.controller?.stockedRows === 6 &&
    state.rush?.totalItemsStocked === 18 && state.rush?.complete === true && state.rush?.mistakes === 1;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 10 Android audit failed: ${failed.join(", ")}`);
  await page.close(); await context.close();
} catch (error) {
  thrown = error; report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise((done) => server.close(done));
}
console.log(JSON.stringify({ assertions: report.assertions, plannedRoute: report.plannedRoute, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function completeDeliverySetup(page, cdp) {
  for (let action = 0; action < 6; action += 1) {
    const step = await currentStep(page);
    if (step === "restock") return;
    await advanceHudStep(page, cdp, step);
  }
  throw new Error(`Level 10 mobile delivery did not reach restock; stopped at ${await currentStep(page)}`);
}
async function advanceHudStep(page, cdp, previousStep) {
  await waitForHudAction(page); await touchHudAction(page, cdp);
  const changedImmediately = await page.waitForFunction(
    ({ key, previous }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step !== previous,
    { key: SCENE_KEY, previous: previousStep }, { timeout: 900 }
  ).then(() => true).catch(() => false);
  if (changedImmediately) return;
  await waitForGameReady(page); await waitForHudAction(page); await touchHudAction(page, cdp);
  await page.waitForFunction(
    ({ key, previous }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step !== previous,
    { key: SCENE_KEY, previous: previousStep }, { timeout: 8000 }
  );
}
async function currentStep(page) {
  return page.evaluate((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step ?? null, SCENE_KEY);
}
async function readState(page) {
  return page.evaluate((key) => { const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key); const list = scene?.children?.list ?? []; return {
    mode: document.body.dataset.restockChallenge ?? null,
    wave: document.body.dataset.restockFinaleWave ?? null, waveState: document.body.dataset.restockFinaleWaveState ?? null,
    controller: scene?.controller?.snapshot?.() ?? null, rush: scene?.rush?.snapshot?.(scene.time.now) ?? null,
    visibleRowGlows: list.filter((entry) => entry?.visible === true && typeof entry?.name === "string" && entry.name.startsWith("beverage-cooler-row-glow-")).length
  }; }, SCENE_KEY);
}
async function waitForItemCount(page, count) { await page.waitForFunction(({ key, count }) => { const s = window.__IMMERSIVE_GAME__?.scene?.getScene(key); return s?.rush?.snapshot?.(s.time.now)?.totalItemsStocked === count; }, { key: SCENE_KEY, count }, { timeout: 12000 }); }
async function waitForGameReady(page) { await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 20000 }); }
async function waitForHudAction(page) { await page.waitForFunction((key) => { const a = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.children?.getByName?.("shift-hud-action"); return Boolean(a?.visible && a?.input?.enabled); }, SCENE_KEY, { timeout: 15000 }); }
async function touchHudAction(page, cdp) { const p = await page.evaluate((key) => { const a = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.children?.getByName?.("shift-hud-action"); return a ? { x: a.x, y: a.y } : null; }, SCENE_KEY); if (!p) throw new Error("HUD action missing"); await touchTapLogical(page, cdp, p.x, p.y); }
async function touchRow(page, cdp, rowIndex) { const p = await page.evaluate(({ key, rowIndex }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.cooler?.rowCentre?.(rowIndex) ?? null, { key: SCENE_KEY, rowIndex }); if (!p) throw new Error(`Missing row ${rowIndex}`); await touchTapLogical(page, cdp, p.x, p.y); }
async function touchTapLogical(page, cdp, logicalX, logicalY) {
  const point = await physicalPointForLogical(page, logicalX, logicalY);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.clientX, y: point.clientY, radiusX: 10, radiusY: 10, force: 1 }] });
  await page.waitForTimeout(52); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function physicalPointForLogical(page, logicalX, logicalY) {
  return page.evaluate(({ logicalX, logicalY, logicalWidth, logicalHeight, canvasSelector }) => {
    const canvas = document.querySelector(canvasSelector); if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Game canvas is missing");
    const bodyRect = document.body.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect();
    const canvasStageWidth = canvasRect.height; const canvasStageHeight = canvasRect.width;
    const canvasCentreStageX = (canvasRect.top + canvasRect.height / 2) - bodyRect.top;
    const canvasCentreStageY = bodyRect.width - ((canvasRect.left + canvasRect.width / 2) - bodyRect.left);
    const canvasStageLeft = canvasCentreStageX - canvasStageWidth / 2; const canvasStageTop = canvasCentreStageY - canvasStageHeight / 2;
    const stageX = canvasStageLeft + (logicalX / logicalWidth) * canvasStageWidth; const stageY = canvasStageTop + (logicalY / logicalHeight) * canvasStageHeight;
    return { clientX: bodyRect.left + bodyRect.width - stageY, clientY: bodyRect.top + stageX };
  }, { logicalX, logicalY, logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT, canvasSelector: CANVAS });
}
function attach(page, target) { page.on("console", (m) => { if (m.type() === "error") target.consoleErrors.push(m.text()); }); page.on("pageerror", (e) => target.pageErrors.push(String(e))); page.on("requestfailed", (r) => { const t = r.failure()?.errorText ?? "failed"; if (!t.includes("ERR_ABORTED")) target.failedRequests.push(`${r.method()} ${r.url()} :: ${t}`); }); }
function mimeType(path) { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp" })[extname(path).toLowerCase()] ?? "application/octet-stream"; }
