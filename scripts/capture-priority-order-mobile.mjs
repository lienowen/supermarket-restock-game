import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-9-mobile");
const PORT = 4204;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-009";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
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
    portraitViewport: false,
    softwareLandscapeActive: false,
    softwareLandscapeInputInstalled: false,
    sequenceModeActive: false,
    eightProductsVisible: false,
    physicalWrongOrderTapPenalized: false,
    physicalCorrectSequenceCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  afterWrongOrder: null,
  final: null,
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
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36"
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
  const cdp = await context.newCDPSession(page);
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-009", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.findItemsSelectionMode === "sequence", null, { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.findItemsVisibleCount === "8", null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.portraitViewport = initial.viewport.width < initial.viewport.height;
  report.assertions.softwareLandscapeActive = initial.softwareLandscape === "true";
  report.assertions.softwareLandscapeInputInstalled = initial.softwareLandscapeInput === "canvas-geometry-v2";
  report.assertions.sequenceModeActive = initial.selectionMode === "sequence" && initial.challenge?.nextRequiredProductId === "cereal-box";
  report.assertions.eightProductsVisible = initial.visibleCount === "8" && initial.products.length === 8;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-9-mobile-initial.png"), fullPage: true });

  const milk = requireProduct(initial, "find-item-milk-bottle");
  await touchTapLogical(page, cdp, milk.x, milk.y);
  await page.waitForFunction((key) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().mistakes === 1
  ), SCENE_KEY, { timeout: 18000 });
  const afterWrongOrder = await readState(page);
  report.afterWrongOrder = afterWrongOrder;
  report.assertions.physicalWrongOrderTapPenalized = afterWrongOrder.challenge?.mistakes === 1 &&
    afterWrongOrder.challenge?.collectedProductIds?.length === 0 &&
    afterWrongOrder.challenge?.nextRequiredProductId === "cereal-box" &&
    initial.challenge.remainingMs - afterWrongOrder.challenge.remainingMs >= 6500;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-9-mobile-wrong-order.png"), fullPage: true });

  for (const name of ["find-item-cereal-box", "find-item-milk-bottle", "find-item-apple"]) {
    const current = await readState(page);
    const product = requireProduct(current, name);
    const productId = name.replace("find-item-", "");
    await touchTapLogical(page, cdp, product.x, product.y);
    await page.waitForFunction(({ key, id }) => {
      const challenge = window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.();
      return challenge?.collectedProductIds?.includes(id) === true || challenge?.status === "complete";
    }, { key: SCENE_KEY, id: productId }, { timeout: 18000 });
    await page.waitForTimeout(520);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.physicalCorrectSequenceCompletes = final.challenge?.status === "complete" &&
    final.controller?.step === "complete" && final.challenge?.mistakes === 1 &&
    JSON.stringify(final.challenge?.collectedProductIds) === JSON.stringify(["cereal-box", "milk-bottle", "apple"]);
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-9-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 9 Android audit failed: ${failed.join(", ")}`);
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
  return page.evaluate((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const list = scene?.children?.list ?? [];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      softwareLandscape: document.body.dataset.softwareLandscape ?? null,
      softwareLandscapeInput: document.body.dataset.softwareLandscapeInput ?? null,
      selectionMode: document.body.dataset.findItemsSelectionMode ?? null,
      visibleCount: document.body.dataset.findItemsVisibleCount ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      products: list.filter((entry) => typeof entry?.name === "string")
        .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
        .filter((entry) => entry.visible !== false && entry.active !== false)
        .map((entry) => ({ name: entry.name, x: entry.x, y: entry.y }))
    };
  }, SCENE_KEY);
}

function requireProduct(state, name) {
  const product = state.products.find((entry) => entry.name === name);
  if (!product) throw new Error(`Missing visible product ${name}`);
  return product;
}

async function touchTapLogical(page, cdp, logicalX, logicalY) {
  const point = await physicalPointForLogical(page, logicalX, logicalY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.clientX, y: point.clientY, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(52);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function physicalPointForLogical(page, logicalX, logicalY) {
  return page.evaluate(({ logicalX, logicalY, logicalWidth, logicalHeight, canvasSelector }) => {
    const canvas = document.querySelector(canvasSelector);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Game canvas is missing");
    const bodyRect = document.body.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const canvasStageWidth = canvasRect.height;
    const canvasStageHeight = canvasRect.width;
    const canvasCentreStageX = (canvasRect.top + canvasRect.height / 2) - bodyRect.top;
    const canvasCentreStageY = bodyRect.width - ((canvasRect.left + canvasRect.width / 2) - bodyRect.left);
    const canvasStageLeft = canvasCentreStageX - canvasStageWidth / 2;
    const canvasStageTop = canvasCentreStageY - canvasStageHeight / 2;
    const stageX = canvasStageLeft + (logicalX / logicalWidth) * canvasStageWidth;
    const stageY = canvasStageTop + (logicalY / logicalHeight) * canvasStageHeight;
    return {
      clientX: bodyRect.left + bodyRect.width - stageY,
      clientY: bodyRect.top + stageX
    };
  }, { logicalX, logicalY, logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT, canvasSelector: CANVAS });
}

function attach(page, target) {
  page.on("console", (message) => { if (message.type() === "error") target.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => target.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "failed";
    if (!text.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${text}`);
  });
}

function mimeType(path) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp"
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
