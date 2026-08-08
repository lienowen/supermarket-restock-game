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
  states: [],
  assertions: {
    routedActorActive: false,
    firstHudClickStartsRoute: false,
    reachesCaseAndCollects: false,
    carriesCaseTowardCart: false,
    reachesCartStandPoint: false,
    secondHudClickAdvances: false,
    directActionFallbackAdvances: false,
    pushesCartTowardCooler: false,
    reachesRestock: false,
    noRuntimeIssues: false
  },
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

  let state = await readState(page, "initial");
  report.states.push(state);
  report.assertions.routedActorActive = state.actorControl === "routed-world-action-chain" && state.visualPresetId === "restock-golden-standard-v1";

  await clickHudAction(page);
  await page.waitForTimeout(260);
  state = await readState(page, "after-first-click");
  report.states.push(state);
  report.assertions.firstHudClickStartsRoute = state.pendingAction === true && state.navigation?.moving === true;

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.().step === "load";
  }, SCENE_KEY, { timeout: 8000 });
  state = await readState(page, "collected");
  report.states.push(state);
  report.assertions.reachesCaseAndCollects = state.controller?.step === "load" && state.controller?.boxCollected === true;
  report.assertions.carriesCaseTowardCart = state.navigation?.moving === true;

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return snapshot?.step === "load" && scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 8000 });
  state = await readState(page, "cart-ready");
  report.states.push(state);
  report.assertions.reachesCartStandPoint = state.interactionReady === true;

  await clickHudAction(page);
  await page.waitForTimeout(650);
  state = await readState(page, "after-second-hud-click");
  report.states.push(state);
  report.assertions.secondHudClickAdvances = state.controller?.step !== "load";

  if (!report.assertions.secondHudClickAdvances) {
    await page.evaluate((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      scene?.requestCurrentAction?.();
    }, SCENE_KEY);
    await page.waitForTimeout(650);
    state = await readState(page, "after-direct-action-fallback");
    report.states.push(state);
    report.assertions.directActionFallbackAdvances = state.controller?.step !== "load";
  } else {
    report.assertions.directActionFallbackAdvances = true;
  }

  state = await readState(page, "push-route");
  report.assertions.pushesCartTowardCooler = Boolean(
    ["park", "open", "restock"].includes(state.controller?.step) &&
    (state.navigation?.moving === true || state.controller?.step === "restock")
  );

  try {
    await page.waitForFunction((sceneKey) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return scene?.controller?.snapshot?.().step === "restock";
    }, SCENE_KEY, { timeout: 10000 });
    report.assertions.reachesRestock = true;
  } catch {
    report.states.push(await readState(page, "restock-timeout"));
  }

  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-route-final.png"), fullPage: true });
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;

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

console.log(JSON.stringify({ assertions: report.assertions, states: report.states, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function readState(page, label) {
  return page.evaluate(({ sceneKey, label }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const action = scene?.children?.getByName?.("shift-hud-action");
    const worker = scene?.children?.getByName?.("restock-worker");
    const cart = scene?.children?.getByName?.("restock-cart");
    const caseBox = scene?.children?.getByName?.("restock-case");
    return {
      label,
      actorControl: document.body.dataset.restockActorControl ?? null,
      visualPresetId: scene?.visualPreset?.id ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      pendingAction: scene?.pendingAction ?? null,
      interactionReady: scene?.isInteractionReady?.() ?? null,
      gateReady: scene?.interactionGate?.isReady?.() ?? null,
      navigation: scene?.actors?.navigationSnapshot?.() ?? null,
      worker: worker ? { x: worker.x, y: worker.y, texture: worker.texture?.key ?? null } : null,
      cart: cart ? { x: cart.x, y: cart.y, visible: cart.visible, texture: cart.texture?.key ?? null } : null,
      caseBox: caseBox ? { x: caseBox.x, y: caseBox.y, visible: caseBox.visible, texture: caseBox.texture?.key ?? null } : null,
      hudAction: action ? { x: action.x, y: action.y, visible: action.visible, enabled: action.input?.enabled ?? false } : null
    };
  }, { sceneKey: SCENE_KEY, label });
}

async function clickHudAction(page) {
  const action = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const object = scene?.children?.getByName?.("shift-hud-action");
    return object ? { x: object.x, y: object.y } : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Shift HUD action button is missing");
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (action.x / GAME_WIDTH) * box.width,
    box.y + (action.y / GAME_HEIGHT) * box.height
  );
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
