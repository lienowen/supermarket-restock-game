import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/cart-capacity");
const PORT = 4180;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";

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
    capacityGateAppears: false,
    authoredBackgroundOnly: false,
    sixDeliveryBoxesVisible: false,
    sixSpacePuzzleActive: false,
    oldMatchingBaysRemoved: false,
    emptyCapacityCartVisible: false,
    tapLoadsCase: false,
    overCapacityRejected: false,
    overCapacityDoesNotAdvance: false,
    undoRecoversDeadEnd: false,
    firstTripHitsSix: false,
    loadedCapacityCartVisible: false,
    secondTripStartsEmpty: false,
    dragLoadsCase: false,
    secondTripHitsSix: false,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&cartload=1&level=starter-level-006`, {
    waitUntil: "networkidle", timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-006", null, { timeout: 30000 });

  // activeLevel is written before Phaser finishes Scene.create(). Wait for the
  // actual player/interaction port so the first action cannot be dropped.
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(
      scene?.playerPosition?.() &&
      scene?.controller?.snapshot?.() &&
      scene?.isInteractionReady?.() === true
    );
  }, GAME_SCENE_KEY, { timeout: 30000 });

  // Ask the same scene action used by the HUD. This avoids a brittle hardcoded
  // pixel after HUD/career layout changes while preserving the actual walk + pickup flow.
  await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    scene?.requestCurrentAction?.();
  }, GAME_SCENE_KEY);
  await waitForSnapshot(page, { step: "load", boxCollected: true }, 45000);
  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "active", null, { timeout: 30000 });

  const overlay = page.locator("#cart-capacity-load");
  await overlay.waitFor({ state: "visible", timeout: 15000 });
  const initial = await readState(page);
  report.states.initial = initial;
  report.assertions.capacityGateAppears = await overlay.isVisible();
  report.assertions.authoredBackgroundOnly = initial.sceneDressing === "background-only";
  report.assertions.sixDeliveryBoxesVisible = await page.locator("#cart-capacity-options [data-case-id]").count() === 6;
  report.assertions.sixSpacePuzzleActive = initial.mode === "six-unit-combination-v1" &&
    await page.locator("#cart-capacity-bar [data-capacity-segment]").count() === 6;
  report.assertions.oldMatchingBaysRemoved = await page.locator("[data-capacity-lane-id]").count() === 0;
  report.assertions.emptyCapacityCartVisible = await imageUses(page, "equipment-capacity-cart-empty.png");
  await page.screenshot({ path: join(OUTPUT_DIR, "cart-capacity-initial.png"), fullPage: true });

  await tapCase(page, "delivery-large-a");
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "3", null, { timeout: 8000 });
  report.assertions.tapLoadsCase = true;
  await tapCase(page, "delivery-small-a");
  await tapCase(page, "delivery-small-b");
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "5", null, { timeout: 8000 });

  const beforeOverload = await readState(page);
  await tapCase(page, "delivery-medium-a");
  await page.waitForFunction(() => document.body.dataset.cartCapacityWrongRejected === "true", null, { timeout: 8000 });
  const afterOverload = await readState(page);
  report.states.afterOverload = afterOverload;
  report.assertions.overCapacityRejected = afterOverload.units === "5" && /TOO FULL/i.test(afterOverload.feedback);
  report.assertions.overCapacityDoesNotAdvance = afterOverload.round === "1" &&
    afterOverload.loaded === beforeOverload.loaded && afterOverload.snapshot?.boxLoaded === false;

  await page.locator("#cart-capacity-undo").click();
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "4", null, { timeout: 8000 });
  const afterUndo = await readState(page);
  report.states.afterUndo = afterUndo;
  report.assertions.undoRecoversDeadEnd = afterUndo.undoUsed === "true" && afterUndo.units === "4";

  await tapCase(page, "delivery-medium-a");
  await page.waitForFunction(() => document.body.dataset.cartCapacityState === "full", null, { timeout: 8000 });
  report.assertions.firstTripHitsSix = documentTruthy(await readState(page), "6", "1");
  report.assertions.loadedCapacityCartVisible = await imageUses(page, "equipment-capacity-cart-loaded.png");
  await page.screenshot({ path: join(OUTPUT_DIR, "cart-capacity-first-trip-full.png"), fullPage: true });

  await page.waitForFunction(() => document.body.dataset.cartCapacityRound === "2" && document.body.dataset.cartCapacityUnits === "0", null, { timeout: 12000 });
  const secondStart = await readState(page);
  report.states.secondStart = secondStart;
  report.assertions.secondTripStartsEmpty = secondStart.round === "2" && secondStart.units === "0" && secondStart.loaded === "3";

  await dragCaseToCart(page, "delivery-large-b");
  await page.waitForFunction(() => document.body.dataset.cartCapacityUnits === "3", null, { timeout: 8000 });
  report.assertions.dragLoadsCase = true;
  await tapCase(page, "delivery-medium-b");
  await tapCase(page, "delivery-small-b");
  await page.waitForFunction(() => document.body.dataset.cartCapacityState === "full", null, { timeout: 8000 });
  const secondFull = await readState(page);
  report.states.secondFull = secondFull;
  report.assertions.secondTripHitsSix = secondFull.units === "6" && secondFull.round === "2" && secondFull.fullObserved === "true";
  await page.screenshot({ path: join(OUTPUT_DIR, "cart-capacity-second-trip-full.png"), fullPage: true });

  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "complete", null, { timeout: 15000 });
  await waitForSnapshotAnyStep(page, ["push", "park", "open", "restock"], 35000);
  const continued = await readState(page);
  report.states.continued = continued;
  report.assertions.deliveryContinues = continued.snapshot?.boxLoaded === true &&
    ["push", "park", "open", "restock"].includes(continued.snapshot?.step);
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "cart-capacity-delivery-continues.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 6 desktop audit failed: ${failed.join(", ")}`);
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

function documentTruthy(state, units, round) {
  return state.units === units && state.round === round && state.fullObserved === "true";
}

async function tapCase(page, caseId) {
  await page.locator(`[data-case-id="${caseId}"]`).click();
}

async function dragCaseToCart(page, caseId) {
  const source = page.locator(`[data-case-id="${caseId}"]`);
  const target = page.locator("#cart-capacity-target");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error(`Missing drag bounds for ${caseId}`);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 18 });
  await page.mouse.up();
}

async function imageUses(page, filename) {
  return page.evaluate((expected) => {
    const image = document.querySelector("#cart-capacity-cart-image");
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.includes(expected);
  }, filename);
}

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      mode: document.body.dataset.cartCapacityMode ?? null,
      state: document.body.dataset.cartCapacityState ?? null,
      loaded: document.body.dataset.cartCapacityLoaded ?? null,
      units: document.body.dataset.cartCapacityUnits ?? null,
      round: document.body.dataset.cartCapacityRound ?? null,
      wrongRejected: document.body.dataset.cartCapacityWrongRejected ?? null,
      undoUsed: document.body.dataset.cartCapacityUndoUsed ?? null,
      fullObserved: document.body.dataset.cartCapacityFullObserved ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      feedback: document.querySelector("#cart-capacity-feedback")?.textContent?.trim() ?? "",
      snapshot: scene?.controller?.snapshot?.() ?? null
    };
  }, GAME_SCENE_KEY);
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(target).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout });
}

async function waitForSnapshotAnyStep(page, steps, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, expectedSteps }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && expectedSteps.includes(snapshot.step));
  }, { sceneKey: GAME_SCENE_KEY, expectedSteps: steps }, { timeout });
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
  const extension = extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}