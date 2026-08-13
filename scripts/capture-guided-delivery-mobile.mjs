import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-1-mobile");
const PORT = 4191;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";

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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  viewport: { width: 390, height: 844 },
  assertions: {
    softwareLandscapeActive: false,
    guidedDragVisible: false,
    touchPointerTracksTarget: false,
    touchDropAccepted: false,
    deliveryContinues: false,
    noRuntimeIssues: false
  },
  sourceRect: null,
  targetRect: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({
    viewport: report.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36"
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
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
    } } };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=1&level=starter-level-001`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-001",
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.softwareLandscape === "true",
    null,
    { timeout: 10000 }
  );
  report.assertions.softwareLandscapeActive = true;

  // The desktop audit enters the guided step through the primary action control.
  // Invoke that same gameplay action so this gate isolates the real Android
  // touch drag rather than mixing in a separate navigation test.
  await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const action = scene?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Missing Level 1 primary action control");
    action.emit("pointerdown");
  }, GAME_SCENE_KEY);

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const state = scene?.controller?.snapshot?.();
    return state?.step === "load" && state?.boxCollected === true;
  }, GAME_SCENE_KEY, { timeout: 10000 });
  await page.waitForFunction(
    () => document.body.dataset.guidedDrag === "active",
    null,
    { timeout: 10000 }
  );

  const source = page.locator("#guided-drag-source");
  const target = page.locator("#guided-drag-target");
  await source.waitFor({ state: "visible", timeout: 10000 });
  await target.waitFor({ state: "visible", timeout: 10000 });
  report.assertions.guidedDragVisible = true;

  report.sourceRect = await source.boundingBox();
  report.targetRect = await target.boundingBox();
  if (!report.sourceRect || !report.targetRect) throw new Error("Mobile guided drag bounds are missing");

  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-mobile-drag-active.png"), fullPage: true });

  const start = centre(report.sourceRect);
  const end = centre(report.targetRect);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start.x, y: start.y, radiusX: 8, radiusY: 8, force: 1 }]
  });
  for (let index = 1; index <= 14; index += 1) {
    const t = index / 14;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }]
    });
    if (index === 12) {
      report.assertions.touchPointerTracksTarget = await page.evaluate(
        () => document.body.dataset.mobileGuidedDragTarget === "inside"
      );
    }
    await page.waitForTimeout(18);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await page.waitForFunction(
    () => document.body.dataset.guidedDrag === "complete",
    null,
    { timeout: 10000 }
  );
  report.assertions.touchDropAccepted = true;

  await page.waitForFunction((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const state = scene?.controller?.snapshot?.();
    return Boolean(
      state?.boxLoaded === true &&
      ["push", "park", "open", "restock"].includes(state?.step)
    );
  }, GAME_SCENE_KEY, { timeout: 12000 });
  report.assertions.deliveryContinues = true;

  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-mobile-after-touch-drag.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Level 1 mobile guided drag failed: ${failed.join(", ")}`);

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

function centre(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
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