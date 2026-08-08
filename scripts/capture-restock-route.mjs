import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("restock-route-audit");
const PORT = 4187;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

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
await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    routedPresetActive: false,
    workerStartsAtWorldStart: false,
    firstActionUsesWalkFrame: false,
    carriedCaseFollowsWorker: false,
    workerReachesCartStandPoint: false,
    secondActionUsesPushRoute: false,
    cartFollowsWorkerDuringPush: false,
    reachesCoolerStandPoint: false,
    automaticParkOpenChainCompletes: false,
    noRuntimeIssues: false
  },
  states: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: GAME_WIDTH, height: GAME_HEIGHT }, deviceScaleFactor: 1 });
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-001`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-001", null, { timeout: 30000 });

  const initial = await readState(page, "initial");
  report.states.push(initial);
  report.assertions.routedPresetActive = initial.actorControl === "routed-world-action-chain" && initial.visualPresetId === "restock-golden-standard-v1";
  report.assertions.workerStartsAtWorldStart = Math.abs(initial.worker.x - 920) < 2 && Math.abs(initial.worker.y - 790) < 2;

  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const nav = scene?.actors?.navigationSnapshot?.();
    const worker = scene?.children?.getByName?.("restock-worker");
    return nav?.moving === true && String(worker?.texture?.key ?? "").includes("worker-walk");
  }, SCENE_KEY, { timeout: 3000 });
  report.assertions.firstActionUsesWalkFrame = true;
  report.states.push(await readState(page, "after-walk-observed"));

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    const nav = scene?.actors?.navigationSnapshot?.();
    const worker = scene?.children?.getByName?.("restock-worker");
    const box = scene?.children?.getByName?.("restock-case");
    return Boolean(
      snapshot?.step === "load" &&
      snapshot?.boxCollected === true &&
      nav?.moving === true &&
      box?.visible === true &&
      worker &&
      Math.abs(box.x - worker.x) < 80 &&
      box.y < worker.y - 70
    );
  }, SCENE_KEY, { timeout: 8000 });
  report.assertions.carriedCaseFollowsWorker = true;
  report.states.push(await readState(page, "after-carry-observed"));

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.().step === "load" && scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 8000 });
  const atCart = await readState(page, "at-cart");
  report.states.push(atCart);
  report.assertions.workerReachesCartStandPoint = Math.abs(atCart.worker.x - 1250) < 3 && Math.abs(atCart.worker.y - 800) < 3;

  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    const nav = scene?.actors?.navigationSnapshot?.();
    const worker = scene?.children?.getByName?.("restock-worker");
    return snapshot?.step === "park" && nav?.moving === true && String(worker?.texture?.key ?? "").includes("worker-push");
  }, SCENE_KEY, { timeout: 5000 });
  const pushing = await readState(page, "push-to-cooler");
  report.states.push(pushing);
  report.assertions.secondActionUsesPushRoute = pushing.navigation?.moving === true && pushing.worker.texture?.includes("worker-push");
  report.assertions.cartFollowsWorkerDuringPush = Boolean(
    pushing.cart?.visible === true &&
    Math.abs((pushing.worker.x - pushing.cart.x) - 180) < 8 &&
    Math.abs(pushing.worker.y - pushing.cart.y) < 12
  );

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const nav = scene?.actors?.navigationSnapshot?.();
    return scene?.controller?.snapshot?.().step === "restock" && nav?.moving !== true;
  }, SCENE_KEY, { timeout: 12000 });
  const restock = await readState(page, "restock-ready");
  report.states.push(restock);
  report.assertions.reachesCoolerStandPoint = Math.abs(restock.worker.x - 900) < 3 && Math.abs(restock.worker.y - 760) < 3;
  report.assertions.automaticParkOpenChainCompletes = Boolean(
    restock.controller?.step === "restock" &&
    restock.controller?.boxLoaded === true &&
    restock.controller?.cartAtCooler === true &&
    restock.controller?.boxOpened === true
  );

  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-route-final.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 1 route audit failed: ${failed.join(", ")}`);

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "route-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readState(page, label) {
  return page.evaluate(({ sceneKey, label }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("restock-worker");
    const cart = scene?.children?.getByName?.("restock-cart");
    const caseBox = scene?.children?.getByName?.("restock-case");
    return {
      label,
      actorControl: document.body.dataset.restockActorControl ?? null,
      visualPresetId: scene?.visualPreset?.id ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      interactionReady: scene?.isInteractionReady?.() ?? null,
      navigation: scene?.actors?.navigationSnapshot?.() ?? null,
      worker: worker ? { x: worker.x, y: worker.y, texture: worker.texture?.key ?? null } : null,
      cart: cart ? { x: cart.x, y: cart.y, visible: cart.visible, texture: cart.texture?.key ?? null } : null,
      caseBox: caseBox ? { x: caseBox.x, y: caseBox.y, visible: caseBox.visible, texture: caseBox.texture?.key ?? null } : null
    };
  }, { sceneKey: SCENE_KEY, label });
}

async function clickHudAction(page) {
  const action = await page.evaluate((sceneKey) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return object ? { x: object.x, y: object.y } : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Shift HUD action button is missing");
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(box.x + (action.x / GAME_WIDTH) * box.width, box.y + (action.y / GAME_HEIGHT) * box.height);
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
