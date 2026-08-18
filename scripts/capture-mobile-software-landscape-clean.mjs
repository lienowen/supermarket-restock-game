import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mobile-software-landscape-clean");
const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const LEVEL_ID = "starter-level-004";
const SCENE_KEY = "starter-market-shift";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";

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
  assertions: {
    portraitViewport: false,
    softwareLandscapeActive: false,
    softwareLandscapeInputInstalled: false,
    matureCleanPresentationActive: false,
    oldHudActionRetired: false,
    toolTouchZoneEnabled: false,
    physicalToolTapAdvancesToClean: false,
    pointerLandsNearToolPoint: false,
    noRuntimeIssues: false
  },
  before: null,
  tap: null,
  after: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36"
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
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => report.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`));

  await page.goto(
    `${ORIGIN}/?test=1&briefing=0&guided=0&hold=0&level=${LEVEL_ID}`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-004", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v3-tap-walk-scrub", null, { timeout: 15000 });

  const before = await readState(page);
  report.before = before;
  report.assertions.portraitViewport = before.viewport.width < before.viewport.height;
  report.assertions.softwareLandscapeActive = before.softwareLandscape === "true";
  report.assertions.softwareLandscapeInputInstalled = before.softwareLandscapeInput === "canvas-geometry-v2";
  report.assertions.matureCleanPresentationActive = before.cleaningPresentation === "mature-clean-v3-tap-walk-scrub";
  report.assertions.oldHudActionRetired = before.hudActionVisible === false;
  report.assertions.toolTouchZoneEnabled = before.toolTouchZone?.enabled === true;
  await page.screenshot({ path: join(OUTPUT_DIR, "before-tool-tap.png"), fullPage: true });

  const tap = await physicalPointForLogical(page, before.toolPoint.x, before.toolPoint.y);
  report.tap = tap;
  await page.touchscreen.tap(tap.clientX, tap.clientY);

  let advanced = false;
  try {
    await page.waitForFunction((sceneKey) => (
      window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "clean"
    ), SCENE_KEY, { timeout: 12000 });
    advanced = true;
  } catch {
    advanced = false;
  }

  const after = await readState(page);
  report.after = after;
  report.assertions.physicalToolTapAdvancesToClean = advanced && after.controller?.step === "clean";
  report.assertions.pointerLandsNearToolPoint = Boolean(
    after.pointer &&
    Math.hypot(after.pointer.x - before.toolPoint.x, after.pointer.y - before.toolPoint.y) <= 12
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "after-tool-tap.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Mobile software-landscape clean audit failed: ${failed.join(", ")}`);

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

console.log(JSON.stringify({ assertions: report.assertions, tap: report.tap, before: report.before, after: report.after, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readState(page) {
  return page.evaluate(({ sceneKey, canvasSelector }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const canvas = document.querySelector(canvasSelector);
    const zone = scene?.children?.getByName?.("cleaning-cart-touch-zone");
    const hudAction = scene?.children?.getByName?.("shift-hud-action");
    const pointer = window.__IMMERSIVE_GAME__?.input?.activePointer;
    const bodyRect = document.body.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect?.();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyRect: rectJson(bodyRect),
      canvasRect: canvasRect ? rectJson(canvasRect) : null,
      softwareLandscape: document.body.dataset.softwareLandscape ?? null,
      softwareLandscapeInput: document.body.dataset.softwareLandscapeInput ?? null,
      softwareLandscapeInputFallback: document.body.dataset.softwareLandscapeInputFallback ?? null,
      cleaningPresentation: document.body.dataset.cleaningPresentation ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      hudActionVisible: Boolean(hudAction?.visible),
      toolTouchZone: zone ? {
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
        enabled: Boolean(zone.input?.enabled)
      } : null,
      pointer: pointer ? { x: pointer.x, y: pointer.y, worldX: pointer.worldX, worldY: pointer.worldY } : null
    };

    function rectJson(rect) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    }
  }, { sceneKey: SCENE_KEY, canvasSelector: CANVAS_SELECTOR });
}

async function physicalPointForLogical(page, logicalX, logicalY) {
  return page.evaluate(({ canvasSelector, logicalX, logicalY, logicalWidth, logicalHeight }) => {
    const canvas = document.querySelector(canvasSelector);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Game canvas is missing");
    const bodyRect = document.body.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // CSS rotates the untransformed landscape stage 90 degrees clockwise.
    // Convert the transformed canvas rectangle back to stage geometry, place
    // the requested logical point in that stage, then rotate it forward into
    // the portrait browser's physical client coordinates.
    const canvasStageWidth = canvasRect.height;
    const canvasStageHeight = canvasRect.width;
    const canvasCentreStageX = (canvasRect.top + canvasRect.height / 2) - bodyRect.top;
    const canvasCentreStageY = bodyRect.width - ((canvasRect.left + canvasRect.width / 2) - bodyRect.left);
    const canvasStageLeft = canvasCentreStageX - canvasStageWidth / 2;
    const canvasStageTop = canvasCentreStageY - canvasStageHeight / 2;
    const stageX = canvasStageLeft + (logicalX / logicalWidth) * canvasStageWidth;
    const stageY = canvasStageTop + (logicalY / logicalHeight) * canvasStageHeight;
    const clientX = bodyRect.left + bodyRect.width - stageY;
    const clientY = bodyRect.top + stageX;

    return {
      clientX,
      clientY,
      logicalX,
      logicalY,
      bodyRect: { left: bodyRect.left, top: bodyRect.top, width: bodyRect.width, height: bodyRect.height },
      canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }
    };
  }, { canvasSelector: CANVAS_SELECTOR, logicalX, logicalY, logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT });
}

function mimeType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}
