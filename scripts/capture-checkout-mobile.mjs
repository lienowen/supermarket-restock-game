import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-3-mobile");
const PORT = 4193;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-003";
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });

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
    checkoutEnvironmentActive: false,
    scanOverlayVisible: false,
    firstTouchTracksScanner: false,
    allItemsScanByTouch: false,
    paymentUnlocks: false,
    firstCustomerCompletes: false,
    customerAdvances: false,
    noRuntimeIssues: false
  },
  itemCount: 0,
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
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
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
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&checkout=1&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-003", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });
  report.assertions.softwareLandscapeActive = true;
  report.assertions.checkoutEnvironmentActive = await page.evaluate(() => (
    document.body.dataset.checkoutEnvironment === "environment-project-checkout-v2"
  ));

  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    scene?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point: SERVICE_POINT });
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 12000 });

  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Level 3 HUD action is missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "serve"
  ), SCENE_KEY, { timeout: 7000 });
  await page.waitForFunction(() => document.body.dataset.checkoutScan === "active", null, { timeout: 10000 });

  const overlay = page.locator("#checkout-scan-overlay");
  const scanner = page.locator("#checkout-scan-zone");
  await overlay.waitFor({ state: "visible", timeout: 10000 });
  await scanner.waitFor({ state: "visible", timeout: 10000 });
  report.assertions.scanOverlayVisible = true;
  report.itemCount = Number(await page.evaluate(() => document.body.dataset.checkoutScanItems ?? "0"));
  if (report.itemCount < 1) throw new Error("Checkout scan has no items");

  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mobile-scan-active.png"), fullPage: true });
  const cdp = await context.newCDPSession(page);

  for (let itemIndex = 0; itemIndex < report.itemCount; itemIndex += 1) {
    const card = page.locator(".checkout-product-card").nth(itemIndex);
    await card.waitFor({ state: "visible", timeout: 5000 });
    const cardBox = await card.boundingBox();
    const scannerBox = await scanner.boundingBox();
    if (!cardBox || !scannerBox) throw new Error(`Missing drag bounds for checkout item ${itemIndex + 1}`);
    const start = centre(cardBox);
    const end = centre(scannerBox);

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y, radiusX: 8, radiusY: 8, force: 1 }]
    });
    for (let step = 1; step <= 14; step += 1) {
      const t = step / 14;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }]
      });
      if (itemIndex === 0 && step === 13) {
        report.assertions.firstTouchTracksScanner = await page.evaluate(() => (
          document.body.dataset.checkoutMobileDragTarget === "inside"
        ));
      }
      await page.waitForTimeout(18);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction((expected) => (
      Number(document.body.dataset.checkoutScanScanned ?? "0") >= expected
    ), itemIndex + 1, { timeout: 5000 });
  }

  report.assertions.allItemsScanByTouch = Number(
    await page.evaluate(() => document.body.dataset.checkoutScanScanned ?? "0")
  ) === report.itemCount;

  const payment = page.locator("#checkout-payment-button");
  report.assertions.paymentUnlocks = await payment.isEnabled();
  if (!report.assertions.paymentUnlocks) throw new Error("Checkout payment did not unlock after scanning all items");

  const firstCustomerTexture = await page.evaluate((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("checkout-active-customer")?.texture?.key ?? null
  ), SCENE_KEY);
  await payment.evaluate((button) => button.click());
  await page.waitForFunction((sceneKey) => (
    (window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().customersServed ?? 0) >= 1
  ), SCENE_KEY, { timeout: 7000 });
  report.assertions.firstCustomerCompletes = true;

  await page.waitForTimeout(750);
  const nextCustomerTexture = await page.evaluate((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("checkout-active-customer")?.texture?.key ?? null
  ), SCENE_KEY);
  report.assertions.customerAdvances = Boolean(
    firstCustomerTexture && nextCustomerTexture && firstCustomerTexture !== nextCustomerTexture
  );

  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mobile-after-first-customer.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 3 mobile checkout failed: ${failed.join(", ")}`);

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

function centre(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
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
