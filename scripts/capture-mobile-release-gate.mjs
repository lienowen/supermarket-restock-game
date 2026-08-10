import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mobile-release");
const PORT = 4196;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const MOBILE_VIEWPORT = Object.freeze({ width: 390, height: 844 });

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
    automaticSoftwareLandscape: false,
    startButtonWorks: false,
    joystickMovesPlayer: false,
    level1CaseDragWorks: false,
    level3CheckoutDragWorks: false,
    level6CapacityDragWorks: false,
    level7PatienceDragWorks: false,
    noRuntimeIssues: false
  },
  movement: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });

  await verifyStartAndJoystick(context, report);
  await verifyLevelOneDrag(context, report);
  await verifyCheckoutDrag(context, report);
  await verifyCapacityDrag(context, report);
  await verifyPatienceDrag(context, report);

  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Mobile release gate failed: ${failed.join(", ")}`);
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

async function verifyStartAndJoystick(context, audit) {
  const page = await newAuditedPage(context, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=1&guided=0&level=starter-level-001`, { waitUntil: "networkidle", timeout: 90000 });
  await waitMobileReady(page, "starter-level-001");
  audit.assertions.automaticSoftwareLandscape = await page.evaluate(() => (
    document.body.dataset.softwareLandscape === "true" &&
    document.body.dataset.orientationLock === "software-fallback"
  ));

  const startButton = page.locator("#level-briefing-overlay button").first();
  await startButton.waitFor({ state: "visible", timeout: 15000 });
  await startButton.click();
  await page.waitForFunction(() => {
    const overlay = document.getElementById("level-briefing-overlay");
    return !overlay || getComputedStyle(overlay).display === "none" || overlay.getAttribute("aria-hidden") === "true";
  }, null, { timeout: 8000 });
  audit.assertions.startButtonWorks = true;

  await page.waitForFunction(() => document.body.dataset.mobileMovementControl === "virtual-joystick", null, { timeout: 8000 });
  const before = await readPlayerPosition(page);
  const centre = await gamePointToViewport(page, 158, 742);
  const right = await gamePointToViewport(page, 220, 742);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(right.x, right.y, { steps: 6 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const after = await readPlayerPosition(page);
  const moved = before && after ? Math.hypot(after.x - before.x, after.y - before.y) : 0;
  audit.movement = { before, after, moved };
  audit.assertions.joystickMovesPlayer = moved >= 18;
  await page.screenshot({ path: join(OUTPUT_DIR, "mobile-joystick.png"), fullPage: true });
  await page.close();
}

async function verifyLevelOneDrag(context, audit) {
  const page = await newAuditedPage(context, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=1&level=starter-level-001`, { waitUntil: "networkidle", timeout: 90000 });
  await waitMobileReady(page, "starter-level-001");

  await clickGame(page, 1228, 850);
  await page.waitForFunction((sceneKey) => {
    const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return snapshot?.step === "load" && snapshot?.boxCollected === true;
  }, SCENE_KEY, { timeout: 20000 });
  await page.waitForFunction(() => document.body.dataset.guidedDrag === "active", null, { timeout: 15000 });

  await dragBetween(page, "#guided-drag-source", "#guided-drag-target");
  await page.waitForFunction(() => document.body.dataset.guidedDrag === "complete", null, { timeout: 10000 });
  const snapshot = await page.evaluate((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.() ?? null, SCENE_KEY);
  audit.assertions.level1CaseDragWorks = Boolean(
    snapshot?.boxLoaded === true && ["push", "park", "open", "restock"].includes(snapshot?.step)
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "mobile-level-1-drag.png"), fullPage: true });
  await page.close();
}

async function verifyCheckoutDrag(context, audit) {
  const page = await newAuditedPage(context, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&checkout=1&level=starter-level-003`, { waitUntil: "networkidle", timeout: 90000 });
  await waitMobileReady(page, "starter-level-003");
  await moveCheckoutToService(page);
  await emitHudAction(page);
  await page.waitForFunction(() => document.body.dataset.checkoutScan === "active", null, { timeout: 12000 });
  await page.locator(".checkout-product-card").first().waitFor({ state: "visible", timeout: 8000 });

  await dragBetween(page, ".checkout-product-card", "#checkout-scan-zone");
  await page.waitForFunction(() => Number(document.body.dataset.checkoutScanScanned ?? "0") >= 1, null, { timeout: 6000 });
  audit.assertions.level3CheckoutDragWorks = true;
  await page.screenshot({ path: join(OUTPUT_DIR, "mobile-level-3-drag.png"), fullPage: true });
  await page.close();
}

async function verifyCapacityDrag(context, audit) {
  const page = await newAuditedPage(context, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&cartload=1&level=starter-level-006`, { waitUntil: "networkidle", timeout: 90000 });
  await waitMobileReady(page, "starter-level-006");

  await clickGame(page, 1228, 850);
  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "active", null, { timeout: 20000 });
  await page.locator('[data-case-id="delivery-large-a"]').waitFor({ state: "visible", timeout: 8000 });
  await dragBetween(page, '[data-case-id="delivery-large-a"]', '[data-capacity-lane-id="large-bay"]');
  await page.waitForFunction(() => Number(document.body.dataset.cartCapacityLoaded ?? "0") >= 1, null, { timeout: 7000 });
  audit.assertions.level6CapacityDragWorks = true;
  await page.screenshot({ path: join(OUTPUT_DIR, "mobile-level-6-drag.png"), fullPage: true });
  await page.close();
}

async function verifyPatienceDrag(context, audit) {
  const page = await newAuditedPage(context, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`, { waitUntil: "networkidle", timeout: 90000 });
  await waitMobileReady(page, "starter-level-007");
  await moveCheckoutToService(page);
  await emitHudAction(page);
  await page.waitForFunction(() => document.body.dataset.checkoutPatience === "active", null, { timeout: 12000 });
  await page.locator("#patience-standard-item").waitFor({ state: "visible", timeout: 8000 });

  await dragBetween(page, "#patience-standard-item", "#patience-scan-zone");
  await page.waitForFunction(() => document.body.dataset.checkoutPatienceScanned === "true", null, { timeout: 7000 });
  audit.assertions.level7PatienceDragWorks = true;
  await page.screenshot({ path: join(OUTPUT_DIR, "mobile-level-7-drag.png"), fullPage: true });
  await page.close();
}

async function newAuditedPage(context, audit) {
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") audit.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) audit.failedRequests.push({ url: request.url(), error });
  });
  return page;
}

async function waitMobileReady(page, levelId) {
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction((expected) => document.body.dataset.activeLevel === expected, levelId, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 8000 });
}

async function readPlayerPosition(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.actors?.position?.() ?? scene?.player?.position?.() ?? null;
  }, SCENE_KEY);
}

async function moveCheckoutToService(page) {
  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.player?.setDestination) throw new Error("Checkout navigation missing");
    scene.player.setDestination(point);
  }, { sceneKey: SCENE_KEY, point: { x: 1035, y: 690 } });
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 15000 });
}

async function emitHudAction(page) {
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("HUD action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function dragBetween(page, sourceSelector, targetSelector) {
  const source = page.locator(sourceSelector).first();
  const target = page.locator(targetSelector).first();
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error(`Missing drag bounds: ${sourceSelector} -> ${targetSelector}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function clickGame(page, gameX, gameY) {
  const point = await gamePointToViewport(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function gamePointToViewport(page, gameX, gameY) {
  return page.evaluate(({ gameX, gameY, gameWidth, gameHeight }) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (document.body.dataset.softwareLandscape === "true") {
      const stageWidth = viewportHeight;
      const stageHeight = viewportWidth;
      const fitScale = Math.min(stageWidth / gameWidth, stageHeight / gameHeight);
      const canvasWidth = gameWidth * fitScale;
      const canvasHeight = gameHeight * fitScale;
      const canvasLeft = (stageWidth - canvasWidth) / 2;
      const canvasTop = (stageHeight - canvasHeight) / 2;
      const stageX = canvasLeft + gameX * fitScale;
      const stageY = canvasTop + gameY * fitScale;
      return { x: viewportWidth - stageY, y: stageX };
    }
    const canvas = document.querySelector("#app > canvas:not(#mobile-game-backdrop)");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas missing");
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (gameX / gameWidth) * rect.width,
      y: rect.top + (gameY / gameHeight) * rect.height
    };
  }, { gameX, gameY, gameWidth: GAME_WIDTH, gameHeight: GAME_HEIGHT });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
