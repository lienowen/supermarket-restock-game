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
    v2RestockBackgroundActive: false,
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
  initial: null,
  route: {},
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
  await page.waitForTimeout(250);

  report.initial = await readState(page);
  report.assertions.v2RestockBackgroundActive = (
    report.initial.environmentKey === "environment-restock-zone-v2"
  );
  report.assertions.contextualControlActive = (
    report.initial.levelTwoActorControl === "contextual-walk-auto-pickup-place"
  );
  report.assertions.oldActionButtonRetired = (
    report.initial.placeVisible === false &&
    report.initial.oldTargetVisible === false
  );

  // Walk into the backroom pickup radius. No second action button is pressed.
  await moveToContextPoint(page, "backroomBox");
  await waitForStep(page, ["load"], 10000);
  const afterPickup = await readState(page);
  report.route.afterPickup = afterPickup;
  report.assertions.autoPickupBox = afterPickup.snapshot?.boxCollected === true;

  // Walk to the cart. Proximity performs LOAD_CART + PUSH_CART automatically.
  await moveToContextPoint(page, "cartStart");
  await waitForStep(page, ["push", "park"], 10000);
  const afterLoad = await readState(page);
  report.route.afterLoad = afterLoad;
  report.assertions.autoLoadCart = afterLoad.snapshot?.boxLoaded === true;

  // Walk the loaded cart to the floor point aligned with the V2 cooler background.
  await moveToContextPoint(page, "cartCooler");
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(
      snapshot?.step === "restock" &&
      snapshot?.cartAtCooler === true &&
      snapshot?.boxOpened === true
    );
  }, SCENE_KEY, { timeout: 12000 });
  report.route.restock = await readState(page);
  report.assertions.autoParkAndOpen = true;

  await page.waitForFunction(() => {
    const preview = document.getElementById("restock-memory-preview");
    return document.body.dataset.restockMemory === "preview" && Boolean(preview?.isConnected);
  }, null, { timeout: 8000 });
  report.preview = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const overlay = document.getElementById("restock-memory-preview");
    const cells = [...(overlay?.querySelectorAll?.("#restock-memory-grid > div") ?? [])]
      .map((cell) => ({
        slotIndex: Number(cell.dataset.slotIndex),
        order: Number(cell.dataset.order)
      }))
      .filter((cell) => Number.isInteger(cell.slotIndex) && Number.isInteger(cell.order) && cell.order > 0);
    return {
      cellCount: cells.length,
      sequence: [...cells].sort((a, b) => a.order - b.order).map((cell) => cell.slotIndex),
      planned: [...(scene?.rush?.plannedRowIndexes?.() ?? [])]
    };
  }, SCENE_KEY);
  report.assertions.previewVisible = true;
  report.assertions.previewShowsSixShelves = (
    report.preview.cellCount === 6 &&
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

  // The cart is parked left of the cooler. Move back to it to get one 3-bottle batch.
  await moveToRawPoint(page, await contextualPoint(page, "cart"));
  await page.waitForFunction(
    () => document.body.dataset.levelTwoBatch === "carrying-3",
    null,
    { timeout: 7000 }
  );
  const withBatch = await readState(page);
  report.assertions.autoPickupThreeWater = (
    withBatch.handProductVisible === true &&
    withBatch.contextAction === "move-to-cooler"
  );
  report.assertions.placeAppearsOnlyNearCooler = withBatch.placeVisible === false;

  // Move to the floor stand point in front of the V2 cooler, then PLACE appears.
  await moveToRawPoint(page, await contextualPoint(page, "cooler"));
  await page.waitForFunction(() => (
    document.body.dataset.levelTwoContextAction === "place-ready"
  ), null, { timeout: 7000 });
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.children?.getByName?.("level-two-context-place-control")?.visible === true;
  }, SCENE_KEY, { timeout: 5000 });
  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-place-ready.png"), fullPage: true });

  const beforeFirst = await readState(page);
  await page.mouse.click(1480, 690);
  await page.waitForFunction(({ sceneKey, before }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return (scene?.controller?.snapshot?.().stockedRows ?? 0) > before;
  }, { sceneKey: SCENE_KEY, before: beforeFirst.snapshot?.stockedRows ?? 0 }, { timeout: 6000 });
  const afterFirst = await readState(page);
  report.firstPlacement = afterFirst;
  report.assertions.onePlaceCompletesThreeBottles = (
    (afterFirst.snapshot?.stockedRows ?? 0) === (beforeFirst.snapshot?.stockedRows ?? 0) + 1 &&
    afterFirst.batch === "empty"
  );
  report.assertions.waterBottleScaleSane = await waterBottleScaleIsSane(page);

  // Repeat the mature work loop: return to cart -> auto-pick 3 -> cooler -> PLACE.
  while (true) {
    const state = await readState(page);
    if (state.snapshot?.step === "complete" || (state.snapshot?.stockedRows ?? 0) >= 6) break;

    await moveToRawPoint(page, await contextualPoint(page, "cart"));
    await page.waitForFunction(
      () => document.body.dataset.levelTwoBatch === "carrying-3",
      null,
      { timeout: 7000 }
    );
    await moveToRawPoint(page, await contextualPoint(page, "cooler"));
    await page.waitForFunction(
      () => document.body.dataset.levelTwoContextAction === "place-ready",
      null,
      { timeout: 7000 }
    );
    const before = (await readState(page)).snapshot?.stockedRows ?? 0;
    await page.mouse.click(1480, 690);
    await page.waitForFunction(({ sceneKey, before }) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      const snapshot = scene?.controller?.snapshot?.();
      return (snapshot?.stockedRows ?? 0) > before || snapshot?.step === "complete";
    }, { sceneKey: SCENE_KEY, before }, { timeout: 6000 });
  }

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return snapshot?.step === "complete" || snapshot?.stockedRows === 6;
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
  if (failed.length > 0) {
    throw new Error(`Level 2 contextual audit failed: ${failed.join(", ")}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

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
    if (!position) return false;
    return Math.hypot(position.x - point.x, position.y - point.y) < 22;
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
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const placeRoot = scene?.children?.getByName?.("level-two-context-place-control");
    const oldTarget = scene?.children?.getByName?.("starter-market-interaction-target");
    const hand = scene?.children?.getByName?.("restock-worker-hand-product");
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      levelTwoActorControl: document.body.dataset.levelTwoActorControl ?? null,
      contextAction: document.body.dataset.levelTwoContextAction ?? null,
      batch: document.body.dataset.levelTwoBatch ?? null,
      autoAction: document.body.dataset.levelTwoAutoAction ?? null,
      placeVisible: placeRoot?.visible === true,
      oldTargetVisible: oldTarget?.visible === true,
      handProductVisible: hand?.visible === true,
      player: scene?.actors?.position?.() ?? null,
      snapshot: scene?.controller?.snapshot?.() ?? null,
      rush: scene?.rush?.snapshot?.(scene?.time?.now ?? 0) ?? null
    };
  }, SCENE_KEY);
}

async function waterBottleScaleIsSane(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const bottles = scene?.children?.getAll?.()
      ?.filter?.((child) => String(child?.name ?? "").includes("beverage-cooler-row-") && String(child?.name ?? "").includes("-item-")) ?? [];
    if (bottles.length < 3) return false;
    return bottles.every((bottle) => (
      (bottle.displayWidth ?? bottle.width ?? 999) <= 46 &&
      (bottle.displayHeight ?? bottle.height ?? 999) <= 96
    ));
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
