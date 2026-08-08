import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-clean");
const PORT = 4192;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-004";

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
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
    solidWorkerActive: false,
    matureCleanPresentationActive: false,
    threeProductionSpillsRegistered: false,
    toolsRequireMovement: false,
    toolsCollected: false,
    mopPoseIsSolid: false,
    firstSpillRequiresMovement: false,
    spillSequenceUsesWaterJuiceDirt: false,
    completedSpillDisappears: false,
    fullCleaningCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  afterTools: null,
  afterFirst: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-004", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v1", null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.hdEnvironmentActive = initial.environmentKey === "environment-starter-market-restock-hd-v3";
  report.assertions.solidWorkerActive = Boolean(initial.worker?.texture?.includes("--opaque-cutout"));
  report.assertions.matureCleanPresentationActive = (
    initial.presentation === "mature-clean-v1" && initial.spillArtMode === "water-juice-dirt-production"
  );
  report.assertions.threeProductionSpillsRegistered = (
    initial.spills.length === 3 &&
    initial.spills.map((spill) => spill.sourceKey).join("|") === "spill-water-large|spill-juice-large|spill-dirt-smear-large" &&
    initial.spills.every((spill) => spill.artTexture?.includes("--clean-spill"))
  );

  const workerStart = initial.worker;
  const toolPoint = initial.toolPoint;
  await movePlayer(page, toolPoint);
  await waitForInteractionReady(page);
  const atTools = await readState(page);
  report.assertions.toolsRequireMovement = Boolean(
    workerStart && Math.hypot(atTools.worker.x - workerStart.x, atTools.worker.y - workerStart.y) > 80
  );
  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "clean"
  ), SCENE_KEY, { timeout: 5000 });
  const afterTools = await readState(page);
  report.afterTools = afterTools;
  report.assertions.toolsCollected = afterTools.controller?.step === "clean";
  report.assertions.mopPoseIsSolid = Boolean(
    afterTools.worker?.texture?.includes("worker-a-mop-floor") && afterTools.worker?.texture?.includes("--opaque-cutout")
  );
  report.assertions.spillSequenceUsesWaterJuiceDirt = (
    afterTools.spills.map((spill) => spill.sourceKey).join("|") === "spill-water-large|spill-juice-large|spill-dirt-smear-large"
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-real-spills.png"), fullPage: true });

  const firstSpot = afterTools.spotPositions[0];
  const beforeFirstPosition = afterTools.worker;
  await movePlayer(page, firstSpot);
  await waitForInteractionReady(page);
  const atFirst = await readState(page);
  report.assertions.firstSpillRequiresMovement = Boolean(
    beforeFirstPosition && Math.hypot(atFirst.worker.x - beforeFirstPosition.x, atFirst.worker.y - beforeFirstPosition.y) > 80
  );
  await clickHudAction(page);
  await page.waitForFunction((sceneKey) => (
    (window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().progress ?? 0) >= 1
  ), SCENE_KEY, { timeout: 5000 });
  await page.waitForTimeout(420);
  const afterFirst = await readState(page);
  report.afterFirst = afterFirst;
  report.assertions.completedSpillDisappears = afterFirst.spills[0]?.visible === false;

  while (true) {
    const state = await readState(page);
    if (state.controller?.step === "complete") break;
    const spot = state.spotPositions[state.controller.progress];
    if (!spot) throw new Error(`Missing cleaning spot ${state.controller.progress}`);
    await movePlayer(page, spot);
    await waitForInteractionReady(page);
    await clickHudAction(page);
    await page.waitForTimeout(500);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.fullCleaningCompletes = Boolean(
    final.controller?.step === "complete" && final.controller.progress === final.controller.total
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mature-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Mature clean audit failed: ${failed.join(", ")}`);
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
    const worker = scene?.children?.getByName?.("clean-worker");
    const spills = [1, 2, 3].map((index) => {
      const spill = scene?.children?.getByName?.(`clean-spill-${index}`);
      const art = spill?.list?.find?.((entry) => entry?.name === `clean-spill-art-${index}`);
      return spill ? {
        visible: spill.visible,
        alpha: spill.alpha,
        x: spill.x,
        y: spill.y,
        sourceKey: spill.getData?.("spill-source-key") ?? null,
        artTexture: art?.texture?.key ?? null
      } : null;
    }).filter(Boolean);
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      presentation: document.body.dataset.cleaningPresentation ?? null,
      spillArtMode: document.body.dataset.cleaningSpillArt ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions: [...(scene?.context?.runtime?.spotPositions ?? [])],
      worker: worker ? {
        x: worker.x, y: worker.y,
        texture: worker.texture?.key ?? null,
        displayWidth: worker.displayWidth ?? 0,
        displayHeight: worker.displayHeight ?? 0
      } : null,
      spills
    };
  }, SCENE_KEY);
}

async function movePlayer(page, point) {
  if (!point) throw new Error("Missing clean movement target");
  await page.evaluate(({ sceneKey, point }) => {
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point);
  }, { sceneKey: SCENE_KEY, point });
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
  if (!action) throw new Error("Clean HUD action is missing");
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
