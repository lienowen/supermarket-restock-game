import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-2-mobile");
const PORT = 4192;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const RESPONSIVE_MOVE_LIMIT_MS = 2600;

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
    virtualJoystickPresent: false,
    touchHotspotsActive: false,
    authoredBackgroundActive: false,
    noAmbientDressing: false,
    caseTapAutoWalks: false,
    cartTapAutoWalks: false,
    coolerTapAutoWalks: false,
    tapNavigationResponsive: false,
    expandedPlaceTouchWorks: false,
    sixShelvesComplete: false,
    noRuntimeIssues: false
  },
  timingsMs: {
    case: 0,
    cartStart: 0,
    cartCooler: 0,
    restockMoves: []
  },
  initial: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-002`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-002",
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.softwareLandscape === "true",
    null,
    { timeout: 10000 }
  );
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
  report.assertions.virtualJoystickPresent = report.initial.joystickVisible;
  report.assertions.touchHotspotsActive = (
    report.initial.mobileTouch === "context-hotspots-v1" &&
    report.initial.mobilePlaceTarget === "expanded-190"
  );
  report.assertions.authoredBackgroundActive = (
    report.initial.environmentKey === "environment-restock-water-l2-v1" &&
    report.initial.layout === "authored-background-v1" &&
    report.initial.sceneDressing === "background-only"
  );
  report.assertions.noAmbientDressing = report.initial.ambientDressingCount === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-mobile-initial.png"), fullPage: true });

  const cdp = await context.newCDPSession(page);
  const world = await worldPoints(page);

  report.timingsMs.case = await tapAndMeasure(page, cdp, world.backroomBox, async () => {
    await page.waitForFunction((sceneKey) => (
      window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().boxCollected === true
    ), SCENE_KEY, { timeout: 10000 });
  });
  report.assertions.caseTapAutoWalks = await lastTouchTargetIs(page, "case");

  report.timingsMs.cartStart = await tapAndMeasure(page, cdp, world.cartStart, async () => {
    await page.waitForFunction((sceneKey) => (
      window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().boxLoaded === true
    ), SCENE_KEY, { timeout: 10000 });
  });
  report.assertions.cartTapAutoWalks = await lastTouchTargetIs(page, "cart-start");

  report.timingsMs.cartCooler = await tapAndMeasure(page, cdp, world.cartCooler, async () => {
    await page.waitForFunction((sceneKey) => {
      const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
      return state?.step === "restock" && state?.cartAtCooler && state?.boxOpened;
    }, SCENE_KEY, { timeout: 12000 });
  });
  report.assertions.coolerTapAutoWalks = await lastTouchTargetIs(page, "cart-cooler");

  await page.waitForFunction(
    () => document.body.dataset.restockMemory === "active",
    null,
    { timeout: 12000 }
  );

  let expandedPlacePassed = true;
  for (let index = 0; index < 6; index += 1) {
    const cartPickup = { x: world.cartCooler.x + 42, y: world.cartCooler.y - 6 };
    const cartMoveMs = await tapAndMeasure(page, cdp, cartPickup, async () => {
      await page.waitForFunction(
        () => document.body.dataset.levelTwoBatch === "carrying-3",
        null,
        { timeout: 7000 }
      );
    });
    report.timingsMs.restockMoves.push(cartMoveMs);

    const coolerPlace = { x: world.beverageCooler.x, y: world.cartCooler.y - 8 };
    const coolerMoveMs = await tapAndMeasure(page, cdp, coolerPlace, async () => {
      await page.waitForFunction(
        () => document.body.dataset.levelTwoContextAction === "place-ready",
        null,
        { timeout: 7000 }
      );
    });
    report.timingsMs.restockMoves.push(coolerMoveMs);

    if (index === 0) {
      await page.screenshot({ path: join(OUTPUT_DIR, "level-2-mobile-place-ready.png"), fullPage: true });
    }

    const before = await stockedRows(page);
    // 68 logical pixels to the right of the visible 58px-radius button:
    // outside the art, inside the 190x190 mobile assist target.
    await tapLogical(page, cdp, 1548, 690);
    await page.waitForFunction(({ sceneKey, before }) => {
      const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
      return (state?.stockedRows ?? 0) > before || state?.step === "complete";
    }, { sceneKey: SCENE_KEY, before }, { timeout: 7000 });

    const accepted = await page.evaluate(() => document.body.dataset.levelTwoMobilePlaceTap === "accepted");
    expandedPlacePassed = expandedPlacePassed && accepted;
  }

  report.assertions.expandedPlaceTouchWorks = expandedPlacePassed;
  const navigationTimings = [
    report.timingsMs.case,
    report.timingsMs.cartStart,
    report.timingsMs.cartCooler,
    ...report.timingsMs.restockMoves
  ];
  report.assertions.tapNavigationResponsive = navigationTimings.every((duration) => (
    duration > 0 && duration <= RESPONSIVE_MOVE_LIMIT_MS
  ));

  report.final = await readState(page);
  report.assertions.sixShelvesComplete = (
    report.final.snapshot?.step === "complete" || report.final.snapshot?.stockedRows === 6
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 2 mobile audit failed: ${failed.join(", ")}`);

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

async function tapAndMeasure(page, cdp, point, waitForResult) {
  const startedAt = Date.now();
  await tapLogical(page, cdp, point.x, point.y);
  await waitForResult();
  return Date.now() - startedAt;
}

async function stockedRows(page) {
  return page.evaluate((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().stockedRows ?? 0
  ), SCENE_KEY);
}

async function lastTouchTargetIs(page, expected) {
  return page.evaluate((value) => document.body.dataset.levelTwoMobileLastTarget === value, expected);
}

async function worldPoints(page) {
  return page.evaluate((sceneKey) => {
    const world = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.context?.world;
    if (!world) throw new Error("Missing Level 2 world context");
    return {
      backroomBox: { x: world.backroomBox.x, y: world.backroomBox.y },
      cartStart: { x: world.cartStart.x, y: world.cartStart.y },
      cartCooler: { x: world.cartCooler.x, y: world.cartCooler.y },
      beverageCooler: { x: world.beverageCooler.x, y: world.beverageCooler.y }
    };
  }, SCENE_KEY);
}

async function tapLogical(page, cdp, logicalX, logicalY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const softwareLandscape = await page.evaluate(() => document.body.dataset.softwareLandscape === "true");

  let x;
  let y;
  if (softwareLandscape) {
    x = box.x + box.width - (logicalY / LOGICAL_HEIGHT) * box.width;
    y = box.y + (logicalX / LOGICAL_WIDTH) * box.height;
  } else {
    x = box.x + (logicalX / LOGICAL_WIDTH) * box.width;
    y = box.y + (logicalY / LOGICAL_HEIGHT) * box.height;
  }

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(42);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const ambientNames = [
      "ambient-produce-display",
      "ambient-backroom-rack",
      "ambient-shopping-cart",
      "ambient-dairy-aisle",
      "ambient-cleaning-aisle",
      "ambient-checkout",
      "ambient-customer-a",
      "ambient-customer-b"
    ];
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      layout: document.body.dataset.levelTwoLayout ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      mobileTouch: document.body.dataset.levelTwoMobileTouch ?? null,
      mobilePlaceTarget: document.body.dataset.levelTwoMobilePlaceTarget ?? null,
      joystickVisible: Boolean(scene?.children?.getByName?.("virtual-movement-joystick")?.visible),
      ambientDressingCount: ambientNames.filter((name) => Boolean(scene?.children?.getByName?.(name))).length,
      snapshot: scene?.controller?.snapshot?.() ?? null
    };
  }, SCENE_KEY);
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
