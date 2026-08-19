import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-8-mobile");
const PORT = 4202;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-008";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const SAFETY_INDEXES = new Set([0, 2, 4]);

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
  viewport: { width: 390, height: 844 },
  assertions: {
    portraitViewport: false,
    softwareLandscapeActive: false,
    softwareLandscapeInputInstalled: false,
    closingSafetyPresentationActive: false,
    dedicatedBackgroundActive: false,
    physicalToolTapWorks: false,
    physicalSafetySignTapWorks: false,
    physicalScrubWorks: false,
    allSixSpillsComplete: false,
    allThreeSafetySignsPlaced: false,
    noRuntimeIssues: false
  },
  initial: null,
  firstSign: null,
  final: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({
    viewport: report.viewport,
    screen: report.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36"
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&hold=0&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-008", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 15000 });
  await page.waitForFunction(
    () => document.body.dataset.cleaningPresentation === "closing-clean-v1-safety-sign-scrub",
    null,
    { timeout: 15000 }
  );

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.portraitViewport = initial.viewport.width < initial.viewport.height;
  report.assertions.softwareLandscapeActive = initial.softwareLandscape === "true";
  report.assertions.softwareLandscapeInputInstalled = initial.softwareLandscapeInput === "canvas-geometry-v2";
  report.assertions.closingSafetyPresentationActive = initial.presentation === "closing-clean-v1-safety-sign-scrub";
  report.assertions.dedicatedBackgroundActive = initial.environmentKey === "environment-project-cleaning-closing-l8";
  await page.screenshot({ path: join(OUTPUT_DIR, "level-8-mobile-initial.png"), fullPage: true });

  await touchTapLogical(page, cdp, initial.toolPoint.x, initial.toolPoint.y);
  await waitForStep(page, "clean");
  report.assertions.physicalToolTapWorks = true;

  for (let index = 0; index < 6; index += 1) {
    const before = await readState(page);
    const spot = before.spotPositions[index];
    if (!spot) throw new Error(`Missing L8 mobile spill position ${index + 1}`);

    await touchTapLogical(page, cdp, spot.x, spot.y);
    if (SAFETY_INDEXES.has(index)) {
      await page.waitForFunction(
        (number) => (document.body.dataset.cleaningSafetyPlaced ?? "").split(",").includes(String(number)),
        index + 1,
        { timeout: 12000 }
      );
      const signed = await readState(page);
      if (index === 0) {
        report.firstSign = signed;
        report.assertions.physicalSafetySignTapWorks = signed.controller?.progress === 0 &&
          signed.signs[0]?.visible === true;
        await page.screenshot({ path: join(OUTPUT_DIR, "level-8-mobile-first-sign.png"), fullPage: true });
      }
    } else {
      await waitForInteractionReady(page);
    }

    await touchScrubLogical(page, cdp, spot.x, spot.y);
    await waitForProgress(page, index + 1);
    if (index === 0) report.assertions.physicalScrubWorks = true;
    await page.waitForTimeout(340);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.allSixSpillsComplete = final.controller?.step === "complete" &&
    final.controller?.progress === 6 && final.controller?.total === 6;
  report.assertions.allThreeSafetySignsPlaced = final.safetyPlaced === "1,3,5";
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-8-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 8 Android audit failed: ${failed.join(", ")}`);

  await page.close();
  await context.close();
} catch (error) {
  thrown = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

function attach(page, audit) {
  page.on("console", (message) => {
    if (message.type() === "error") audit.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => audit.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    audit.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });
}

async function readState(page) {
  return page.evaluate(({ sceneKey, canvasSelector }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const canvas = document.querySelector(canvasSelector);
    const spotPositions = [...(scene?.context?.runtime?.spotPositions ?? [])];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      softwareLandscape: document.body.dataset.softwareLandscape ?? null,
      softwareLandscapeInput: document.body.dataset.softwareLandscapeInput ?? null,
      presentation: document.body.dataset.cleaningPresentation ?? null,
      safetyPlaced: document.body.dataset.cleaningSafetyPlaced ?? null,
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions,
      canvas: canvas ? (() => {
        const rect = canvas.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      })() : null,
      signs: spotPositions.map((_point, index) => {
        const sign = scene?.children?.getByName?.(`closing-safety-sign-${index + 1}`);
        return sign ? { visible: sign.visible, x: sign.x, y: sign.y } : null;
      })
    };
  }, { sceneKey: SCENE_KEY, canvasSelector: CANVAS_SELECTOR });
}

async function waitForStep(page, expected) {
  await page.waitForFunction(({ sceneKey, expected }) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.().step === expected
  ), { sceneKey: SCENE_KEY, expected }, { timeout: 15000 });
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => (
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true
  ), SCENE_KEY, { timeout: 15000 });
  await page.waitForFunction(() => !document.body.dataset.cleaningPendingWalk, null, { timeout: 4000 });
}

async function waitForProgress(page, expected) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return (snapshot?.progress ?? 0) >= expected || snapshot?.step === "complete";
  }, { sceneKey: SCENE_KEY, expected }, { timeout: 9000 });
}

async function touchTapLogical(page, cdp, logicalX, logicalY) {
  const point = await physicalPointForLogical(page, logicalX, logicalY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.clientX, y: point.clientY, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(52);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function touchScrubLogical(page, cdp, logicalX, logicalY) {
  await waitForInteractionReady(page);
  const logicalPoints = [{ x: logicalX, y: logicalY }];
  for (let pass = 0; pass < 8; pass += 1) {
    logicalPoints.push({
      x: logicalX + (pass % 2 === 0 ? 78 : -78),
      y: logicalY + ((pass % 3) - 1) * 18
    });
  }
  const physical = [];
  for (const point of logicalPoints) physical.push(await physicalPointForLogical(page, point.x, point.y));

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: physical[0].clientX, y: physical[0].clientY, radiusX: 12, radiusY: 12, force: 1 }]
  });
  for (let index = 1; index < physical.length; index += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: physical[index].clientX,
        y: physical[index].clientY,
        radiusX: 12,
        radiusY: 12,
        force: 1
      }]
    });
    await page.waitForTimeout(34);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function physicalPointForLogical(page, logicalX, logicalY) {
  return page.evaluate(({ canvasSelector, logicalX, logicalY, logicalWidth, logicalHeight }) => {
    const canvas = document.querySelector(canvasSelector);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Game canvas is missing");
    const bodyRect = document.body.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const canvasStageWidth = canvasRect.height;
    const canvasStageHeight = canvasRect.width;
    const canvasCentreStageX = (canvasRect.top + canvasRect.height / 2) - bodyRect.top;
    const canvasCentreStageY = bodyRect.width - ((canvasRect.left + canvasRect.width / 2) - bodyRect.left);
    const canvasStageLeft = canvasCentreStageX - canvasStageWidth / 2;
    const canvasStageTop = canvasCentreStageY - canvasStageHeight / 2;
    const stageX = canvasStageLeft + (logicalX / logicalWidth) * canvasStageWidth;
    const stageY = canvasStageTop + (logicalY / logicalHeight) * canvasStageHeight;
    return {
      clientX: bodyRect.left + bodyRect.width - stageY,
      clientY: bodyRect.top + stageX
    };
  }, { canvasSelector: CANVAS_SELECTOR, logicalX, logicalY, logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT });
}

function mimeType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}
