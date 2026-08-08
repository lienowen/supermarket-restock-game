import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-hunt");
const PORT = 4184;
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
    goldenSceneActive: false,
    hdEnvironmentActive: false,
    hdEnvironmentResolution: false,
    workerIsOpaqueCutout: false,
    workerUsesGoldenScale: false,
    dairyFixtureVisible: false,
    produceFixtureVisible: false,
    eightProductsVisible: false,
    categorySimilarDecoysVisible: false,
    wrongItemCostsTime: false,
    wrongItemDoesNotAdvanceOrder: false,
    orderCompletes: false,
    noRuntimeIssues: false
  },
  presentation: null,
  initialState: null,
  afterMistakeState: null,
  finalState: null,
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
    `${ORIGIN}/?test=1&briefing=0&level=starter-level-005`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.goldenLevel === "level-5-mature-pass-v1",
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.findItemsVisibleCount === "8",
    null,
    { timeout: 15000 }
  );

  const presentation = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const list = scene?.children?.list ?? [];
    const named = (name) => list.find((entry) => entry?.name === name);
    const environment = named("commercial-supermarket-salesfloor");
    const worker = named("find-items-worker");
    const dairy = named("golden-order-dairy-fixture");
    const produce = named("golden-order-aux-fixture-1");
    const source = environment?.texture?.getSourceImage?.();
    const products = list
      .filter((entry) => typeof entry?.name === "string")
      .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
      .filter((entry) => entry.visible !== false && entry.active !== false)
      .map((entry) => ({
        name: entry.name,
        textureKey: entry.texture?.key ?? null,
        x: entry.x,
        y: entry.y,
        displayWidth: entry.displayWidth,
        displayHeight: entry.displayHeight,
        requested: entry.getData?.("requested") === true
      }));
    return {
      goldenLevel: document.body.dataset.goldenLevel ?? null,
      goldenEnvironment: document.body.dataset.goldenEnvironment ?? null,
      environment: environment ? {
        textureKey: environment.texture?.key ?? null,
        sourceWidth: source?.width ?? 0,
        sourceHeight: source?.height ?? 0,
        displayWidth: environment.displayWidth,
        displayHeight: environment.displayHeight
      } : null,
      worker: worker ? {
        textureKey: worker.texture?.key ?? null,
        alpha: worker.alpha,
        displayWidth: worker.displayWidth,
        displayHeight: worker.displayHeight
      } : null,
      dairy: dairy ? {
        visible: dairy.visible,
        displayWidth: dairy.displayWidth,
        displayHeight: dairy.displayHeight
      } : null,
      produce: produce ? {
        visible: produce.visible,
        displayWidth: produce.displayWidth,
        displayHeight: produce.displayHeight
      } : null,
      products
    };
  }, GAME_SCENE_KEY);
  report.presentation = presentation;

  report.assertions.goldenSceneActive = presentation.goldenLevel === "level-5-mature-pass-v1";
  report.assertions.hdEnvironmentActive = (
    presentation.environment?.textureKey === "environment-starter-market-restock-hd-v3" &&
    presentation.goldenEnvironment === "environment-starter-market-restock-hd-v3"
  );
  report.assertions.hdEnvironmentResolution = Boolean(
    presentation.environment &&
    presentation.environment.sourceWidth >= 1600 &&
    presentation.environment.sourceHeight >= 900
  );
  report.assertions.workerIsOpaqueCutout = Boolean(
    presentation.worker &&
    presentation.worker.alpha === 1 &&
    presentation.worker.textureKey?.endsWith("--opaque-cutout")
  );
  report.assertions.workerUsesGoldenScale = Boolean(
    presentation.worker &&
    Math.abs(presentation.worker.displayWidth - 360) <= 2 &&
    Math.abs(presentation.worker.displayHeight - 390) <= 2
  );
  report.assertions.dairyFixtureVisible = Boolean(
    presentation.dairy?.visible &&
    presentation.dairy.displayWidth >= 580 &&
    presentation.dairy.displayHeight >= 340
  );
  report.assertions.produceFixtureVisible = Boolean(
    presentation.produce?.visible &&
    presentation.produce.displayWidth >= 340 &&
    presentation.produce.displayHeight >= 230
  );
  report.assertions.eightProductsVisible = presentation.products.length === 8;

  const visibleDecoyTextures = new Set(
    presentation.products.filter((product) => !product.requested).map((product) => product.textureKey)
  );
  report.assertions.categorySimilarDecoysVisible = [
    "product-oats-canister",
    "product-yogurt-cup",
    "product-banana-bunch",
    "product-grapes-pack",
    "product-peanut-butter"
  ].every((key) => visibleDecoyTextures.has(key));

  report.initialState = await readSearchState(page);
  await page.screenshot({
    path: join(OUTPUT_DIR, "golden-order-hunt-initial.png"),
    fullPage: true
  });

  const oats = presentation.products.find((product) => product.textureKey === "product-oats-canister");
  if (!oats) throw new Error("Golden oats decoy was not found");
  await clickGame(page, oats.x, oats.y);
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.findChallenge?.snapshot?.().mistakes === 1;
  }, GAME_SCENE_KEY, { timeout: 10000 });

  const afterMistake = await readSearchState(page);
  report.afterMistakeState = afterMistake;
  report.assertions.wrongItemCostsTime = (
    report.initialState.challenge.remainingMs - afterMistake.challenge.remainingMs >= 4500
  );
  report.assertions.wrongItemDoesNotAdvanceOrder = (
    afterMistake.controller.progress === 0 &&
    afterMistake.challenge.collectedProductIds.length === 0
  );

  for (const productName of [
    "find-item-milk-bottle",
    "find-item-apple",
    "find-item-cereal-box"
  ]) {
    const state = await readSearchState(page);
    const product = state.products.find((entry) => entry.name === productName);
    if (!product) throw new Error(`Missing requested product sprite: ${productName}`);
    await clickGame(page, product.x, product.y);
    await page.waitForFunction(({ sceneKey, productId }) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return scene?.findChallenge?.snapshot?.().collectedProductIds?.includes(productId) === true;
    }, {
      sceneKey: GAME_SCENE_KEY,
      productId: productName.replace("find-item-", "")
    }, { timeout: 20000 });
  }

  const finalState = await readSearchState(page);
  report.finalState = finalState;
  report.assertions.orderCompletes = (
    finalState.controller.step === "complete" &&
    finalState.challenge.status === "complete" &&
    finalState.challenge.collectedProductIds.length === 3
  );

  await page.screenshot({
    path: join(OUTPUT_DIR, "golden-order-hunt-complete.png"),
    fullPage: true
  });

  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) {
    throw new Error(`Golden Order Hunt audit failed: ${failed.join(", ")}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "report.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readSearchState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const list = scene?.children?.list ?? [];
    const products = list
      .filter((entry) => typeof entry?.name === "string")
      .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
      .filter((entry) => entry.visible !== false && entry.active !== false)
      .map((entry) => ({
        name: entry.name,
        x: entry.x,
        y: entry.y,
        textureKey: entry.texture?.key ?? null,
        requested: entry.getData?.("requested") === true
      }));
    return {
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      products
    };
  }, GAME_SCENE_KEY);
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
