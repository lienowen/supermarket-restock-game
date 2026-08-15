import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/cart-capacity-mobile");
const PORT = 4196;
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

const report = {
  generatedAt: new Date().toISOString(),
  viewport: { width: 390, height: 844 },
  assertions: {
    softwareLandscapeActive: false,
    canvasFitsViewport: false,
    panelFitsViewport: false,
    backgroundOnly: false,
    sixSpacePuzzleActive: false,
    sixCasesReadable: false,
    tapCaseLoads: false,
    overCapacityTouchRejected: false,
    undoTouchWorks: false,
    firstTripCompletes: false,
    loadedCartVisible: false,
    touchDragLoads: false,
    secondTripCompletes: false,
    deliveryContinues: false,
    noRuntimeIssues: false
  },
  states: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
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
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });

  const page = await context.newPage();
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&cartload=1&level=starter-level-006`, {
    waitUntil: "networkidle", timeout: 90000
  });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-006", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });

  const cdp = await context.newCDPSession(page);
  const canvasLayout = await page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      softwareLandscape: document.body.dataset.softwareLandscape ?? "false"
    };
  }, CANVAS);
  report.assertions.softwareLandscapeActive = canvasLayout?.softwareLandscape === "true";
  report.assertions.canvasFitsViewport = Boolean(canvasLayout &&
    canvasLayout.left >= -1 && canvasLayout.top >= -1 &&
    canvasLayout.right <= canvasLayout.viewportWidth + 1 &&
    canvasLayout.bottom <= canvasLayout.viewportHeight + 1);

  await tapLogical(page, cdp, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true }, 20000);
  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "active", null, { timeout: 20000 });
  await page.locator("#cart-capacity-load").waitFor({ state: "visible", timeout: 10000 });

  const initial = await readState(page);
  report.states.initial = initial;
  report.assertions.backgroundOnly = initial.sceneDressing === "background-only";
  report.assertions.sixSpacePuzzleActive = initial.mode === "six-unit-combination-v1" &&
    await page.locator("#cart-capacity-bar [data-capacity-segment]").count() === 6 &&
    await page.locator("[data-capacity-lane-id]").count() === 0;
  report.assertions.sixCasesReadable = await page.locator("#cart-capacity-options [data-case-id]").count() === 6 &&
    await page.locator("#cart-capacity-options [data-capacity-units]").count() === 6;

  const panelBounds = await page.locator("#cart-capacity-panel").boundingBox();
  report.assertions.panelFitsViewport = Boolean(panelBounds &&
    panelBounds.x >= -2 && panelBounds.y >= -2 &&
    panelBounds.x + panelBounds.width <= report.viewport.width + 2 &&
    panelBounds.y + panelBounds.height <= report.viewport.height + 2);
  await page.screenshot({ path: join(OUTPUT_DIR, "level-6-mobile-initial.png"), fullPage: true });

  await tapDom(page, cdp, '[data-case-id="delivery-large-a"]');
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "3", null, { timeout: 3000 });
  report.assertions.tapCaseLoads = true;
  await tapDom(page, cdp, '[data-case-id="delivery-small-a"]');
  await tapDom(page, cdp, '[data-case-id="delivery-small-b"]');
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "5", null, { timeout: 3000 });

  await tapDom(page, cdp, '[data-case-id="delivery-medium-a"]');
  await page.waitForFunction(() => document.body.dataset.cartCapacityWrongRejected === "true", null, { timeout: 3000 });
  const overloaded = await readState(page);
  report.states.overloaded = overloaded;
  report.assertions.overCapacityTouchRejected = overloaded.units === "5" && /TOO FULL/i.test(overloaded.feedback);

  await tapDom(page, cdp, "#cart-capacity-undo");
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "4", null, { timeout: 3000 });
  const undone = await readState(page);
  report.assertions.undoTouchWorks = undone.units === "4" && undone.undoUsed === "true";

  await tapDom(page, cdp, '[data-case-id="delivery-medium-a"]');
  await page.waitForFunction(() => document.body.dataset.cartCapacityState === "full", null, { timeout: 3000 });
  const firstFull = await readState(page);
  report.states.firstFull = firstFull;
  report.assertions.firstTripCompletes = firstFull.units === "6" && firstFull.round === "1";
  report.assertions.loadedCartVisible = await page.evaluate(() => {
    const image = document.querySelector("#cart-capacity-cart-image");
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 &&
      image.src.includes("equipment-capacity-cart-loaded.png");
  });
  await page.screenshot({ path: join(OUTPUT_DIR, "level-6-mobile-first-trip.png"), fullPage: true });

  await page.waitForFunction(() => document.body.dataset.cartCapacityRound === "2" && document.body.dataset.cartCapacityUnits === "0", null, { timeout: 5000 });
  await dragDom(page, cdp, '[data-case-id="delivery-large-b"]', "#cart-capacity-target");
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "3", null, { timeout: 4000 });
  report.assertions.touchDragLoads = true;
  await tapDom(page, cdp, '[data-case-id="delivery-medium-b"]');
  await tapDom(page, cdp, '[data-case-id="delivery-small-b"]');
  await page.waitForFunction(() => document.body.dataset.cartCapacityState === "full", null, { timeout: 3000 });
  const secondFull = await readState(page);
  report.states.secondFull = secondFull;
  report.assertions.secondTripCompletes = secondFull.units === "6" && secondFull.round === "2";

  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "complete", null, { timeout: 10000 });
  await waitForSnapshotAnyStep(page, ["push", "park", "open", "restock"], 25000);
  const continued = await readState(page);
  report.states.continued = continued;
  report.assertions.deliveryContinues = continued.snapshot?.boxLoaded === true &&
    ["push", "park", "open", "restock"].includes(continued.snapshot?.step);
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-6-mobile-continues.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 6 mobile audit failed: ${failed.join(", ")}`);
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

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      mode: document.body.dataset.cartCapacityMode ?? null,
      state: document.body.dataset.cartCapacityState ?? null,
      units: document.body.dataset.cartCapacityUnits ?? null,
      round: document.body.dataset.cartCapacityRound ?? null,
      undoUsed: document.body.dataset.cartCapacityUndoUsed ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      feedback: document.querySelector("#cart-capacity-feedback")?.textContent?.trim() ?? "",
      snapshot: scene?.controller?.snapshot?.() ?? null
    };
  }, SCENE_KEY);
}

async function tapDom(page, cdp, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing DOM bounds for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }] });
  await page.waitForTimeout(48);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function dragDom(page, cdp, sourceSelector, targetSelector) {
  const source = await page.locator(sourceSelector).boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  if (!source || !target) throw new Error(`Missing drag DOM bounds for ${sourceSelector}`);
  const sx = source.x + source.width / 2;
  const sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, radiusX: 10, radiusY: 10, force: 1 }] });
  for (let index = 1; index <= 10; index += 1) {
    const ratio = index / 10;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: sx + (tx - sx) * ratio, y: sy + (ty - sy) * ratio, radiusX: 10, radiusY: 10, force: 1 }]
    });
    await page.waitForTimeout(24);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function tapLogical(page, cdp, logicalX, logicalY) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Missing game canvas bounds");
  const rotated = await page.evaluate(() => document.body.dataset.softwareLandscape === "true");
  const x = rotated
    ? box.x + box.width - (logicalY / H) * box.width
    : box.x + (logicalX / W) * box.width;
  const y = rotated
    ? box.y + (logicalX / W) * box.height
    : box.y + (logicalY / H) * box.height;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }] });
  await page.waitForTimeout(48);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(target).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, target: expected }, { timeout });
}

async function waitForSnapshotAnyStep(page, steps, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, expectedSteps }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && expectedSteps.includes(snapshot.step));
  }, { sceneKey: SCENE_KEY, expectedSteps: steps }, { timeout });
}

function attach(page, target) {
  page.on("console", (message) => { if (message.type() === "error") target.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => target.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${error}`);
  });
}

function mimeType(path) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
