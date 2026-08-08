import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-checkout");
const PORT = 4190;
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
await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

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
  atRegister: null,
  afterOpen: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-003", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.checkoutPresentation === "mature-station-v1", null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.hdEnvironmentActive = initial.environmentKey === "environment-starter-market-restock-hd-v3";
  report.assertions.matureStationActive = initial.presentation === "mature-station-v1" && initial.productMode === "real-product-sprites";
  report.assertions.solidWorkerActive = Boolean(initial.worker?.texture?.includes("--opaque-cutout"));
  report.assertions.solidCustomerActive = Boolean(
    initial.customer?.visible && initial.customer?.texture?.includes("--opaque-cutout") &&
    initial.customer.displayWidth >= 150 && initial.customer.displayHeight >= 260
  );
  report.assertions.threeRealProductsOnBelt = (
    initial.products.length === 3 &&
    initial.products.every((product) => product.kind === "Image" && product.texture?.includes("--checkout-product"))
  );

  const start = initial.worker;
  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    scene?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point: SERVICE_POINT });
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 10000 });
  const atRegister = await readState(page);
  report.atRegister = atRegister;
  report.assertions.workerWalksToRegister = Boolean(
    start && atRegister.worker && Math.hypot(atRegister.worker.x - start.x, atRegister.worker.y - start.y) > 120
  );

  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "serve"
  ), SCENE_KEY, { timeout: 5000 });
  report.afterOpen = await readState(page);
  report.assertions.registerOpens = report.afterOpen.controller?.step === "serve";

  const firstCustomerTexture = report.afterOpen.customer?.texture ?? null;
  await waitForInteractionReady(page);
  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => (
    (window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().customersServed ?? 0) >= 1
  ), SCENE_KEY, { timeout: 5000 });

  // Capture the scan pose while the configured scan timer is still active.
  await page.waitForFunction((sceneKey) => {
    const worker = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("checkout-worker");
    return String(worker?.texture?.key ?? "").includes("worker-a-scan-register") &&
      String(worker?.texture?.key ?? "").includes("--opaque-cutout");
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
    await waitForInteractionReady(page);
    await clickHudAction(page);
    await page.waitForTimeout(900);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.fullCheckoutCompletes = Boolean(
    final.controller?.step === "complete" &&
    final.controller.customersServed === final.controller.totalCustomers
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0
  );

  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Mature checkout audit failed: ${failed.join(", ")}`);

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

async function readState(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("checkout-worker");
    const customer = scene?.children?.getByName?.("checkout-active-customer");
    const products = [1, 2, 3].map((index) => scene?.children?.getByName?.(`checkout-belt-product-${index}`))
      .filter(Boolean)
      .map((product) => ({
        kind: product.constructor?.name ?? null,
        texture: product.texture?.key ?? null,
        displayWidth: product.displayWidth ?? 0,
        displayHeight: product.displayHeight ?? 0,
        visible: product.visible ?? false
      }));
    return {
      environmentKey: document.body.dataset.checkoutEnvironment ?? null,
      presentation: document.body.dataset.checkoutPresentation ?? null,
      productMode: document.body.dataset.checkoutProducts ?? null,
      customerMode: document.body.dataset.checkoutCustomer ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      worker: worker ? {
        x: worker.x, y: worker.y, texture: worker.texture?.key ?? null,
        displayWidth: worker.displayWidth ?? 0, displayHeight: worker.displayHeight ?? 0
      } : null,
      customer: customer ? {
        x: customer.x, y: customer.y, texture: customer.texture?.key ?? null,
        displayWidth: customer.displayWidth ?? 0, displayHeight: customer.displayHeight ?? 0,
        visible: customer.visible ?? false
      } : null,
      products
    };
  }, SCENE_KEY);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 15000 });
}

async function clickHudAction(page) {
  await page.waitForFunction((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return Boolean(action?.visible && action?.input?.enabled);
  }, SCENE_KEY, { timeout: 10000 });
  const action = await page.evaluate((sceneKey) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return object ? { x: object.x, y: object.y } : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Checkout HUD action is missing");
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(box.x + (action.x / 1600) * box.width, box.y + (action.y / 900) * box.height);
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
