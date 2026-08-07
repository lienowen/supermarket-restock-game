import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4180;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

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

await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    capacityGateAppears: false,
    sixDeliveryBoxesVisible: false,
    threeSizeBaysVisible: false,
    emptyCapacityCartVisible: false,
    wrongSizeRejected: false,
    wrongSizeDoesNotAdvance: false,
    firstLoadCompletes: false,
    loadedCapacityCartVisible: false,
    secondLoadCompletes: false,
    deliveryContinues: false
  },
  afterWrong: null,
  afterFirstLoad: null,
  afterComplete: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
  await context.addInitScript(() => {
    window.CrazyGames = {
      SDK: {
        init: async () => undefined,
        game: {
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
        }
      }
    };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(
    `${ORIGIN}/?test=1&briefing=0&cartload=1&level=starter-level-006`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-006",
    null,
    { timeout: 30000 }
  );

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true }, 20000);
  await page.waitForFunction(
    () => document.body.dataset.cartCapacityLoad === "active",
    null,
    { timeout: 20000 }
  );

  const overlay = page.locator("#cart-capacity-load");
  await overlay.waitFor({ state: "visible", timeout: 10000 });
  report.assertions.capacityGateAppears = await overlay.isVisible();
  report.assertions.sixDeliveryBoxesVisible = await page.locator("#cart-capacity-options [data-case-id]").count() === 6;
  report.assertions.threeSizeBaysVisible = await page.locator("#cart-capacity-slots [data-capacity-lane-id]").count() === 3;
  report.assertions.emptyCapacityCartVisible = /equipment-capacity-cart-empty\.png/.test(
    await page.locator("#cart-capacity-cart-image").getAttribute("src") ?? ""
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "cart-capacity-active.png"),
    fullPage: true
  });

  await dragToLane(page, "delivery-small-a", "large-bay");
  await page.waitForTimeout(420);
  const afterWrong = await readState(page);
  report.afterWrong = afterWrong;
  report.assertions.wrongSizeRejected = (
    afterWrong.loaded === "0" &&
    /does not fit/i.test(afterWrong.feedback)
  );
  report.assertions.wrongSizeDoesNotAdvance = (
    afterWrong.snapshot?.step === "load" &&
    afterWrong.snapshot?.boxLoaded === false
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "cart-capacity-wrong-size.png"),
    fullPage: true
  });

  await dragToLane(page, "delivery-large-a", "large-bay");
  await dragToLane(page, "delivery-medium-a", "medium-bay");
  await dragToLane(page, "delivery-small-a", "small-bay");
  await page.waitForFunction(
    () => document.body.dataset.cartCapacityLoaded === "3",
    null,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () => document.querySelector("#cart-capacity-cart-image")?.getAttribute("src")?.includes("equipment-capacity-cart-loaded.png") === true,
    null,
    { timeout: 6000 }
  );
  report.assertions.loadedCapacityCartVisible = true;
  await page.screenshot({
    path: join(OUTPUT_DIR, "cart-capacity-first-load-full.png"),
    fullPage: true
  });
  await page.waitForFunction(
    () => document.body.dataset.cartCapacityRound === "2",
    null,
    { timeout: 6000 }
  );
  const afterFirstLoad = await readState(page);
  report.afterFirstLoad = afterFirstLoad;
  report.assertions.firstLoadCompletes = (
    afterFirstLoad.loaded === "3" &&
    afterFirstLoad.round === "2" &&
    afterFirstLoad.snapshot?.step === "load"
  );

  await dragToLane(page, "delivery-large-b", "large-bay");
  await dragToLane(page, "delivery-medium-b", "medium-bay");
  await dragToLane(page, "delivery-small-b", "small-bay");
  await page.waitForFunction(
    () => document.body.dataset.cartCapacityLoad === "complete",
    null,
    { timeout: 12000 }
  );
  const afterComplete = await readState(page);
  report.afterComplete = afterComplete;
  report.assertions.secondLoadCompletes = (
    afterComplete.loaded === "6" &&
    afterComplete.snapshot?.boxLoaded === true
  );

  await waitForSnapshotAnyStep(page, ["push", "park", "open", "restock"], 25000);
  const continued = await readState(page);
  report.assertions.deliveryContinues = (
    continued.snapshot?.boxLoaded === true &&
    ["push", "park", "open", "restock"].includes(continued.snapshot?.step)
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "cart-capacity-delivery-continues.png"),
    fullPage: true
  });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Cart capacity audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "cart-capacity-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function dragToLane(page, caseId, laneId) {
  const source = page.locator(`[data-case-id="${caseId}"]`);
  const target = page.locator(`[data-capacity-lane-id="${laneId}"]`);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error(`Case ${caseId} or lane ${laneId} has no bounds`);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 14 });
  await page.mouse.up();
}

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return {
      loaded: document.body.dataset.cartCapacityLoaded,
      round: document.body.dataset.cartCapacityRound,
      state: document.body.dataset.cartCapacityLoad,
      feedback: document.querySelector("#cart-capacity-feedback")?.textContent?.trim() ?? "",
      snapshot: scene?.controller?.snapshot?.() ?? null
    };
  }, GAME_SCENE_KEY);
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout });
}

async function waitForSnapshotAnyStep(page, steps, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, expectedSteps }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && expectedSteps.includes(snapshot.step));
  }, { sceneKey: GAME_SCENE_KEY, expectedSteps: steps }, { timeout });
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
}

function attachListeners(page, auditReport) {
  page.on("console", (message) => {
    if (message.type() === "error") auditReport.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => auditReport.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  const extension = extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}
