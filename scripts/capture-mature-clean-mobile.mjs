import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-clean-mobile");
const PORT = 4193;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-004";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const RESPONSIVE_MOVE_LIMIT_MS = 3600;

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
    matureCleanPresentationActive: false,
    expandedSpillTouchZones: false,
    hudCleanButtonRetired: false,
    touchToolTapAutoWalksAndCollects: false,
    touchSpillTapAutoWalks: false,
    touchScrubGestureWorks: false,
    fourthSpillReachable: false,
    fullCleaningCompletes: false,
    noRuntimeIssues: false
  },
  timingsMs: {
    tools: 0,
    spills: []
  },
  initial: null,
  afterTools: null,
  fourthReady: null,
  final: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&hold=1&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-004", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v3-tap-walk-scrub", null, { timeout: 15000 });
  await page.waitForTimeout(250);

  const layout = await page.evaluate((selector) => {
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

  report.assertions.softwareLandscapeActive = layout?.softwareLandscape === "true";
  report.assertions.canvasFitsViewport = Boolean(
    layout &&
    layout.width > 300 &&
    layout.height > 600 &&
    layout.left >= -1 &&
    layout.top >= -1 &&
    layout.right <= layout.viewportWidth + 1 &&
    layout.bottom <= layout.viewportHeight + 1 &&
    layout.scrollWidth <= layout.viewportWidth + 1 &&
    layout.scrollHeight <= layout.viewportHeight + 1
  );

  report.initial = await readState(page);
  report.assertions.matureCleanPresentationActive = (
    report.initial.presentation === "mature-clean-v3-tap-walk-scrub" &&
    report.initial.control === "tap-target-auto-walk-then-drag" &&
    report.initial.controller?.total === 4
  );
  report.assertions.expandedSpillTouchZones = (
    report.initial.touchZones.length === 4 &&
    report.initial.touchZones.every((zone) => zone.width >= 230 && zone.height >= 170)
  );
  report.assertions.hudCleanButtonRetired = report.initial.hudActionVisible === false;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mobile-initial.png"), fullPage: true });

  const cdp = await context.newCDPSession(page);
  const workerStart = report.initial.worker;
  const toolsStartedAt = Date.now();
  await tapLogical(page, cdp, report.initial.toolPoint.x, report.initial.toolPoint.y);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "clean"
  ), SCENE_KEY, { timeout: 12000 });
  report.timingsMs.tools = Date.now() - toolsStartedAt;
  report.afterTools = await readState(page);
  report.assertions.touchToolTapAutoWalksAndCollects = Boolean(
    workerStart &&
    Math.hypot(report.afterTools.worker.x - workerStart.x, report.afterTools.worker.y - workerStart.y) > 80 &&
    report.timingsMs.tools <= RESPONSIVE_MOVE_LIMIT_MS
  );
  report.assertions.hudCleanButtonRetired = report.assertions.hudCleanButtonRetired && report.afterTools.hudActionVisible === false;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mobile-tools-collected.png"), fullPage: true });

  let tapWalkPassed = true;
  let scrubPassed = true;
  for (let index = 0; index < 4; index += 1) {
    const state = await readState(page);
    const spot = state.spotPositions[index];
    if (!spot) throw new Error(`Missing mobile cleaning spot ${index + 1}`);
    const beforeWorker = state.worker;
    const moveStartedAt = Date.now();
    await tapLogical(page, cdp, spot.x, spot.y);
    await waitForInteractionReady(page);
    const ready = await readState(page);
    const moveMs = Date.now() - moveStartedAt;
    report.timingsMs.spills.push(moveMs);
    if (index > 0 || Math.hypot(spot.x - beforeWorker.x, spot.y - beforeWorker.y) > 150) {
      tapWalkPassed = tapWalkPassed && Boolean(
        beforeWorker &&
        Math.hypot(ready.worker.x - beforeWorker.x, ready.worker.y - beforeWorker.y) > 20 &&
        moveMs <= RESPONSIVE_MOVE_LIMIT_MS
      );
    }

    if (index === 3) {
      report.fourthReady = ready;
      report.assertions.fourthSpillReachable = Boolean(
        ready.controller?.progress === 3 &&
        ready.spills[3]?.visible &&
        ready.touchZones[3]?.enabled
      );
      await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mobile-fourth-ready.png"), fullPage: true });
    }

    const beforeProgress = ready.controller?.progress ?? 0;
    await scrubLogical(page, cdp, spot.x, spot.y);
    await page.waitForFunction(({ sceneKey, expected }) => {
      const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
      return (snapshot?.progress ?? 0) >= expected || snapshot?.step === "complete";
    }, { sceneKey: SCENE_KEY, expected: beforeProgress + 1 }, { timeout: 7000 });
    const after = await readState(page);
    scrubPassed = scrubPassed && Boolean(
      (after.controller?.progress ?? 0) >= beforeProgress + 1 || after.controller?.step === "complete"
    );
    await page.waitForTimeout(280);
  }

  report.assertions.touchSpillTapAutoWalks = tapWalkPassed;
  report.assertions.touchScrubGestureWorks = scrubPassed;
  report.final = await readState(page);
  report.assertions.fullCleaningCompletes = Boolean(
    report.final.controller?.step === "complete" &&
    report.final.controller?.progress === 4 &&
    report.final.controller?.total === 4
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 4 mobile clean audit failed: ${failed.join(", ")}`);

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

console.log(JSON.stringify({
  assertions: report.assertions,
  timingsMs: report.timingsMs,
  fatalError: report.fatalError
}, null, 2));
if (thrownError) throw thrownError;

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("clean-worker");
    const spotPositions = [...(scene?.context?.runtime?.spotPositions ?? [])];
    const spills = spotPositions.map((_point, index) => {
      const spill = scene?.children?.getByName?.(`clean-spill-${index + 1}`);
      return spill ? {
        visible: spill.visible,
        alpha: spill.alpha,
        x: spill.x,
        y: spill.y
      } : null;
    }).filter(Boolean);
    const touchZones = spotPositions.map((_point, index) => {
      const zone = scene?.children?.getByName?.(`clean-spill-touch-${index + 1}`);
      return zone ? {
        width: zone.width,
        height: zone.height,
        enabled: Boolean(zone.input?.enabled)
      } : null;
    }).filter(Boolean);
    const hudAction = scene?.children?.getByName?.("shift-hud-action");
    return {
      presentation: document.body.dataset.cleaningPresentation ?? null,
      control: document.body.dataset.cleaningControl ?? null,
      pendingWalk: document.body.dataset.cleaningPendingWalk ?? null,
      scrubProgress: Number(document.body.dataset.cleanScrubProgress ?? "0"),
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions,
      hudActionVisible: Boolean(hudAction?.visible),
      worker: worker ? { x: worker.x, y: worker.y } : null,
      spills,
      touchZones
    };
  }, SCENE_KEY);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 15000 });
  await page.waitForFunction(() => !document.body.dataset.cleaningPendingWalk, null, { timeout: 3000 });
}

async function tapLogical(page, cdp, logicalX, logicalY) {
  const point = await logicalToScreen(page, logicalX, logicalY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: point.x, y: point.y, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(42);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function scrubLogical(page, cdp, logicalX, logicalY) {
  const start = await logicalToScreen(page, logicalX, logicalY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 7, x: start.x, y: start.y, radiusX: 12, radiusY: 12, force: 1 }]
  });
  await page.waitForTimeout(35);

  for (let pass = 0; pass < 8; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const target = await logicalToScreen(
      page,
      logicalX + direction * 82,
      logicalY + ((pass % 3) - 1) * 16
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 7, x: target.x, y: target.y, radiusX: 12, radiusY: 12, force: 1 }]
    });
    await page.waitForTimeout(34);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(120);
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
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${error}`);
  });
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
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}
