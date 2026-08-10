import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-2-clarity");
const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-002";

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
    focusedSceneDressing: false,
    ambientClutterAbsent: false,
    shelfRuleHidden: false,
    singleFocusGuideActive: false,
    compactMemoryCard: false,
    maxSixCartBatchIcons: false,
    noLegacyCartBottleStrip: false,
    noRuntimeIssues: false
  },
  initial: null,
  restock: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction((levelId) => document.body.dataset.activeLevel === levelId, LEVEL_ID, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.levelTwoVisualHierarchy === "single-focus-v1", null, { timeout: 10000 });

  report.initial = await readClarityState(page);
  report.assertions.focusedSceneDressing = report.initial.sceneDressing === "level-two-focused";
  report.assertions.ambientClutterAbsent = report.initial.visibleAmbientNames.length === 0;
  report.assertions.shelfRuleHidden = report.initial.shelfRuleVisible === false;
  report.assertions.singleFocusGuideActive = Boolean(
    report.initial.focusGuideVisible && report.initial.focusLabel === "PICK BOX"
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-focused-start.png"), fullPage: true });

  await moveToContextPoint(page, "backroomBox");
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "load", SCENE_KEY, { timeout: 10000 });
  await moveToContextPoint(page, "cartStart");
  await page.waitForFunction((sceneKey) => {
    const step = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step;
    return step === "push" || step === "park";
  }, SCENE_KEY, { timeout: 10000 });
  await moveToContextPoint(page, "cartCooler");
  await page.waitForFunction((sceneKey) => {
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return state?.step === "restock" && state?.boxOpened === true;
  }, SCENE_KEY, { timeout: 15000 });

  await page.waitForFunction(() => document.body.dataset.restockMemory === "preview", null, { timeout: 8000 });
  report.assertions.compactMemoryCard = await page.evaluate(() => {
    const overlay = document.getElementById("restock-memory-preview");
    const grid = document.getElementById("restock-memory-grid");
    const panel = overlay?.firstElementChild;
    if (!(panel instanceof HTMLElement) || !(grid instanceof HTMLElement)) return false;
    return (
      document.body.dataset.levelTwoMemoryPreview === "compact-six-slot" &&
      panel.getBoundingClientRect().width <= 450 &&
      grid.children.length === 6
    );
  });

  await page.waitForFunction(() => document.body.dataset.restockMemory === "active", null, { timeout: 8000 });
  await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const point = { x: scene.context.world.cartCooler.x + 42, y: scene.context.world.cartCooler.y - 6 };
    scene?.actors?.setDestination?.(point);
  }, SCENE_KEY);
  await page.waitForFunction(() => document.body.dataset.levelTwoBatch === "carrying-3", null, { timeout: 8000 });
  await page.waitForTimeout(250);

  report.restock = await readClarityState(page);
  report.assertions.maxSixCartBatchIcons = (
    report.restock.visibleBatchIcons > 0 && report.restock.visibleBatchIcons <= 6 &&
    report.restock.cartInventoryVisual === "six-three-bottle-batches"
  );
  report.assertions.noLegacyCartBottleStrip = report.restock.visibleLegacyCartBottles === 0;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-focused-restock.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Level 2 clarity gate failed: ${failed.join(", ")}`);

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

async function readClarityState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const list = scene?.children?.list ?? [];
    const focus = scene?.children?.getByName?.("level-two-focus-guide");
    const focusLabel = focus?.list?.find?.((entry) => entry?.constructor?.name === "Text" && entry?.text)?.text ?? null;
    const shelfRule = scene?.children?.getByName?.("restock-cooler-shelf-rule");
    const ambientNames = [
      "ambient-produce-display", "ambient-backroom-rack", "ambient-shopping-cart",
      "ambient-dairy-aisle", "ambient-cleaning-aisle", "ambient-checkout",
      "ambient-customer-a", "ambient-customer-b"
    ];
    return {
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      cartInventoryVisual: document.body.dataset.levelTwoCartInventoryVisual ?? null,
      visibleAmbientNames: ambientNames.filter((name) => scene?.children?.getByName?.(name)?.visible === true),
      shelfRuleVisible: shelfRule?.visible === true,
      focusGuideVisible: focus?.visible === true,
      focusLabel,
      visibleBatchIcons: list.filter((entry) => (
        typeof entry?.name === "string" && entry.name.startsWith("level-two-cart-batch-") && entry.visible === true
      )).length,
      visibleLegacyCartBottles: list.filter((entry) => (
        typeof entry?.name === "string" && (
          entry.name.startsWith("restock-level-two-water-") || entry.name.startsWith("level-two-cart-water-")
        ) && entry.visible === true
      )).length
    };
  }, SCENE_KEY);
}

async function moveToContextPoint(page, key) {
  await page.evaluate(({ sceneKey, key }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const point = scene?.context?.world?.[key];
    if (!scene?.actors?.setDestination || !point) throw new Error(`Missing context point ${key}`);
    scene.actors.setDestination(point);
  }, { sceneKey: SCENE_KEY, key });
}

function attachListeners(page, audit) {
  page.on("console", (message) => { if (message.type() === "error") audit.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) audit.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
