import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const SPOTS = [
  { x: 620, y: 742 },
  { x: 790, y: 672 },
  { x: 970, y: 748 },
  { x: 1135, y: 685 }
];

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
    holdOverlayAppears: false,
    oldSpillTapBlocked: false,
    earlyReleaseDoesNotClean: false,
    fullHoldCleansOne: false,
    everySpillNeedsHold: false,
    levelCompletes: false
  },
  completedHolds: 0,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript(() => {
    window.CrazyGames = {
      SDK: {
        init: async () => undefined,
        game: {
          settings: { muteAudio: false },
          gameplayStart: () => undefined,
          gameplayStop: () => undefined,
          loadingStart: () => undefined,
          loadingStop: () => undefined,
          setGameContext: () => undefined,
          clearGameContext: () => undefined,
          reportGameCompletedPercentage: () => undefined,
          addSettingsChangeListener: () => undefined,
          removeSettingsChangeListener: () => undefined
        }
      }
    };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&hold=1&level=starter-level-004`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-004",
    null,
    { timeout: 30000 }
  );

  await movePlayerByTap(page, { x: 1060, y: 760 });
  await waitForInteractionReady(page);
  await clickGame(page, 1190, 760);
  await waitForSnapshot(page, { step: "clean", progress: 0 });

  await movePlayerByTap(page, SPOTS[0]);
  await page.waitForFunction(
    () => document.body.dataset.holdWork === "active",
    null,
    { timeout: 10000 }
  );
  report.assertions.holdOverlayAppears = await page.locator("#hold-work-overlay").isVisible();
  await page.screenshot({ path: join(OUTPUT_DIR, "hold-cleaning-active.png"), fullPage: true });

  const beforeOldTap = await readSnapshot(page);
  await clickGame(page, SPOTS[0].x, SPOTS[0].y);
  await page.waitForTimeout(250);
  const afterOldTap = await readSnapshot(page);
  report.assertions.oldSpillTapBlocked = (
    beforeOldTap.progress === 0 &&
    afterOldTap.progress === 0 &&
    (await page.evaluate(() => document.body.dataset.holdWork)) === "active"
  );

  const holdButton = page.locator("#hold-work-button");
  const holdBox = await holdButton.boundingBox();
  if (!holdBox) throw new Error("Hold button has no bounds");
  await page.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.waitForTimeout(180);
  const afterEarlyRelease = await readSnapshot(page);
  const earlyFeedback = await page.locator("#hold-work-feedback").textContent();
  report.assertions.earlyReleaseDoesNotClean = (
    afterEarlyRelease.progress === 0 &&
    (earlyFeedback ?? "").includes("Released early")
  );

  await completeHold(page);
  const afterFirstHold = await waitForSnapshot(page, { progress: 1 }, 15000);
  report.completedHolds += 1;
  report.assertions.fullHoldCleansOne = afterFirstHold.progress === 1;

  for (let index = 1; index < SPOTS.length; index += 1) {
    await movePlayerByTap(page, SPOTS[index]);
    await page.waitForFunction(
      (expectedProgress) => {
        const scene = window.__IMMERSIVE_GAME__?.scene?.getScene("starter-market-shift");
        const snapshot = scene?.controller?.snapshot?.();
        return snapshot?.progress === expectedProgress && document.body.dataset.holdWork === "active";
      },
      index,
      { timeout: 15000 }
    );
    await completeHold(page);
    await waitForSnapshot(page, { progress: index + 1 }, 15000);
    report.completedHolds += 1;
  }

  const complete = await waitForSnapshot(page, { step: "complete", progress: 4 }, 15000);
  report.assertions.everySpillNeedsHold = report.completedHolds === 4;
  report.assertions.levelCompletes = Boolean(complete && complete.step === "complete");
  await page.screenshot({ path: join(OUTPUT_DIR, "hold-cleaning-complete.png"), fullPage: true });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Hold cleaning audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "hold-cleaning-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, completedHolds: report.completedHolds, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function completeHold(page) {
  const button = page.locator("#hold-work-button");
  await button.waitFor({ state: "visible", timeout: 10000 });
  const box = await button.boundingBox();
  if (!box) throw new Error("Hold button has no bounds");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1450);
  await page.mouse.up();
}

async function readSnapshot(page) {
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return scene?.controller?.snapshot?.() ?? null;
  }, GAME_SCENE_KEY);
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    if (!snapshot) return false;
    return Object.entries(target).every(([key, value]) => snapshot[key] === value);
  }, { sceneKey: GAME_SCENE_KEY, target: expected }, { timeout });
  return readSnapshot(page);
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    return Boolean(scene?.isInteractionReady?.());
  }, GAME_SCENE_KEY, { timeout: 15000 });
}

async function movePlayerByTap(page, point) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await clickGame(page, point.x, point.y);
    try {
      await page.waitForFunction(({ sceneKey, target }) => {
        const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
        const position = scene?.playerPosition?.();
        return position && Math.hypot(position.x - target.x, position.y - target.y) <= 28;
      }, { sceneKey: GAME_SCENE_KEY, target: point }, { timeout: 12000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (gameX / GAME_WIDTH) * box.width,
    box.y + (gameY / GAME_HEIGHT) * box.height
  );
}

function attachListeners(page, auditReport) {
  page.on("console", (message) => {
    if (message.type() === "error") auditReport.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => auditReport.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  const extension = extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}
