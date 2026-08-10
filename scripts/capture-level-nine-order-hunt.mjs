import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/release-level-9");
const PORT = 4194;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-009";
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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    correctLevelLoads: false,
    requestedAndDecoyItemsVisible: false,
    wrongItemRejected: false,
    requestedItemsCollectThroughCanvas: false,
    levelCompletes: false,
    noRuntimeIssues: false
  },
  initial: null,
  afterMistake: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=${LEVEL_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction((levelId) => document.body.dataset.activeLevel === levelId, LEVEL_ID, { timeout: 30000 });
  await page.waitForFunction(() => Number(document.body.dataset.findItemsVisibleCount ?? "0") >= 3, null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.correctLevelLoads = initial.environmentKey === "environment-project-order-hunt-v2";
  report.assertions.requestedAndDecoyItemsVisible = initial.requested.length > 0 && initial.decoys.length > 0;

  const decoy = initial.decoys[0];
  if (!decoy) throw new Error("Level 9 has no visible decoy for mistake validation");
  await clickGame(page, decoy.x, decoy.y);
  await page.waitForFunction((sceneKey) => (window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.findChallenge?.snapshot?.().mistakes ?? 0) >= 1, SCENE_KEY, { timeout: 10000 });
  const afterMistake = await readState(page);
  report.afterMistake = afterMistake;
  report.assertions.wrongItemRejected = Boolean(
    afterMistake.challenge?.mistakes === 1 &&
    afterMistake.controller?.progress === 0 &&
    afterMistake.challenge?.collectedProductIds?.length === 0
  );

  let expectedProgress = 0;
  for (const requested of initial.requested) {
    const current = await readState(page);
    const product = current.products.find((entry) => entry.name === requested.name);
    if (!product) throw new Error(`Level 9 requested product disappeared before selection: ${requested.name}`);
    await clickGame(page, product.x, product.y);
    expectedProgress += 1;
    await page.waitForFunction(({ sceneKey, expected }) => {
      const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
      return (scene?.controller?.snapshot?.().progress ?? 0) >= expected || scene?.controller?.snapshot?.().step === "complete";
    }, { sceneKey: SCENE_KEY, expected: expectedProgress }, { timeout: 20000 });
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.requestedItemsCollectThroughCanvas = final.challenge?.collectedProductIds?.length === initial.requested.length;
  report.assertions.levelCompletes = Boolean(
    final.controller?.step === "complete" &&
    final.challenge?.status === "complete"
  );
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-9-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Level 9 release gate failed: ${failed.join(", ")}`);
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
    const list = scene?.children?.list ?? [];
    const products = list
      .filter((entry) => typeof entry?.name === "string")
      .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
      .filter((entry) => entry.visible !== false && entry.active !== false)
      .map((entry) => ({
        name: entry.name,
        x: entry.x,
        y: entry.y,
        requested: entry.getData?.("requested") === true
      }));
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      products,
      requested: products.filter((entry) => entry.requested),
      decoys: products.filter((entry) => !entry.requested)
    };
  }, SCENE_KEY);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
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
