import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/release-level-8");
const PORT = 4193;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-008";

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
    correctLevelLoads: false,
    sixSpillsCreated: false,
    toolsCollected: false,
    allSixSpillsScrubbable: false,
    levelCompletes: false,
    noRuntimeIssues: false
  },
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
  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&hold=1&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction((levelId) => document.body.dataset.activeLevel === levelId, LEVEL_ID, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.cleaningPresentation === "mature-clean-v2-scrub", null, { timeout: 15000 });

  let state = await readState(page);
  report.assertions.correctLevelLoads = state.environmentKey === "environment-project-cleaning-v2";
  report.assertions.sixSpillsCreated = state.spotPositions.length === 6 && state.spills.length === 6;

  await movePlayer(page, state.toolPoint);
  await waitReady(page);
  await emitAction(page);
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === "clean", SCENE_KEY, { timeout: 5000 });
  report.assertions.toolsCollected = true;

  let completedScrubs = 0;
  while (true) {
    state = await readState(page);
    if (state.controller?.step === "complete") break;
    const index = state.controller?.progress ?? 0;
    const point = state.spotPositions[index];
    if (!point) throw new Error(`Level 8 missing spot ${index + 1}`);
    await movePlayer(page, point);
    await waitReady(page);
    await scrub(page, index);
    await page.waitForFunction(({ sceneKey, expected }) => {
      const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
      return snapshot?.step === "complete" || (snapshot?.progress ?? 0) >= expected;
    }, { sceneKey: SCENE_KEY, expected: index + 1 }, { timeout: 7000 });
    completedScrubs += 1;
    await page.waitForTimeout(380);
  }

  report.final = await readState(page);
  report.assertions.allSixSpillsScrubbable = completedScrubs === 6;
  report.assertions.levelCompletes = Boolean(
    report.final.controller?.step === "complete" &&
    report.final.controller.progress === 6 &&
    report.final.controller.total === 6
  );
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-8-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Level 8 release gate failed: ${failed.join(", ")}`);
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
    const spotPositions = [...(scene?.context?.runtime?.spotPositions ?? [])];
    const spills = spotPositions.map((_, index) => scene?.children?.getByName?.(`clean-spill-${index + 1}`)).filter(Boolean).map((spill) => ({
      x: spill.x, y: spill.y, visible: spill.visible, alpha: spill.alpha
    }));
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions,
      spills
    };
  }, SCENE_KEY);
}

async function movePlayer(page, point) {
  if (!point) throw new Error("Missing movement point");
  await page.evaluate(({ sceneKey, point }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.player?.setDestination) throw new Error("Missing player navigation");
    scene.player.setDestination(point);
  }, { sceneKey: SCENE_KEY, point });
}

async function waitReady(page) {
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 15000 });
}

async function emitAction(page) {
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("HUD action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
}

async function scrub(page, index) {
  const state = await readState(page);
  const spill = state.spills[index];
  if (!spill?.visible) throw new Error(`Level 8 spill ${index + 1} is not visible`);
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  const screen = (x, y) => ({ x: box.x + (x / 1600) * box.width, y: box.y + (y / 900) * box.height });
  const centre = screen(spill.x, spill.y);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  for (let pass = 0; pass < 8; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const next = screen(spill.x + direction * 78, spill.y + ((pass % 3) - 1) * 16);
    await page.mouse.move(next.x, next.y, { steps: 3 });
  }
  await page.mouse.up();
}

function attachListeners(page, audit) {
  page.on("console", (message) => { if (message.type() === "error") audit.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message);
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) audit.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
