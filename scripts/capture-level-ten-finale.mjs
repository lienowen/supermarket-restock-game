import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/release-level-10");
const PORT = 4195;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-010";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    correctFinalLevelLoads: false,
    caseCollected: false,
    cartLoaded: false,
    deliveredAndOpened: false,
    allShelvesStockedByCanvas: false,
    finaleCompletes: false,
    replayActionPresented: false,
    noRuntimeIssues: false
  },
  placements: 0,
  final: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: GAME_WIDTH, height: GAME_HEIGHT }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction((levelId) => document.body.dataset.activeLevel === levelId, LEVEL_ID, { timeout: 30000 });

  const initial = await readState(page);
  report.assertions.correctFinalLevelLoads = Boolean(
    initial.environmentKey === "environment-starter-market-restock-hd-v3" &&
    initial.snapshot?.step === "collect"
  );

  await emitAction(page);
  await page.waitForFunction((sceneKey) => {
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return state?.boxCollected === true && state?.step === "load";
  }, SCENE_KEY, { timeout: 15000 });
  report.assertions.caseCollected = true;

  await waitReady(page);
  await emitAction(page);
  await page.waitForFunction((sceneKey) => {
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return state?.boxLoaded === true && ["push", "park", "open", "restock"].includes(state?.step);
  }, SCENE_KEY, { timeout: 10000 });
  report.assertions.cartLoaded = true;

  await page.waitForFunction((sceneKey) => {
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return state?.step === "restock" && state?.cartAtDestination === true && state?.boxOpened === true;
  }, SCENE_KEY, { timeout: 18000 });
  report.assertions.deliveredAndOpened = true;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await readState(page);
    if (state.snapshot?.step === "complete") break;
    const row = await activeRushRow(page);
    if (!row) {
      await page.waitForTimeout(100);
      continue;
    }
    await clickGame(page, row.x, row.y);
    report.placements += 1;
    await page.waitForTimeout(380);
  }

  report.final = await readState(page);
  report.assertions.allShelvesStockedByCanvas = Boolean(
    report.placements > 0 &&
    report.final.snapshot?.stockedRows === report.final.snapshot?.totalRows
  );
  report.assertions.finaleCompletes = report.final.snapshot?.step === "complete";
  report.assertions.replayActionPresented = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.children?.list?.some?.((entry) => (
      typeof entry?.text === "string" && entry.visible !== false && /REPLAY|PLAY AGAIN|RESTART/i.test(entry.text)
    )));
  }, SCENE_KEY);
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-10-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Level 10 release gate failed: ${failed.join(", ")}`);
  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      snapshot: scene?.controller?.snapshot?.() ?? null,
      rush: scene?.rush?.snapshot?.(scene?.time?.now ?? 0) ?? null
    };
  }, SCENE_KEY);
}

async function emitAction(page) {
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Finale HUD action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function waitReady(page) {
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 18000 });
}

async function activeRushRow(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene?.time?.now ?? 0);
    const index = rush?.activeRowIndex;
    if (!Number.isInteger(index)) return null;
    const centre = scene?.cooler?.rowCentre?.(index);
    return centre ? { x: centre.x, y: centre.y, index } : null;
  }, SCENE_KEY);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
}

function attachListeners(page, audit) {
  page.on("console", (message) => { if (message.type() === "error") audit.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) audit.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
