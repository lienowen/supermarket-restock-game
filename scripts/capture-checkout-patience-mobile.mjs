import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-7-mobile");
const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });
const TARGET_WEIGHTS = [0.5, 1, 1.5, 0.5, 1.5, 1, 0.5, 1.5];
const VIEWPORT = Object.freeze({ width: 390, height: 844 });

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
  viewport: VIEWPORT,
  assertions: {
    softwareLandscapeActive: false,
    canvasFitsViewport: false,
    overlayFitsViewport: false,
    panelFitsViewport: false,
    weightTouchTargetsComfortable: false,
    verifiedScaleLoads: false,
    happyCustomerLoads: false,
    touchWrongWeightCostsPatience: false,
    touchMoodTurnsImpatient: false,
    impatientCustomerLoads: false,
    touchDragScansStandardItem: false,
    touchCorrectWeightWorks: false,
    touchPaymentWorks: false,
    eightCustomersComplete: false,
    noCustomerAbandons: false,
    noRuntimeIssues: false
  },
  moodSession: null,
  completionSession: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const moodContext = await createMobileContext(browser);
  const moodPage = await createReadyPage(moodContext, report);
  const layout = await readLayout(moodPage);
  report.assertions.softwareLandscapeActive = layout.softwareLandscape === "true";
  report.assertions.canvasFitsViewport = fits(layout.canvas, VIEWPORT, 2);
  report.assertions.overlayFitsViewport = fits(layout.overlay, VIEWPORT, 2);
  report.assertions.panelFitsViewport = fits(layout.panel, VIEWPORT, 2);
  report.assertions.weightTouchTargetsComfortable = layout.weightButtons.length === 3 &&
    layout.weightButtons.every((box) => Math.min(box.width, box.height) >= 42);
  report.assertions.verifiedScaleLoads = await imageLoadsWith(
    moodPage, "#produce-scale-visual img", "equipment-produce-scale.png"
  );
  report.assertions.happyCustomerLoads = await imageLoadsWith(
    moodPage, "#checkout-patience-customer-mood", "customer-happy.png"
  );
  await moodPage.screenshot({ path: join(OUTPUT_DIR, "level-7-mobile-initial.png"), fullPage: true });

  const patienceBefore = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  await moodPage.evaluate(() => {
    const wrong = document.querySelector('[data-weight-kg="1"]');
    if (!(wrong instanceof HTMLButtonElement)) throw new Error("Wrong-weight button missing");
    for (let index = 0; index < 4; index += 1) wrong.click();
  });
  await moodPage.waitForFunction(
    () => Number(document.body.dataset.checkoutPatienceMistakes ?? "0") >= 4 &&
      document.body.dataset.checkoutPatienceMood === "impatient",
    null,
    { timeout: 4000 }
  );
  const patienceAfter = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  const moodAbandonments = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceAbandonments ?? "0"));
  report.assertions.touchWrongWeightCostsPatience = patienceBefore - patienceAfter >= 11000 && moodAbandonments === 0;
  report.assertions.touchMoodTurnsImpatient = await moodPage.evaluate(
    () => document.body.dataset.checkoutPatienceMood === "impatient"
  );
  report.assertions.impatientCustomerLoads = await imageLoadsWith(
    moodPage, "#checkout-patience-customer-mood", "customer-impatient.png"
  );
  report.moodSession = { patienceBefore, patienceAfter, abandonments: moodAbandonments };
  await moodPage.screenshot({ path: join(OUTPUT_DIR, "level-7-mobile-impatient.png"), fullPage: true });
  await moodPage.close();
  await moodContext.close();

  const completionContext = await createMobileContext(browser);
  const page = await createReadyPage(completionContext, report);
  const cdp = await completionContext.newCDPSession(page);

  for (let customer = 0; customer < TARGET_WEIGHTS.length; customer += 1) {
    await page.waitForFunction(
      (expected) => document.body.dataset.checkoutPatienceCustomer === String(expected + 1),
      customer,
      { timeout: 12000 }
    );

    // Every customer must accept at least one real Android touch drag.
    await dragDom(page, cdp, "#patience-standard-item", "#patience-scan-zone");
    await page.waitForTimeout(390);
    if (customer === 0) report.assertions.touchDragScansStandardItem = true;

    // Finish larger baskets through the same card's accessible activation path.
    // This avoids spending the customer's patience budget on synthetic drag animation time.
    for (let scan = 0; scan < 6; scan += 1) {
      const done = await page.evaluate(() => document.body.dataset.checkoutPatienceScanned === "true");
      if (done) break;
      await page.locator("#patience-standard-item").press("Enter");
      await page.waitForTimeout(390);
    }
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceScanned === "true",
      null,
      { timeout: 3500 }
    );

    await tapDom(page, cdp, `[data-weight-kg="${TARGET_WEIGHTS[customer]}"]`);
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceWeightCorrect === "true",
      null,
      { timeout: 5000 }
    );
    if (customer === 0) report.assertions.touchCorrectWeightWorks = true;

    await page.waitForFunction(() => {
      const button = document.querySelector("#patience-payment-button");
      return button instanceof HTMLButtonElement && !button.disabled;
    }, null, { timeout: 5000 });
    await tapDom(page, cdp, "#patience-payment-button");
    await waitForSnapshot(page, { customersServed: customer + 1 }, 9000);
    if (customer === 0) report.assertions.touchPaymentWorks = true;
  }

  const final = await waitForSnapshot(page, { step: "complete", customersServed: 8 }, 12000);
  const abandonments = Number(await page.evaluate(() => document.body.dataset.checkoutPatienceAbandonments ?? "0"));
  report.assertions.eightCustomersComplete = final?.step === "complete" && final?.customersServed === 8;
  report.assertions.noCustomerAbandons = abandonments === 0;
  report.completionSession = { final, abandonments };
  await page.screenshot({ path: join(OUTPUT_DIR, "level-7-mobile-complete.png"), fullPage: true });
  await page.close();
  await completionContext.close();

  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 && report.failedRequests.length === 0;
  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 7 mobile audit failed: ${failed.join(", ")}`);
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

async function createMobileContext(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: VIEWPORT,
    screen: VIEWPORT,
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
  return context;
}

async function createReadyPage(context, auditReport) {
  const page = await context.newPage();
  attach(page, auditReport);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`, {
    waitUntil: "networkidle", timeout: 90000
  });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-007" &&
      document.body.dataset.softwareLandscape === "true",
    null,
    { timeout: 30000 }
  );
  await page.evaluate(({ sceneKey, point }) => {
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point: SERVICE_POINT });
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 18000 });
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Checkout action is missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
  await waitForSnapshot(page, { step: "serve", customersServed: 0 }, 10000);
  await page.waitForFunction(() => document.body.dataset.checkoutPatience === "active", null, { timeout: 12000 });
  await page.locator("#checkout-patience-overlay").waitFor({ state: "visible", timeout: 8000 });
  return page;
}

async function readLayout(page) {
  return page.evaluate((canvasSelector) => {
    const rectOf = (element) => {
      if (!(element instanceof HTMLElement) && !(element instanceof HTMLCanvasElement)) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      softwareLandscape: document.body.dataset.softwareLandscape ?? "false",
      canvas: rectOf(document.querySelector(canvasSelector)),
      overlay: rectOf(document.querySelector("#checkout-patience-overlay")),
      panel: rectOf(document.querySelector("#checkout-patience-overlay > div")),
      weightButtons: Array.from(document.querySelectorAll("#produce-weight-choices button"))
        .map((button) => rectOf(button)).filter(Boolean)
    };
  }, CANVAS);
}

function fits(box, viewport, tolerance = 0) {
  return Boolean(box && box.x >= -tolerance && box.y >= -tolerance &&
    box.x + box.width <= viewport.width + tolerance &&
    box.y + box.height <= viewport.height + tolerance);
}

async function tapDom(page, cdp, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing DOM bounds for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(48);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function dragDom(page, cdp, sourceSelector, targetSelector) {
  const source = await page.locator(sourceSelector).boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  if (!source || !target) throw new Error(`Missing drag DOM bounds for ${sourceSelector} -> ${targetSelector}`);
  const sx = source.x + source.width / 2;
  const sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sx, y: sy, radiusX: 10, radiusY: 10, force: 1 }]
  });
  for (let index = 1; index <= 8; index += 1) {
    const ratio = index / 8;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: sx + (tx - sx) * ratio,
        y: sy + (ty - sy) * ratio,
        radiusX: 10,
        radiusY: 10,
        force: 1
      }]
    });
    await page.waitForTimeout(18);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function imageLoadsWith(page, selector, expectedPathFragment) {
  return page.evaluate(({ selector, expected }) => {
    const image = document.querySelector(selector);
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.includes(expected);
  }, { selector, expected: expectedPathFragment });
}

async function readSnapshot(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.() ?? null;
  }, SCENE_KEY);
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(target).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, target: expected }, { timeout });
  return readSnapshot(page);
}

function attach(page, target) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/deprecated|DeprecationWarning/i.test(text)) return;
    target.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => target.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${error}`);
  });
}

function mimeType(path) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}