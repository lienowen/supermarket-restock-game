import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-checkout");
const PORT = 4190;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });

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
    hdEnvironmentActive: false,
    matureStationActive: false,
    solidWorkerActive: false,
    solidCustomerActive: false,
    threeRealProductsOnBelt: false,
    workerWalksToRegister: false,
    registerOpens: false,
    firstOrderServed: false,
    customerAdvances: false,
    scanPoseUsesSolidCutout: false,
    fullCheckoutCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  firstServe: null,
  final: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(mockCrazyGames);
  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-003`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.checkoutPresentation === "mature-station-v1", null, { timeout: 30000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.hdEnvironmentActive = initial.environmentKey === "environment-starter-market-restock-hd-v3";
  report.assertions.matureStationActive = initial.presentation === "mature-station-v1" && initial.productMode === "real-product-sprites";
  report.assertions.solidWorkerActive = Boolean(initial.worker?.texture?.includes("--opaque-cutout"));
  report.assertions.solidCustomerActive = Boolean(
    initial.customer?.visible && initial.customer.texture?.includes("--opaque-cutout") &&
    initial.customer.displayWidth >= 150 && initial.customer.displayHeight >= 260
  );
  // Production minification may rename Phaser constructors. Validate the actual
  // render contract instead of constructor.name.
  report.assertions.threeRealProductsOnBelt = initial.products.length === 3 && initial.products.every((product) => (
    product.visible && product.texture?.includes("--checkout-product") &&
    product.displayWidth >= 20 && product.displayHeight >= 20
  ));

  const start = initial.worker;
  await page.evaluate(({ sceneKey, point }) => {
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point: SERVICE_POINT });
  await waitReady(page);
  const atRegister = await readState(page);
  report.assertions.workerWalksToRegister = Boolean(
    start && atRegister.worker && Math.hypot(atRegister.worker.x - start.x, atRegister.worker.y - start.y) > 120
  );

  await clickHudAction(page);
  await waitSnapshot(page, { step: "serve", customersServed: 0 }, 5000);
  report.assertions.registerOpens = true;

  const firstCustomerTexture = (await readState(page)).customer?.texture ?? null;
  await waitReady(page);
  await clickHudAction(page);
  await waitSnapshot(page, { customersServed: 1 }, 5000);
  await page.waitForFunction((sceneKey) => {
    const worker = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("checkout-worker");
    const key = String(worker?.texture?.key ?? "");
    return key.includes("worker-a-scan-register") && key.includes("--opaque-cutout");
  }, SCENE_KEY, { timeout: 2000 });
  report.assertions.scanPoseUsesSolidCutout = true;
  await page.waitForTimeout(700);
  const firstServe = await readState(page);
  report.firstServe = firstServe;
  report.assertions.firstOrderServed = firstServe.controller?.customersServed === 1;
  report.assertions.customerAdvances = Boolean(
    firstServe.customer?.visible && firstServe.customer.texture && firstServe.customer.texture !== firstCustomerTexture
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-3-mature-checkout.png"), fullPage: true });

  while (true) {
    const state = await readState(page);
    if (state.controller?.step === "complete") break;
    await waitReady(page);
    await clickHudAction(page);
    await page.waitForTimeout(900);
  }
  const final = await readState(page);
  report.final = final;
  report.assertions.fullCheckoutCompletes = final.controller?.step === "complete" && final.controller.customersServed === final.controller.totalCustomers;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Mature checkout audit v2 failed: ${failed.join(", ")}`);
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

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("checkout-worker");
    const customer = scene?.children?.getByName?.("checkout-active-customer");
    const products = [1, 2, 3].map((index) => scene?.children?.getByName?.(`checkout-belt-product-${index}`)).filter(Boolean).map((product) => ({
      texture: product.texture?.key ?? null,
      displayWidth: product.displayWidth ?? 0,
      displayHeight: product.displayHeight ?? 0,
      visible: product.visible ?? false
    }));
    return {
      environmentKey: document.body.dataset.checkoutEnvironment ?? null,
      presentation: document.body.dataset.checkoutPresentation ?? null,
      productMode: document.body.dataset.checkoutProducts ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      worker: worker ? { x: worker.x, y: worker.y, texture: worker.texture?.key ?? null } : null,
      customer: customer ? {
        texture: customer.texture?.key ?? null,
        displayWidth: customer.displayWidth ?? 0,
        displayHeight: customer.displayHeight ?? 0,
        visible: customer.visible ?? false
      } : null,
      products
    };
  }, SCENE_KEY);
}

async function waitReady(page) {
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 15000 });
}

async function clickHudAction(page) {
  await page.waitForFunction((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return Boolean(action?.visible && action?.input?.enabled);
  }, SCENE_KEY, { timeout: 10000 });
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Checkout action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function waitSnapshot(page, expected, timeout = 10000) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(expected).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, expected }, { timeout });
}

function mockCrazyGames() {
  window.CrazyGames = { SDK: { init: async () => undefined, game: {
    settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
    loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
    clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
    addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
  } } };
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
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
