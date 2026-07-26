import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4175;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

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
    checklistVisible: false,
    dragGateAppears: false,
    oldTapBlocked: false,
    dragCompletesLoad: false,
    deliveryContinues: false
  },
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
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
  await page.goto(
    `${ORIGIN}/?test=1&briefing=0&guided=1&level=starter-level-001`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-001",
    null,
    { timeout: 30000 }
  );
  report.assertions.checklistVisible = await page.locator("#level-checklist").isVisible();

  await clickGame(page, 1228, 850);
  await waitForSnapshot(page, { step: "load", boxCollected: true });
  await page.waitForFunction(
    () => document.body.dataset.guidedDrag === "active",
    null,
    { timeout: 20000 }
  );

  const source = page.locator("#guided-drag-source");
  const target = page.locator("#guided-drag-target");
  await source.waitFor({ state: "visible", timeout: 10000 });
  await target.waitFor({ state: "visible", timeout: 10000 });
  report.assertions.dragGateAppears = await page.locator("#guided-drag-action").isVisible();
  await page.screenshot({
    path: join(OUTPUT_DIR, "guided-delivery-drag-active.png"),
    fullPage: true
  });

  const beforeBlockedTap = await readSnapshot(page);
  await clickGame(page, 1228, 850);
  await page.waitForTimeout(450);
  const afterBlockedTap = await readSnapshot(page);
  const dragStateAfterBlockedTap = await page.evaluate(() => document.body.dataset.guidedDrag);
  report.assertions.oldTapBlocked = (
    beforeBlockedTap?.step === "load" &&
    afterBlockedTap?.step === "load" &&
    dragStateAfterBlockedTap === "active"
  );

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Guided drag source or target has no bounds");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 14 }
  );
  await page.mouse.up();

  await page.waitForFunction(
    () => document.body.dataset.guidedDrag === "complete",
    null,
    { timeout: 10000 }
  );
  const afterDrag = await readSnapshot(page);
  report.assertions.dragCompletesLoad = Boolean(
    afterDrag &&
    ["push", "park", "open", "restock"].includes(afterDrag.step) &&
    afterDrag.boxLoaded === true
  );

  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true }, 25000);
  const checklistState = await page.evaluate(() => ({
    state: document.body.dataset.levelChecklist,
    rows: [...document.querySelectorAll("#level-checklist [data-step-id]")].map((row) => ({
      id: row.getAttribute("data-step-id"),
      text: row.textContent?.trim() ?? ""
    }))
  }));
  report.assertions.deliveryContinues = (
    checklistState.rows.find((row) => row.id === "pickup")?.text.startsWith("✓") === true &&
    checklistState.rows.find((row) => row.id === "load")?.text.startsWith("✓") === true &&
    checklistState.rows.find((row) => row.id === "deliver")?.text.startsWith("✓") === true &&
    checklistState.rows.find((row) => row.id === "open")?.text.startsWith("✓") === true
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "guided-delivery-after-drag.png"),
    fullPage: true
  });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Guided delivery audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "guided-delivery-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

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
