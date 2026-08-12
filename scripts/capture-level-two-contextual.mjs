import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-2");
const PORT = 4188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const EXPECTED_COOLER_TARGETS = Object.freeze([
  Object.freeze({ x: 1090, y: 355 }),
  Object.freeze({ x: 1090, y: 445 }),
  Object.freeze({ x: 1090, y: 535 }),
  Object.freeze({ x: 1365, y: 355 }),
  Object.freeze({ x: 1365, y: 445 }),
  Object.freeze({ x: 1365, y: 535 })
]);
const AMBIENT_DRESSING_NAMES = Object.freeze([
  "ambient-produce-display",
  "ambient-backroom-rack",
  "ambient-shopping-cart",
  "ambient-dairy-aisle",
  "ambient-cleaning-aisle",
  "ambient-checkout",
  "ambient-customer-a",
  "ambient-customer-b"
]);

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
    authoredRestockBackgroundActive: false,
    backgroundOnlyScene: false,
    noAmbientDressing: false,
    realWaterCaseStates: false,
    coolerTargetsAligned: false,
    contextualControlActive: false,
    oldActionButtonRetired: false,
    autoPickupBox: false,
    autoLoadCart: false,
    autoParkAndOpen: false,
    previewVisible: false,
    previewShowsSixShelves: false,
    autoPickupThreeWater: false,
    placeAppearsOnlyNearCooler: false,
    onePlaceCompletesThreeBottles: false,
    waterBottleScaleSane: false,
    sixShelvesComplete: false,
    noRuntimeIssues: false
  },
  preview: null,
  firstPlacement: null,
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
    viewport: { width: GAME_WIDTH, height: GAME_HEIGHT },
    deviceScaleFactor: 1
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
  await page.waitForTimeout(300);

  const initial = await readState(page);
  report.assertions.authoredRestockBackgroundActive = (
    initial.environmentKey === "environment-restock-water-l2-v1" &&
    initial.layout === "authored-background-v1" &&
    initial.coolerBackground === "water-l2-v1"
  );
  report.assertions.backgroundOnlyScene = initial.sceneDressing === "background-only";
  report.assertions.noAmbientDressing = initial.ambientDressingCount === 0;
  report.assertions.realWaterCaseStates = (
    initial.caseClosedKey === "prop-water-case-closed-v2" &&
    initial.caseOpenKey === "prop-water-case-open-v2" &&
    initial.caseClosedKey !== initial.caseOpenKey
  );
  report.assertions.coolerTargetsAligned = initial.coolerTargetsAligned;
  report.assertions.contextualControlActive = initial.actorControl === "contextual-walk-auto-pickup-place";
  report.assertions.oldActionButtonRetired = !initial.placeVisible && !initial.oldTargetVisible;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-authored-initial.png"), fullPage: true });

  await moveToContextPoint(page, "backroomBox");
  await waitForStep(page, ["load"], 10000);
  report.assertions.autoPickupBox = (await readState(page)).snapshot?.boxCollected === true;

  await moveToContextPoint(page, "cartStart");
  await waitForStep(page, ["push", "park"], 10000);
  report.assertions.autoLoadCart = (await readState(page)).snapshot?.boxLoaded === true;

  await moveToContextPoint(page, "cartCooler");
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const state = scene?.controller?.snapshot?.();
    return state?.step === "restock" && state?.cartAtCooler && state?.boxOpened;
  }, SCENE_KEY, { timeout: 12000 });
  report.assertions.autoParkAndOpen = true;

  await page.waitForFunction(() => (
    document.body.dataset.restockMemory === "preview" &&
    Boolean(document.getElementById("restock-memory-preview"))
  ), null, { timeout: 8000 });
  report.preview = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const cells = [...document.querySelectorAll("#restock-memory-grid > div")]
      .map((cell) => ({
        slotIndex: Number(cell.dataset.slotIndex),
        order: Number(cell.dataset.order)
      }))
      .filter((entry) => Number.isInteger(entry.slotIndex) && Number.isInteger(entry.order) && entry.order > 0);
    return {
      sequence: [...cells].sort((a, b) => a.order - b.order).map((entry) => entry.slotIndex),
      planned: [...(scene?.rush?.plannedRowIndexes?.() ?? [])]
    };
  }, SCENE_KEY);
  report.assertions.previewVisible = true;
  report.assertions.previewShowsSixShelves = (
    report.preview.sequence.length === 6 &&
    new Set(report.preview.sequence).size === 6 &&
    report.preview.sequence.every((row, index) => row === report.preview.planned[index])
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-contextual-preview.png"), fullPage: true });

  await page.waitForFunction(
    () => document.body.dataset.restockMemory === "active",
    null,
    { timeout: 8000 }
  );

  await pickBatch(page);
  const carrying = await readState(page);
  report.assertions.autoPickupThreeWater = (
    carrying.batch === "carrying-3" &&
    carrying.handProductVisible &&
    carrying.cartInventory === 15 &&
    carrying.cartInventoryBatches === 5
  );
  report.assertions.placeAppearsOnlyNearCooler = !carrying.placeVisible;

  await moveToRawPoint(page, await contextualPoint(page, "cooler"));
  await page.waitForFunction(
    () => document.body.dataset.levelTwoContextAction === "place-ready",
    null,
    { timeout: 7000 }
  );
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)
      ?.children?.getByName?.("level-two-context-place-control")?.visible === true
  ), SCENE_KEY, { timeout: 5000 });
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-place-ready.png"), fullPage: true });

  const beforeFirst = (await readState(page)).snapshot?.stockedRows ?? 0;
  await clickPlace(page);
  await waitForStockAdvance(page, beforeFirst);
  report.firstPlacement = await readState(page);
  report.assertions.onePlaceCompletesThreeBottles = (
    report.firstPlacement.snapshot?.stockedRows === beforeFirst + 1 &&
    report.firstPlacement.batch === "empty" &&
    report.firstPlacement.cartInventory === 15 &&
    report.firstPlacement.cartInventoryBatches === 5
  );
  report.assertions.waterBottleScaleSane = await waterBottleScaleIsSane(page);

  while (true) {
    const state = await readState(page);
    if (state.snapshot?.step === "complete" || (state.snapshot?.stockedRows ?? 0) >= 6) break;
    await pickBatch(page);
    await moveToRawPoint(page, await contextualPoint(page, "cooler"));
    await page.waitForFunction(
      () => document.body.dataset.levelTwoContextAction === "place-ready",
      null,
      { timeout: 7000 }
    );
    const before = (await readState(page)).snapshot?.stockedRows ?? 0;
    await clickPlace(page);
    await waitForStockAdvance(page, before);
  }

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const state = scene?.controller?.snapshot?.();
    return state?.step === "complete" || state?.stockedRows === 6;
  }, SCENE_KEY, { timeout: 8000 });

  report.final = await readState(page);
  report.assertions.sixShelvesComplete = (
    report.final.snapshot?.step === "complete" || report.final.snapshot?.stockedRows === 6
  );
  report.assertions.waterBottleScaleSane = (
    report.assertions.waterBottleScaleSane && await waterBottleScaleIsSane(page)
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-contextual-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 2 contextual audit failed: ${failed.join(", ")}`);

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

async function pickBatch(page) {
  await moveToRawPoint(page, await contextualPoint(page, "cart"));
  await page.waitForFunction(
    () => document.body.dataset.levelTwoBatch === "carrying-3",
    null,
    { timeout: 7000 }
  );
}

async function clickPlace(page) {
  await page.mouse.click(1480, 690);
}

async function waitForStockAdvance(page, before) {
  await page.waitForFunction(({ sceneKey, before }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const state = scene?.controller?.snapshot?.();
    return (state?.stockedRows ?? 0) > before || state?.step === "complete";
  }, { sceneKey: SCENE_KEY, before }, { timeout: 6000 });
}

async function moveToContextPoint(page, key) {
  await page.evaluate(({ sceneKey, key }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const point = scene?.context?.world?.[key];
    if (!scene?.actors?.setDestination || !point) throw new Error(`Missing context point ${key}`);
    scene.actors.setDestination(point);
  }, { sceneKey: SCENE_KEY, key });
  await page.waitForTimeout(120);
}

async function moveToRawPoint(page, point) {
  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.actors?.setDestination) throw new Error("Missing restock actor navigation");
    scene.actors.setDestination(point);
  }, { sceneKey: SCENE_KEY, point });
  await page.waitForFunction(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const position = scene?.actors?.position?.();
    return Boolean(position && Math.hypot(position.x - point.x, position.y - point.y) < 22);
  }, { sceneKey: SCENE_KEY, point }, { timeout: 8000 });
}

async function contextualPoint(page, kind) {
  return page.evaluate(({ sceneKey, kind }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.context?.world) throw new Error("Missing scene world context");
    if (kind === "cart") {
      return {
        x: scene.context.world.cartCooler.x + 42,
        y: scene.context.world.cartCooler.y - 6
      };
    }
    return {
      x: scene.context.world.beverageCooler.x,
      y: scene.context.world.cartCooler.y - 8
    };
  }, { sceneKey: SCENE_KEY, kind });
}

async function waitForStep(page, steps, timeout) {
  await page.waitForFunction(({ sceneKey, steps }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return steps.includes(scene?.controller?.snapshot?.().step);
  }, { sceneKey: SCENE_KEY, steps }, { timeout });
}

async function readState(page) {
  return page.evaluate(({ sceneKey, expectedTargets, ambientNames }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const actualTargets = expectedTargets.map((_expected, index) => {
      const target = scene?.children?.getByName?.(`beverage-cooler-row-target-${index}`);
      return target ? { x: target.x, y: target.y } : null;
    });
    const coolerTargetsAligned = actualTargets.every((actual, index) => {
      const expected = expectedTargets[index];
      return Boolean(
        actual && expected &&
        Math.abs(actual.x - expected.x) <= 2 &&
        Math.abs(actual.y - expected.y) <= 2
      );
    });
    const ambientDressingCount = ambientNames.filter((name) => (
      Boolean(scene?.children?.getByName?.(name))
    )).length;

    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      caseClosedKey: scene?.context?.levelAssets?.case?.key ?? null,
      caseOpenKey: scene?.context?.levelAssets?.caseOpen?.key ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      layout: document.body.dataset.levelTwoLayout ?? null,
      coolerBackground: document.body.dataset.restockCoolerBackground ?? null,
      actorControl: document.body.dataset.levelTwoActorControl ?? null,
      contextAction: document.body.dataset.levelTwoContextAction ?? null,
      batch: document.body.dataset.levelTwoBatch ?? null,
      cartInventory: Number(document.body.dataset.levelTwoCartInventory ?? "0"),
      cartInventoryBatches: Number(document.body.dataset.levelTwoCartInventoryBatches ?? "0"),
      ambientDressingCount,
      coolerTargetsAligned,
      placeVisible: scene?.children?.getByName?.("level-two-context-place-control")?.visible === true,
      oldTargetVisible: scene?.children?.getByName?.("starter-market-interaction-target")?.visible === true,
      handProductVisible: scene?.children?.getByName?.("restock-worker-hand-product")?.visible === true,
      player: scene?.actors?.position?.() ?? null,
      snapshot: scene?.controller?.snapshot?.() ?? null
    };
  }, {
    sceneKey: SCENE_KEY,
    expectedTargets: EXPECTED_COOLER_TARGETS,
    ambientNames: AMBIENT_DRESSING_NAMES
  });
}

async function waterBottleScaleIsSane(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const texture = scene?.textures?.get?.("level-two-water-bottle-normalized")?.getSourceImage?.();
    const textureWidth = texture instanceof HTMLImageElement ? texture.naturalWidth : texture?.width;
    const textureHeight = texture instanceof HTMLImageElement ? texture.naturalHeight : texture?.height;
    const rows = scene?.cooler?.rowItems ?? [];
    const bottles = rows.flat?.() ?? [];
    return Boolean(
      textureWidth === 30 &&
      textureHeight === 70 &&
      bottles.length >= 3 &&
      bottles.every((bottle) => (
        (bottle.displayWidth ?? bottle.width ?? 999) <= 46 &&
        (bottle.displayHeight ?? bottle.height ?? 999) <= 96
      ))
    );
  }, SCENE_KEY);
}

function attachListeners(page, target) {
  page.on("console", (message) => {
    if (message.type() === "error") target.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => target.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    target.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
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
    default: return "application/octet-stream";
  }
}
