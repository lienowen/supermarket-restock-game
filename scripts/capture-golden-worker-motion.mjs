import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-hunt");
const PORT = 4185;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
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
  assertions: {
    startsIdle: false,
    workerActuallyMoves: false,
    walkMotionObserved: false,
    walkTextureAppears: false,
    pickupMotionObserved: false,
    pickupPoseAppears: false,
    appleCollectsAfterTravel: false,
    basketFeedbackIncrements: false,
    returnsToIdle: false,
    noRuntimeIssues: false
  },
  start: null,
  evidence: null,
  finished: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=starter-level-005`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.goldenLevel === "level-5-mature-pass-v1", null, { timeout: 30000 });

  const start = await readWorker(page);
  report.start = start;
  report.assertions.startsIdle = Boolean(
    start.motion === "idle" &&
    start.textureKey?.includes("worker-a-idle") &&
    start.textureKey?.endsWith("--opaque-cutout")
  );

  const apple = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const object = scene?.children?.getByName?.("find-item-apple");
    return object ? { x: object.x, y: object.y } : null;
  }, GAME_SCENE_KEY);
  if (!apple) throw new Error("Golden apple sprite was not found");

  await clickGame(page, apple.x, apple.y);
  await page.waitForFunction(
    () => document.body.dataset.goldenWorkerWalkObserved === "true",
    null,
    { timeout: 6000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.goldenPickupObserved === "true",
    null,
    { timeout: 10000 }
  );
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.findChallenge?.snapshot?.().collectedProductIds?.includes("apple") === true;
  }, GAME_SCENE_KEY, { timeout: 15000 });
  report.assertions.appleCollectsAfterTravel = true;

  await page.waitForFunction(
    () => document.body.dataset.goldenBasketCount === "1",
    null,
    { timeout: 5000 }
  );
  report.assertions.basketFeedbackIncrements = true;

  const evidence = await readWorker(page);
  report.evidence = evidence;
  report.assertions.walkMotionObserved = evidence.walkObserved === "true";
  report.assertions.walkTextureAppears = Boolean(
    evidence.lastWalkTexture?.includes("worker-a-walk") &&
    evidence.lastWalkTexture?.endsWith("--opaque-cutout")
  );
  report.assertions.pickupMotionObserved = evidence.pickupObserved === "true";
  report.assertions.pickupPoseAppears = Boolean(
    evidence.lastPickupTexture?.includes("worker-a-place-middle") &&
    evidence.lastPickupTexture?.endsWith("--opaque-cutout")
  );

  await page.waitForFunction(
    () => document.body.dataset.goldenWorkerMotion === "idle",
    null,
    { timeout: 5000 }
  );
  const finished = await readWorker(page);
  report.finished = finished;
  report.assertions.workerActuallyMoves = Math.hypot(finished.x - start.x, finished.y - start.y) > 120;
  report.assertions.returnsToIdle = Boolean(
    finished.motion === "idle" &&
    finished.textureKey?.includes("worker-a-idle") &&
    finished.textureKey?.endsWith("--opaque-cutout")
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "golden-order-hunt-motion-finished.png"), fullPage: true });

  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Golden worker motion audit failed: ${failed.join(", ")}`);

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "worker-motion-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readWorker(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("find-items-worker");
    return {
      motion: document.body.dataset.goldenWorkerMotion ?? null,
      frame: document.body.dataset.goldenWorkerFrame ?? null,
      textureKey: worker?.texture?.key ?? null,
      x: worker?.x ?? 0,
      y: worker?.y ?? 0,
      flipX: worker?.flipX ?? false,
      walkObserved: document.body.dataset.goldenWorkerWalkObserved ?? null,
      pickupObserved: document.body.dataset.goldenPickupObserved ?? null,
      lastWalkTexture: document.body.dataset.goldenLastWalkTexture ?? null,
      lastPickupTexture: document.body.dataset.goldenLastPickupTexture ?? null,
      basketCount: document.body.dataset.goldenBasketCount ?? null
    };
  }, GAME_SCENE_KEY);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(box.x + (gameX / GAME_WIDTH) * box.width, box.y + (gameY / GAME_HEIGHT) * box.height);
}

function attachListeners(page, auditReport) {
  page.on("console", (message) => { if (message.type() === "error") auditReport.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => auditReport.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
