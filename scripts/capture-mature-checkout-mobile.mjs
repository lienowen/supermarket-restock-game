import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-checkout-mobile");
const PORT = 4194;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-003";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });
const SCALE_EPSILON = 0.002;

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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  viewport: { width: 390, height: 844 },
  assertions: {
    softwareLandscapeActive: false,
    canvasFitsViewport: false,
    matureCheckoutActive: false,
    idleWorkerKeepsAspectRatio: false,
    walkWorkerKeepsAspectRatio: false,
    workerReachesRegister: false,
    touchRegisterOpens: false,
    scanWorkerKeepsAspectRatio: false,
    firstOrderServedByTouch: false,
    noRuntimeIssues: false
  },
  layout: null,
  initial: null,
  atRegister: null,
  scan: null,
  afterServe: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({
    viewport: report.viewport,
    screen: report.viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36"
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false },
      gameplayStart: () => undefined,
      gameplayStop: () => undefined,
      loadingStart: () => undefined,
      loadingStop: () => undefined,
      setGameContext: () => undefined,
      clearGameContext: () => undefined,
      reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined,
      removeSettingsChangeListener: () => undefined
    } } };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-003", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });
  await page.waitForFunction(() => document.body.dataset.checkoutPresentation === "mature-station-v2", null, { timeout: 15000 });
  await page.waitForTimeout(300);

  report.layout = await page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      softwareLandscape: document.body.dataset.softwareLandscape ?? "false"
    };
  }, CANVAS_SELECTOR);

  report.assertions.softwareLandscapeActive = report.layout?.softwareLandscape === "true";
  report.assertions.canvasFitsViewport = Boolean(
    report.layout &&
    report.layout.width > 300 &&
    report.layout.height > 600 &&
    report.layout.left >= -1 &&
    report.layout.top >= -1 &&
    report.layout.right <= report.layout.viewportWidth + 1 &&
    report.layout.bottom <= report.layout.viewportHeight + 1 &&
    report.layout.scrollWidth <= report.layout.viewportWidth + 1 &&
    report.layout.scrollHeight <= report.layout.viewportHeight + 1
  );

  report.initial = await readState(page);
  report.assertions.matureCheckoutActive = Boolean(
    report.initial.presentation === "mature-station-v2" &&
    report.initial.matteMode === "connected-edge-clean-v3" &&
    report.initial.worker?.texture?.includes("--checkout-worker-idle-matte-clean-v3")
  );
  report.assertions.idleWorkerKeepsAspectRatio = workerAspectSafe(report.initial.worker);
  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mobile-initial.png"), fullPage: true });

  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    scene?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point: SERVICE_POINT });

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 10000 });
  report.atRegister = await readState(page);
  report.assertions.walkWorkerKeepsAspectRatio = workerAspectSafe(report.atRegister.worker);
  report.assertions.workerReachesRegister = Boolean(
    report.initial.worker && report.atRegister.worker &&
    Math.hypot(
      report.atRegister.worker.x - report.initial.worker.x,
      report.atRegister.worker.y - report.initial.worker.y
    ) > 80
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mobile-register-ready.png"), fullPage: true });

  const cdp = await context.newCDPSession(page);
  await tapHudAction(page, cdp);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "serve"
  ), SCENE_KEY, { timeout: 5000 });
  report.assertions.touchRegisterOpens = true;

  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 10000 });
  await tapHudAction(page, cdp);

  await page.waitForFunction((sceneKey) => {
    const worker = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("checkout-worker");
    return String(worker?.texture?.key ?? "").includes("--checkout-worker-scan-matte-clean-v3");
  }, SCENE_KEY, { timeout: 2500 });
  report.scan = await readState(page);
  report.assertions.scanWorkerKeepsAspectRatio = workerAspectSafe(report.scan.worker);
  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mobile-scan.png"), fullPage: true });

  await page.waitForFunction((sceneKey) => (
    (window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().customersServed ?? 0) >= 1
  ), SCENE_KEY, { timeout: 6000 });
  await page.waitForTimeout(450);
  report.afterServe = await readState(page);
  report.assertions.firstOrderServedByTouch = report.afterServe.controller?.customersServed === 1;
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 3 mobile checkout audit failed: ${failed.join(", ")}`);

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

console.log(JSON.stringify({ assertions: report.assertions, layout: report.layout, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

function workerAspectSafe(worker) {
  return Boolean(
    worker &&
    Number.isFinite(worker.scaleX) &&
    Number.isFinite(worker.scaleY) &&
    Math.abs(Math.abs(worker.scaleX) - Math.abs(worker.scaleY)) <= SCALE_EPSILON
  );
}

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("checkout-worker");
    return {
      presentation: document.body.dataset.checkoutPresentation ?? null,
      matteMode: document.body.dataset.checkoutMatte ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      worker: worker ? {
        x: worker.x,
        y: worker.y,
        texture: worker.texture?.key ?? null,
        displayWidth: worker.displayWidth ?? 0,
        displayHeight: worker.displayHeight ?? 0,
        scaleX: worker.scaleX ?? null,
        scaleY: worker.scaleY ?? null,
        visible: worker.visible ?? false
      } : null
    };
  }, SCENE_KEY);
}

async function tapHudAction(page, cdp) {
  const action = await page.evaluate((sceneKey) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return object && object.visible && object.input?.enabled
      ? { x: object.x, y: object.y }
      : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Checkout HUD action is not touch-ready");
  const point = await logicalToScreen(page, action.x, action.y);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 3, x: point.x, y: point.y, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(45);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function logicalToScreen(page, logicalX, logicalY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const softwareLandscape = await page.evaluate(() => document.body.dataset.softwareLandscape === "true");
  if (softwareLandscape) {
    return {
      x: box.x + box.width - (logicalY / LOGICAL_HEIGHT) * box.width,
      y: box.y + (logicalX / LOGICAL_WIDTH) * box.height
    };
  }
  return {
    x: box.x + (logicalX / LOGICAL_WIDTH) * box.width,
    y: box.y + (logicalY / LOGICAL_HEIGHT) * box.height
  };
}

function attachListeners(page, target) {
  page.on("console", (message) => {
    if (message.type() === "error") target.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => target.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
