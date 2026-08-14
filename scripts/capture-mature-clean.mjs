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
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

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
    cleaningBackgroundActive: false,
    matureCleanPresentationActive: false,
    fourProductionSpillsRegistered: false,
    hudCleanButtonRetired: false,
    toolTapAutoWalksAndCollects: false,
    mopPoseActive: false,
    firstSpillTapAutoWalks: false,
    scrubChangesSpillBeforeCommit: false,
    completedSpillDisappears: false,
    fourthSpillReachable: false,
    fullCleaningCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  afterTools: null,
  scrubMidpoint: null,
  afterFirst: null,
  fourthReady: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&hold=1&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-004", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v3-tap-walk-scrub", null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.cleaningBackgroundActive = initial.environmentKey === "environment-project-cleaning-v2";
  report.assertions.matureCleanPresentationActive = (
    initial.presentation === "mature-clean-v3-tap-walk-scrub" &&
    initial.control === "tap-target-auto-walk-then-drag" &&
    initial.spillArtMode === "water-juice-dirt-production"
  );
  report.assertions.fourProductionSpillsRegistered = (
    initial.spills.length === 4 &&
    initial.spills.map((spill) => spill.sourceKey).join("|") ===
      "spill-water-large|spill-juice-large|spill-dirt-smear-large|spill-water-large" &&
    initial.spills.every((spill) => spill.artTexture?.includes("--clean-spill")) &&
    initial.touchZones.length === 4
  );
  report.assertions.hudCleanButtonRetired = initial.hudActionVisible === false;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-initial.png"), fullPage: true });

  const workerStart = initial.worker;
  await clickLogical(page, initial.toolPoint.x, initial.toolPoint.y);
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "clean"
  ), SCENE_KEY, { timeout: 12000 });
  const afterTools = await readState(page);
  report.afterTools = afterTools;
  report.assertions.toolTapAutoWalksAndCollects = Boolean(
    workerStart &&
    Math.hypot(afterTools.worker.x - workerStart.x, afterTools.worker.y - workerStart.y) > 80 &&
    afterTools.controller?.step === "clean"
  );
  report.assertions.mopPoseActive = Boolean(afterTools.worker?.texture?.includes("worker-a-mop-floor"));
  report.assertions.hudCleanButtonRetired = report.assertions.hudCleanButtonRetired && afterTools.hudActionVisible === false;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-tools-collected.png"), fullPage: true });

  const firstSpot = afterTools.spotPositions[0];
  const beforeFirstPosition = afterTools.worker;
  await clickLogical(page, firstSpot.x, firstSpot.y);
  await waitForInteractionReady(page);
  const atFirst = await readState(page);
  report.assertions.firstSpillTapAutoWalks = Boolean(
    beforeFirstPosition &&
    Math.hypot(atFirst.worker.x - beforeFirstPosition.x, atFirst.worker.y - beforeFirstPosition.y) > 80 &&
    !atFirst.pendingWalk
  );

  await scrubSpill(page, 0, { partial: true });
  const scrubMidpoint = await readState(page);
  report.scrubMidpoint = scrubMidpoint;
  report.assertions.scrubChangesSpillBeforeCommit = Boolean(
    scrubMidpoint.controller?.progress === 0 &&
    scrubMidpoint.scrubProgress > 0 && scrubMidpoint.scrubProgress < 100 &&
    scrubMidpoint.spills[0]?.alpha < 1
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-4-scrub-midpoint.png"), fullPage: true });

  await scrubSpill(page, 0, { partial: false });
  await waitForProgress(page, 1);
  await page.waitForTimeout(360);
  const afterFirst = await readState(page);
  report.afterFirst = afterFirst;
  report.assertions.completedSpillDisappears = afterFirst.spills[0]?.visible === false;

  while (true) {
    const state = await readState(page);
    if (state.controller?.step === "complete") break;
    const index = state.controller.progress;
    const spot = state.spotPositions[index];
    if (!spot) throw new Error(`Missing cleaning spot ${index}`);
    await clickLogical(page, spot.x, spot.y);
    await waitForInteractionReady(page);
    if (index === 3) {
      const fourthReady = await readState(page);
      report.fourthReady = fourthReady;
      report.assertions.fourthSpillReachable = Boolean(
        fourthReady.spills[3]?.visible &&
        fourthReady.touchZones[3]?.enabled &&
        fourthReady.controller?.progress === 3
      );
      await page.screenshot({ path: join(OUTPUT_DIR, "level-4-fourth-spill-ready.png"), fullPage: true });
    }
    await scrubSpill(page, index, { partial: false });
    await waitForProgress(page, index + 1);
    await page.waitForTimeout(320);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.fullCleaningCompletes = Boolean(
    final.controller?.step === "complete" && final.controller.progress === final.controller.total && final.controller.total === 4
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
    const spotPositions = [...(scene?.context?.runtime?.spotPositions ?? [])];
    const spills = spotPositions.map((_point, index) => {
      const number = index + 1;
      const spill = scene?.children?.getByName?.(`clean-spill-${number}`);
      const art = spill?.list?.find?.((entry) => entry?.name === `clean-spill-art-${number}`);
      return spill ? {
        visible: spill.visible,
        alpha: spill.alpha,
        x: spill.x,
        y: spill.y,
        sourceKey: spill.getData?.("spill-source-key") ?? null,
        artTexture: art?.texture?.key ?? null
      } : null;
    }).filter(Boolean);
    const touchZones = spotPositions.map((_point, index) => {
      const zone = scene?.children?.getByName?.(`clean-spill-touch-${index + 1}`);
      return zone ? {
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
        enabled: Boolean(zone.input?.enabled)
      } : null;
    }).filter(Boolean);
    const hudAction = scene?.children?.getByName?.("shift-hud-action");
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      presentation: document.body.dataset.cleaningPresentation ?? null,
      control: document.body.dataset.cleaningControl ?? null,
      spillArtMode: document.body.dataset.cleaningSpillArt ?? null,
      pendingWalk: document.body.dataset.cleaningPendingWalk ?? null,
      scrubProgress: Number(document.body.dataset.cleanScrubProgress ?? "0"),
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions,
      hudActionVisible: Boolean(hudAction?.visible),
      worker: worker ? {
        x: worker.x, y: worker.y,
        texture: worker.texture?.key ?? null,
        displayWidth: worker.displayWidth ?? 0,
        displayHeight: worker.displayHeight ?? 0
      } : null,
      spills,
      touchZones
    };
  }, SCENE_KEY);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 15000 });
  await page.waitForFunction(() => !document.body.dataset.cleaningPendingWalk, null, { timeout: 3000 });
}

async function waitForProgress(page, expected) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return (state?.progress ?? 0) >= expected || state?.step === "complete";
  }, { sceneKey: SCENE_KEY, expected }, { timeout: 7000 });
}

async function clickLogical(page, logicalX, logicalY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (logicalX / LOGICAL_WIDTH) * box.width,
    box.y + (logicalY / LOGICAL_HEIGHT) * box.height
  );
}

async function scrubSpill(page, index, { partial }) {
  const state = await readState(page);
  const spill = state.spills[index];
  if (!spill?.visible) throw new Error(`Spill ${index + 1} is not visible for scrubbing`);
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const toScreen = (x, y) => ({
    x: box.x + (x / LOGICAL_WIDTH) * box.width,
    y: box.y + (y / LOGICAL_HEIGHT) * box.height
  });
  const centre = toScreen(spill.x, spill.y);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  const passes = partial ? 2 : 7;
  for (let pass = 0; pass < passes; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const next = toScreen(spill.x + direction * 72, spill.y + ((pass % 3) - 1) * 14);
    await page.mouse.move(next.x, next.y, { steps: 3 });
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
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
