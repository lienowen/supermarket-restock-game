import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-8");
const PORT = 4201;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const LEVEL_ID = "starter-level-008";
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
const EXPECTED_SPILLS = [
  "spill-water-large",
  "spill-footprint-large",
  "spill-juice-large",
  "spill-dirt-smear-large",
  "spill-oil-large",
  "spill-trash-smear-large"
];
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
  assertions: {
    dedicatedBackgroundActive: false,
    closingSafetyPresentationActive: false,
    sixDistinctSpillsActive: false,
    safetyRuleConfigured: false,
    firstHazardRequiresSign: false,
    warningSignsGateAllHazards: false,
    allSixSpillsScrubbed: false,
    completionReached: false,
    noRuntimeIssues: false
  },
  initial: null,
  firstSafetySign: null,
  final: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
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
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&guided=0&hold=0&level=${LEVEL_ID}`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.getByRole("button", { name: "START SHIFT", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.levelBriefing === "closed", null, { timeout: 45000 });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-008", null, { timeout: 30000 });
  await page.waitForFunction(
    () => document.body.dataset.cleaningPresentation === "closing-clean-v1-safety-sign-scrub",
    null,
    { timeout: 15000 }
  );

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.dedicatedBackgroundActive = initial.environmentKey === "environment-project-cleaning-closing-l8";
  report.assertions.closingSafetyPresentationActive = initial.presentation === "closing-clean-v1-safety-sign-scrub" &&
    initial.control === "tap-walk-sign-then-scrub";
  report.assertions.sixDistinctSpillsActive = initial.spills.length === 6 &&
    initial.spills.map((spill) => spill.sourceKey).join("|") === EXPECTED_SPILLS.join("|") &&
    new Set(initial.spills.map((spill) => spill.sourceKey)).size === 6;
  report.assertions.safetyRuleConfigured = initial.safetyRequired === "1,3,5" &&
    initial.spills.filter((spill) => spill.safetyRequired).map((spill) => spill.index).join(",") === "1,3,5";
  await page.screenshot({ path: join(OUTPUT_DIR, "level-8-initial.png"), fullPage: true });

  await clickLogical(page, initial.toolPoint.x, initial.toolPoint.y);
  await waitForStep(page, "clean");

  let everyHazardGated = true;
  let completed = 0;
  for (const index of [0, 2, 4, 1, 3, 5]) {
    const before = await readState(page);
    const spot = before.spotPositions[index];
    if (!spot) throw new Error(`Missing L8 spill position ${index + 1}`);
    const progressBefore = before.controller?.progress ?? -1;

    await clickLogical(page, spot.x, spot.y);
    if (SAFETY_INDEXES.has(index)) {
      await page.waitForFunction(
        (number) => (document.body.dataset.cleaningSafetyPlaced ?? "").split(",").includes(String(number)),
        index + 1,
        { timeout: 12000 }
      );
      const signed = await readState(page);
      const gated = signed.controller?.progress === progressBefore && signed.signs[index]?.visible === true;
      everyHazardGated = everyHazardGated && gated;
      if (index === 0) {
        report.firstSafetySign = signed;
        report.assertions.firstHazardRequiresSign = gated && signed.scrubProgress === 0;
        await page.screenshot({ path: join(OUTPUT_DIR, "level-8-first-safety-sign.png"), fullPage: true });
      }
    } else {
      await waitForInteractionReady(page);
    }

    await scrubSpill(page, index);
    if (SAFETY_INDEXES.has(index)) {
      await page.waitForFunction((number) => document.body.dataset.cleaningAwaitingSignRecovery === String(number), index + 1);
      await clickLogical(page, spot.x, spot.y);
    }
    await waitForProgress(page, ++completed);
    await page.waitForTimeout(320);
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.warningSignsGateAllHazards = everyHazardGated && final.safetyPlaced === "";
  report.assertions.allSixSpillsScrubbed = final.controller?.progress === 6 && final.controller?.total === 6;
  report.assertions.completionReached = final.controller?.step === "complete";
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-8-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 8 closing safety audit failed: ${failed.join(", ")}`);

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
  return page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const spotPositions = [...(scene?.context?.runtime?.spotPositions ?? [])];
    return {
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? null,
      presentation: document.body.dataset.cleaningPresentation ?? null,
      control: document.body.dataset.cleaningControl ?? null,
      safetyRequired: document.body.dataset.cleaningSafetyRequired ?? null,
      safetyPlaced: document.body.dataset.cleaningSafetyPlaced ?? null,
      scrubProgress: Number(document.body.dataset.cleanScrubProgress ?? "0"),
      controller: scene?.controller?.snapshot?.() ?? null,
      toolPoint: scene?.context?.runtime?.toolPoint ?? null,
      spotPositions,
      spills: spotPositions.map((_point, index) => {
        const number = index + 1;
        const spill = scene?.children?.getByName?.(`clean-spill-${number}`);
        return spill ? {
          index: number,
          visible: spill.visible,
          sourceKey: spill.getData?.("spill-source-key") ?? null,
          safetyRequired: Boolean(spill.getData?.("safety-required")),
          x: spill.x,
          y: spill.y
        } : null;
      }).filter(Boolean),
      signs: spotPositions.map((_point, index) => {
        const sign = scene?.children?.getByName?.(`closing-safety-sign-${index + 1}`);
        return sign ? { visible: sign.visible, alpha: sign.alpha, x: sign.x, y: sign.y } : null;
      })
    };
  }, SCENE_KEY);
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
    const state = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return (state?.progress ?? 0) >= expected || state?.step === "complete";
  }, { sceneKey: SCENE_KEY, expected }, { timeout: 8000 });
}

async function clickLogical(page, logicalX, logicalY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (logicalX / LOGICAL_WIDTH) * box.width,
    box.y + (logicalY / LOGICAL_HEIGHT) * box.height
  );
}

async function scrubSpill(page, index) {
  await waitForInteractionReady(page);
  const state = await readState(page);
  const spill = state.spills[index];
  if (!spill?.visible) throw new Error(`L8 spill ${index + 1} is not visible`);
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const toScreen = (x, y) => ({
    x: box.x + (x / LOGICAL_WIDTH) * box.width,
    y: box.y + (y / LOGICAL_HEIGHT) * box.height
  });
  const centre = toScreen(spill.x, spill.y);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  for (let pass = 0; pass < 8; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const next = toScreen(spill.x + direction * 76, spill.y + ((pass % 3) - 1) * 18);
    await page.mouse.move(next.x, next.y, { steps: 3 });
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
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
