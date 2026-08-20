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
  waveOneSequence: [],
  waveTwoSequence: [],
  assertions: {
    waveMemoryModeActive: false,
    waveOnePreviewMatchesRoute: false,
    waveOneRunsWithoutTargetGlow: false,
    wrongShelfKeepsRouteStable: false,
    waveTwoPreviewStartsAfterThreeShelves: false,
    waveTwoPreviewMatchesRoute: false,
    waveTwoRunsWithoutTargetGlow: false,
    bothWavesCompleteCampaign: false,
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
  await page.waitForFunction(() => document.body.dataset.restockChallenge === "wave-memory", null, { timeout: 10000 });
  await page.waitForSelector("#restock-memory-preview", { state: "visible", timeout: 15000 });
  const planned = await page.evaluate((key) => [...window.__IMMERSIVE_GAME__.scene.getScene(key).rush.plannedRowIndexes()], SCENE_KEY);
  const waveOnePreview = await readPreviewSequence(page);
  report.waveOneSequence = waveOnePreview;
  report.assertions.waveMemoryModeActive = planned.length === 6 && documentMode(await readState(page)) === "wave-memory";
  report.assertions.waveOnePreviewMatchesRoute = same(waveOnePreview, planned.slice(0, 3));
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-wave-1-preview.png"), fullPage: true });

  await waitForWaveActive(page, "1/2");
  let state = await readState(page);
  report.assertions.waveOneRunsWithoutTargetGlow = state.visibleRowTargets === 0 && state.rush?.activeRowIndex === planned[0];
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-wave-1-active.png"), fullPage: true });

  const expectedBeforeMistake = state.rush.activeRowIndex;
  const wrongRow = (expectedBeforeMistake + 1) % 6;
  await clickRow(page, wrongRow);
  await page.waitForFunction(({ key, expected }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    return rush?.mistakes === 1 && rush?.activeRowIndex === expected;
  }, { key: SCENE_KEY, expected: expectedBeforeMistake }, { timeout: 10000 });
  state = await readState(page);
  report.assertions.wrongShelfKeepsRouteStable = state.rush.mistakes === 1 && state.rush.activeRowIndex === expectedBeforeMistake;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-wave-1-wrong-route.png"), fullPage: true });

  for (let index = 0; index < 3; index += 1) {
    await waitForGameReady(page);
    await clickRow(page, planned[index]);
    if (index < 2) await waitForFilledCount(page, index + 1);
  }

  await page.waitForSelector("#restock-memory-preview", { state: "visible", timeout: 15000 });
  state = await readState(page);
  report.assertions.waveTwoPreviewStartsAfterThreeShelves = state.controller?.stockedRows === 3 && state.wave === "2/2" && state.waveState === "preview";
  const waveTwoPreview = await readPreviewSequence(page);
  report.waveTwoSequence = waveTwoPreview;
  report.assertions.waveTwoPreviewMatchesRoute = same(waveTwoPreview, planned.slice(3, 6));
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-wave-2-preview.png"), fullPage: true });

  await waitForWaveActive(page, "2/2");
  state = await readState(page);
  report.assertions.waveTwoRunsWithoutTargetGlow = state.visibleRowTargets === 0 && state.rush?.activeRowIndex === planned[3];

  for (let index = 3; index < 6; index += 1) {
    await waitForGameReady(page);
    await clickRow(page, planned[index]);
    if (index < 5) await waitForFilledCount(page, index + 1);
  }
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step === "complete", SCENE_KEY, { timeout: 15000 });
  state = await readState(page);
  report.assertions.bothWavesCompleteCampaign = state.controller?.stockedRows === 6 && state.rush?.complete === true && state.rush?.mistakes === 1;
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
console.log(JSON.stringify({ assertions: report.assertions, waveOneSequence: report.waveOneSequence, waveTwoSequence: report.waveTwoSequence, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function completeDeliverySetup(page) {
  await waitForHudAction(page); await clickHudAction(page);
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step === "load", SCENE_KEY, { timeout: 25000 });
  await waitForGameReady(page); await waitForHudAction(page); await clickHudAction(page);
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.controller?.snapshot?.().step === "restock", SCENE_KEY, { timeout: 30000 });
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
      visibleRowTargets: list.filter((entry) => entry?.visible === true && typeof entry?.name === "string" && entry.name.startsWith("beverage-cooler-row-target-")).length
    };
  }, SCENE_KEY);
}
function documentMode(state) { return state.mode; }
async function readPreviewSequence(page) {
  return page.$$eval("#restock-memory-grid [data-order]", (cells) => cells
    .map((cell) => ({ slot: Number(cell.dataset.slotIndex), order: Number(cell.dataset.order) }))
    .filter((entry) => entry.order > 0).sort((a, b) => a.order - b.order).map((entry) => entry.slot));
}
async function waitForWaveActive(page, wave) {
  await page.waitForFunction((wave) => document.body.dataset.restockFinaleWave === wave && document.body.dataset.restockFinaleWaveState === "active" && !document.getElementById("restock-memory-preview"), wave, { timeout: 15000 });
}
async function waitForFilledCount(page, count) {
  await page.waitForFunction(({ key, count }) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.rush?.snapshot?.(window.__IMMERSIVE_GAME__.scene.getScene(key).time.now)?.filledRowIndexes?.length === count, { key: SCENE_KEY, count }, { timeout: 10000 });
}
async function waitForGameReady(page) {
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 20000 });
}
async function waitForHudAction(page) {
  await page.waitForFunction((key) => { const a = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.children?.getByName?.("shift-hud-action"); return Boolean(a?.visible && a?.input?.enabled); }, SCENE_KEY, { timeout: 15000 });
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
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function attach(page, target) {
  page.on("console", (message) => { if (message.type() === "error") target.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => target.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => { const text = request.failure()?.errorText ?? "failed"; if (!text.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${text}`); });
}
function mimeType(path) { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(path).toLowerCase()] ?? "application/octet-stream"; }
