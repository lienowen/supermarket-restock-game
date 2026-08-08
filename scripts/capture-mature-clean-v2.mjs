import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-clean");
const PORT = 4192;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const EXPECTED_TYPES = new Set(["spill-water-large", "spill-juice-large", "spill-dirt-smear-large"]);

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
    solidWorkerActive: false,
    matureCleanPresentationActive: false,
    productionSpillTypesPresent: false,
    legacyHoldOverlayRemoved: false,
    toolsRequireMovement: false,
    toolsCollected: false,
    mopPoseIsSolid: false,
    firstSpillRequiresMovement: false,
    scrubChangesSpillBeforeCommit: false,
    allSpillsScrubbed: false,
    fullCleaningCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  afterTools: null,
  firstPartial: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-004`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v2-scrub", null, { timeout: 30000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.hdEnvironmentActive = initial.environmentKey === "environment-starter-market-restock-hd-v3";
  report.assertions.solidWorkerActive = Boolean(initial.worker?.texture?.includes("--opaque-cutout"));
  report.assertions.matureCleanPresentationActive = initial.presentation === "mature-clean-v2-scrub" && initial.spillArtMode === "water-juice-dirt-production";
  const presentTypes = new Set(initial.spills.map((spill) => spill.sourceKey));
  report.assertions.productionSpillTypesPresent = [...EXPECTED_TYPES].every((key) => presentTypes.has(key)) && initial.spills.every((spill) => spill.artTexture?.includes("--clean-spill"));
  report.assertions.legacyHoldOverlayRemoved = await page.evaluate(() => !document.getElementById("hold-work-overlay"));

  const workerStart = initial.worker;
  await movePlayer(page, initial.toolPoint);
  await waitReady(page);
  const atTools = await readState(page);
  report.assertions.toolsRequireMovement = Boolean(workerStart && Math.hypot(atTools.worker.x - workerStart.x, atTools.worker.y - workerStart.y) > 80);
  await clickHudAction(page);
  await waitSnapshot(page, { step: "clean", progress: 0 }, 5000);
  const afterTools = await readState(page);
  report.afterTools = afterTools;
  report.assertions.toolsCollected = true;
  report.assertions.mopPoseIsSolid = Boolean(afterTools.worker?.texture?.includes("worker-a-mop-floor") && afterTools.worker.texture.includes("--opaque-cutout"));
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-real-spills.png"), fullPage: true });

  const firstSpot = afterTools.spotPositions[0];
  const beforeMove = afterTools.worker;
  await movePlayer(page, firstSpot);
  await waitReady(page);
  const atFirst = await readState(page);
  report.assertions.firstSpillRequiresMovement = Boolean(beforeMove && Math.hypot(atFirst.worker.x - beforeMove.x, atFirst.worker.y - beforeMove.y) > 80);
  await scrub(page, atFirst.spills[0], 2);
  const partial = await readState(page);
  report.firstPartial = partial;
  report.assertions.scrubChangesSpillBeforeCommit = partial.controller?.progress === 0 && partial.scrubProgress > 0 && partial.scrubProgress < 100 && partial.spills[0]?.alpha < 1;

  while (true) {
    const state = await readState(page);
    if (state.controller?.step === "complete") break;
    const index = state.controller.progress;
    const spot = state.spotPositions[index];
    const spill = state.spills[index];
    if (!spot || !spill) throw new Error(`Missing dynamic spill ${index + 1}/${state.controller.total}`);
    await movePlayer(page, spot);
    await waitReady(page);
    await scrubUntilAdvance(page, index, spill, state.controller.total);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.allSpillsScrubbed = final.spills.length === final.controller.total && final.spills.every((spill) => spill.visible === false);
  report.assertions.fullCleaningCompletes = final.controller?.step === "complete" && final.controller.progress === final.controller.total;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-mature-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Mature clean audit v2 failed: ${failed.join(", ")}`);
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
    const controller = scene?.controller?.snapshot?.() ?? null;
    const spots = [...(scene?.context?.runtime?.spotPositions ?? [])];
    const spills = spots.map((_, offset) => {
      const index = offset + 1;
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
    const worker = scene?.children?.getByName?.("clean-worker");
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      presentation: document.body.dataset.cleaningPresentation ?? null,
      spillArtMode: document.body.dataset.cleaningSpillArt ?? null,
      scrubProgress: Number(document.body.dataset.cleanScrubProgress ?? "0"),
      controller,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions: spots,
      worker: worker ? { x: worker.x, y: worker.y, texture: worker.texture?.key ?? null } : null,
      spills
    };
  }, SCENE_KEY);
}

async function movePlayer(page, point) {
  await page.evaluate(({ sceneKey, point }) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point), { sceneKey: SCENE_KEY, point });
}

async function waitReady(page) {
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 15000 });
}

async function clickHudAction(page) {
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Clean action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function scrubUntilAdvance(page, index, spill, total) {
  const before = index;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await scrub(page, spill, 6);
    try {
      await page.waitForFunction(({ sceneKey, before, total }) => {
        const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
        return snapshot?.step === "complete" || snapshot?.progress > before || snapshot?.progress === total;
      }, { sceneKey: SCENE_KEY, before, total }, { timeout: 1200 });
      return;
    } catch {
      // Preserve accumulated scrub distance and continue the same stain.
    }
  }
  throw new Error(`Scrub did not advance spill ${index + 1}`);
}

async function scrub(page, spill, passes) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  const toScreen = (x, y) => ({ x: box.x + (x / 1600) * box.width, y: box.y + (y / 900) * box.height });
  const centre = toScreen(spill.x, spill.y);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  for (let pass = 0; pass < passes; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const p = toScreen(spill.x + direction * 72, spill.y + ((pass % 3) - 1) * 14);
    await page.mouse.move(p.x, p.y, { steps: 3 });
  }
  await page.mouse.up();
  await page.waitForTimeout(100);
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
