import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-hunt");
const PORT = 4185;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const W = 1600;
const H = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing");
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

const report = { assertions: {
  startsIdle: false, workerActuallyMoves: false, walkMotionObserved: false,
  walkTextureAppears: false, pickupMotionObserved: false, pickupPoseAppears: false,
  appleCollectsAfterTravel: false, basketFeedbackIncrements: false,
  returnsToIdle: false, workerArrivesAtProduceStand: false, noRuntimeIssues: false
}, start: null, finished: null, consoleErrors: [], pageErrors: [], failedRequests: [], fatalError: null };

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=starter-level-005`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.goldenLevel === "level-5-three-zone-v3", null, { timeout: 30000 });
  await page.waitForTimeout(400);

  const start = await readWorker(page);
  report.start = start;
  report.assertions.startsIdle = Boolean(start.motion === "idle" && start.textureKey?.includes("worker-a-idle"));

  await clickGame(page, 220, 515);
  await page.waitForFunction(() => document.body.dataset.goldenWorkerWalkObserved === "true", null, { timeout: 6000 });
  await page.waitForFunction(() => document.body.dataset.goldenPickupObserved === "true", null, { timeout: 10000 });
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().collectedProductIds?.includes("apple") === true, SCENE_KEY, { timeout: 15000 });
  report.assertions.appleCollectsAfterTravel = true;
  await page.waitForFunction(() => document.body.dataset.goldenBasketCount === "1", null, { timeout: 5000 });
  report.assertions.basketFeedbackIncrements = true;
  await page.waitForFunction(() => document.body.dataset.goldenWorkerMotion === "idle", null, { timeout: 5000 });

  const finished = await readWorker(page);
  report.finished = finished;
  report.assertions.workerActuallyMoves = Math.hypot(finished.x - start.x, finished.y - start.y) > 120;
  report.assertions.walkMotionObserved = finished.walkObserved === "true";
  report.assertions.walkTextureAppears = Boolean(finished.lastWalkTexture?.includes("worker-a-walk"));
  report.assertions.pickupMotionObserved = finished.pickupObserved === "true";
  report.assertions.pickupPoseAppears = Boolean(finished.lastPickupTexture?.includes("worker-a-place-middle"));
  report.assertions.returnsToIdle = Boolean(finished.motion === "idle" && finished.textureKey?.includes("worker-a-idle"));
  report.assertions.workerArrivesAtProduceStand = Math.hypot(finished.x - 255, finished.y - 770) <= 90;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "golden-order-hunt-motion-finished.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 5 worker audit failed: ${failed.join(", ")}`);
  await page.close(); await context.close();
} catch (error) {
  thrown = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "worker-motion-report.json"), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise((done) => server.close(done));
}
console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function readWorker(page) {
  return page.evaluate((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const worker = scene?.children?.getByName?.("find-items-worker");
    return {
      motion: document.body.dataset.goldenWorkerMotion ?? null,
      textureKey: worker?.texture?.key ?? null, x: worker?.x ?? 0, y: worker?.y ?? 0,
      walkObserved: document.body.dataset.goldenWorkerWalkObserved ?? null,
      pickupObserved: document.body.dataset.goldenPickupObserved ?? null,
      lastWalkTexture: document.body.dataset.goldenLastWalkTexture ?? null,
      lastPickupTexture: document.body.dataset.goldenLastPickupTexture ?? null
    };
  }, SCENE_KEY);
}
async function clickGame(page, x, y) {
  const box = await page.locator(CANVAS).boundingBox(); if (!box) throw new Error("Missing game canvas bounds");
  await page.mouse.click(box.x + (x / W) * box.width, box.y + (y / H) * box.height);
}
function attach(page, target) {
  page.on("console", (m) => { if (m.type() === "error") target.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => target.pageErrors.push(e.message));
  page.on("requestfailed", (r) => { const e = r.failure()?.errorText ?? "unknown"; if (!e.includes("ERR_ABORTED")) target.failedRequests.push(`${r.method()} ${r.url()} :: ${e}`); });
}
function mimeType(path) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
