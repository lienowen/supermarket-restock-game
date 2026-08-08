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
  runtimeIdentity: null,
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

  report.runtimeIdentity = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const actors = scene?.actors;
    const proto = actors ? Object.getPrototypeOf(actors) : null;
    const actorObjects = (scene?.children?.list ?? [])
      .filter((entry) => typeof entry?.name === "string")
      .filter((entry) => /restock|worker|cart|case/i.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        type: entry.constructor?.name ?? null,
        x: entry.x ?? null,
        y: entry.y ?? null,
        visible: entry.visible ?? null,
        texture: entry.texture?.key ?? null
      }));
    return {
      sceneConstructor: scene?.constructor?.name ?? null,
      actorConstructor: actors?.constructor?.name ?? null,
      actorPrototypeMethods: proto ? Object.getOwnPropertyNames(proto).sort() : [],
      actorInstanceKeys: actors ? Object.keys(actors).sort() : [],
      actorControl: document.body.dataset.restockActorControl ?? null,
      visualPresetId: scene?.visualPreset?.id ?? null,
      actorObjects
    };
  }, SCENE_KEY);

  report.states.push(await readState(page, "initial"));
  await clickHudAction(page);
  await page.waitForTimeout(600);
  report.states.push(await readState(page, "after-first-click"));
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "load", SCENE_KEY, { timeout: 8000 });
  report.states.push(await readState(page, "load-start"));
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.().step === "load" && scene?.isInteractionReady?.() === true;
  }, SCENE_KEY, { timeout: 8000 });
  report.states.push(await readState(page, "load-ready"));
  await clickHudAction(page);
  await page.waitForTimeout(800);
  report.states.push(await readState(page, "after-second-click"));
  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-route-final.png"), fullPage: true });
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

console.log(JSON.stringify(report, null, 2));
if (thrownError) throw thrownError;

async function readState(page, label) {
  return page.evaluate(({ sceneKey, label }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const worker = scene?.children?.getByName?.("restock-worker");
    const cart = scene?.children?.getByName?.("restock-cart");
    const caseBox = scene?.children?.getByName?.("restock-case");
    const action = scene?.children?.getByName?.("shift-hud-action");
    return {
      label,
      controller: scene?.controller?.snapshot?.() ?? null,
      pendingAction: scene?.pendingAction ?? null,
      interactionReady: scene?.isInteractionReady?.() ?? null,
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
