import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4181;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const LEVEL_URL = `${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`;
const TARGET_WEIGHTS = [0.5, 1, 1.5, 0.5, 1.5, 1, 0.5, 1.5];

if (!existsSync(join(DIST_DIR, "index.html"))) {
  throw new Error("dist/index.html is missing. Run npm run build first.");
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const server = createServer((request, response) => {
  const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(DIST_DIR, safePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(DIST_DIR, "index.html");
  }
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeType(filePath));
  response.setHeader("Cache-Control", "no-store");
  response.end(readFileSync(filePath));
});

await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    patienceOverlayAppears: false,
    paymentInitiallyLocked: false,
    produceScaleAssetVisible: false,
    happyCustomerAssetVisible: false,
    impatientCustomerAssetAppears: false,
    wrongWeightCostsPatience: false,
    wrongWeightKeepsPaymentLocked: false,
    eightCustomersScan: false,
    eightCorrectWeights: false,
    eightCustomersComplete: false,
    noCustomerAbandonsInCompletionRun: false
  },
  moodRun: {
    patienceBeforeWrong: null,
    patienceAfterWrong: null,
    mistakes: null
  },
  completionRun: {
    completedScans: 0,
    completedWeights: 0,
    customersServed: 0,
    abandonments: null
  },
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  await runMoodAssetScenario(browser, report);
  await runCompletionScenario(browser, report);

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(
      `Level 7 production asset audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`
    );
  }
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "checkout-patience-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function runMoodAssetScenario(browser, auditReport) {
  const context = await createGameContext(browser);
  const page = await context.newPage();
  attachListeners(page, auditReport);
  await openLevel7(page);

  auditReport.assertions.patienceOverlayAppears = await page.locator("#checkout-patience-overlay").isVisible();
  auditReport.assertions.paymentInitiallyLocked = await page.locator("#patience-payment-button").isDisabled();
  auditReport.assertions.produceScaleAssetVisible = await imageLoadedWithFile(
    page,
    "#produce-scale-visual img",
    "equipment-produce-scale.png"
  );
  auditReport.assertions.happyCustomerAssetVisible = (
    await imageLoadedWithFile(page, "#checkout-patience-customer-mood", "customer-happy.png") &&
    await page.evaluate(() => document.body.dataset.checkoutPatienceMood === "happy")
  );

  await scanStandardItem(page);
  const before = await remainingPatience(page);
  await clickWeight(page, 1);
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatienceMistakes === "1",
    null,
    { timeout: 3000 }
  );
  const after = await remainingPatience(page);
  auditReport.moodRun.patienceBeforeWrong = before;
  auditReport.moodRun.patienceAfterWrong = after;
  auditReport.moodRun.mistakes = await page.evaluate(
    () => Number(document.body.dataset.checkoutPatienceMistakes ?? "0")
  );
  auditReport.assertions.wrongWeightCostsPatience = before - after >= 2700;
  auditReport.assertions.wrongWeightKeepsPaymentLocked = await page.locator("#patience-payment-button").isDisabled();

  await page.waitForFunction(
    () => document.body.dataset.checkoutPatienceMood === "impatient",
    null,
    { timeout: 7000 }
  );
  auditReport.assertions.impatientCustomerAssetAppears = await imageLoadedWithFile(
    page,
    "#checkout-patience-customer-mood",
    "customer-impatient.png"
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "checkout-patience-impatient.png"),
    fullPage: true
  });

  await page.close();
  await context.close();
}

async function runCompletionScenario(browser, auditReport) {
  const context = await createGameContext(browser);
  const page = await context.newPage();
  attachListeners(page, auditReport);
  await openLevel7(page);

  for (let customer = 0; customer < TARGET_WEIGHTS.length; customer += 1) {
    await page.waitForFunction(
      (expectedCustomer) => document.body.dataset.checkoutPatienceCustomer === String(expectedCustomer + 1),
      customer,
      { timeout: 10000 }
    );

    await scanStandardItem(page);
    auditReport.completionRun.completedScans += 1;

    await clickWeight(page, TARGET_WEIGHTS[customer]);
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceWeightCorrect === "true",
      null,
      { timeout: 3000 }
    );
    auditReport.completionRun.completedWeights += 1;

    await payCurrentCustomer(page);
    await waitForSnapshot(page, { customersServed: customer + 1 }, 10000);
  }

  const complete = await waitForSnapshot(
    page,
    { step: "complete", customersServed: TARGET_WEIGHTS.length },
    10000
  );
  auditReport.completionRun.customersServed = complete?.customersServed ?? 0;
  auditReport.completionRun.abandonments = await page.evaluate(
    () => Number(document.body.dataset.checkoutPatienceAbandonments ?? "0")
  );
  auditReport.assertions.eightCustomersScan = auditReport.completionRun.completedScans === 8;
  auditReport.assertions.eightCorrectWeights = auditReport.completionRun.completedWeights === 8;
  auditReport.assertions.eightCustomersComplete = Boolean(
    complete?.step === "complete" && complete?.customersServed === 8
  );
  auditReport.assertions.noCustomerAbandonsInCompletionRun = auditReport.completionRun.abandonments === 0;

  await page.screenshot({
    path: join(OUTPUT_DIR, "checkout-patience-complete.png"),
    fullPage: true
  });
  await page.close();
  await context.close();
}

async function createGameContext(browser) {
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
  return context;
}

async function openLevel7(page) {
  await page.goto(LEVEL_URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-007",
    null,
    { timeout: 30000 }
  );
  await movePlayerByTap(page, { x: 900, y: 690 });
  await waitForInteractionReady(page);
  await clickGame(page, 1035, 690);
  await waitForSnapshot(page, { step: "serve", customersServed: 0 }, 10000);
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatience === "active",
    null,
    { timeout: 10000 }
  );
}

async function imageLoadedWithFile(page, selector, fileName) {
  return page.evaluate(({ targetSelector, expectedFile }) => {
    const image = document.querySelector(targetSelector);
    return image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.includes(expectedFile);
  }, { targetSelector: selector, expectedFile: fileName });
}

async function remainingPatience(page) {
  return page.evaluate(() => Number(document.body.dataset.checkoutPatienceRemaining ?? "0"));
}

async function scanStandardItem(page) {
  const source = page.locator("#patience-standard-item");
  await source.focus();
  await source.press("Enter");
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatienceScanned === "true",
    null,
    { timeout: 3000 }
  );
}

async function clickWeight(page, weight) {
  await page.evaluate((targetWeight) => {
    const button = document.querySelector(`[data-weight-kg="${targetWeight}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing weight button: ${targetWeight}`);
    }
    button.click();
  }, weight);
}

async function payCurrentCustomer(page) {
  await page.waitForFunction(
    () => {
      const button = document.querySelector("#patience-payment-button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    },
    null,
    { timeout: 5000 }
  );
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
    return scene?.isInteractionReady?.() === true;
  }, GAME_SCENE_KEY, { timeout: 15000 });
}

async function movePlayerByTap(page, point) {
  await clickGame(page, point.x, point.y);
  await page.waitForTimeout(1200);
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
    if (!error.includes("ERR_ABORTED")) {
      auditReport.failedRequests.push({ url: request.url(), error });
    }
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
