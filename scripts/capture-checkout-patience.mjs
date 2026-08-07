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
    patienceOverlayAppears: false,
    paymentInitiallyLocked: false,
    produceScaleAssetVisible: false,
    happyCustomerAssetVisible: false,
    impatientCustomerAssetAppears: false,
    wrongWeightCostsPatience: false,
    wrongWeightKeepsPaymentLocked: false,
    standardItemsRequireDrag: false,
    correctWeightsRequired: false,
    eightCustomersComplete: false,
    noCustomerAbandons: false
  },
  wrongWeightState: null,
  completedScans: 0,
  completedWeights: 0,
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
    `${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`,
    { waitUntil: "networkidle", timeout: 90000 }
  );
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-007",
    null,
    { timeout: 30000 }
  );

  await movePlayerByTap(page, { x: 900, y: 690 });
  await waitForInteractionReady(page);
  await clickGame(page, 1035, 690);
  await waitForSnapshot(page, { step: "serve", customersServed: 0 });
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatience === "active",
    null,
    { timeout: 15000 }
  );

  report.assertions.patienceOverlayAppears = await page.locator("#checkout-patience-overlay").isVisible();
  report.assertions.paymentInitiallyLocked = await page.locator("#patience-payment-button").isDisabled();
  report.assertions.produceScaleAssetVisible = await page.evaluate(() => {
    const image = document.querySelector("#produce-scale-visual img");
    return image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.includes("equipment-produce-scale.png");
  });
  report.assertions.happyCustomerAssetVisible = await page.evaluate(() => {
    const image = document.querySelector("#checkout-patience-customer-mood");
    return image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.includes("customer-happy.png") &&
      document.body.dataset.checkoutPatienceMood === "happy";
  });
  await page.screenshot({
    path: join(OUTPUT_DIR, "checkout-patience-active.png"),
    fullPage: true
  });

  const patienceBeforeWrong = Number(await page.evaluate(() => document.body.dataset.checkoutPatienceRemaining));
  const wrongWeight = page.locator('[data-weight-kg="1"]');
  await wrongWeight.click();
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatienceMistakes === "1",
    null,
    { timeout: 5000 }
  );
  const patienceAfterWrong = Number(await page.evaluate(() => document.body.dataset.checkoutPatienceRemaining));
  report.wrongWeightState = {
    before: patienceBeforeWrong,
    after: patienceAfterWrong,
    feedback: await page.locator("#checkout-patience-feedback").textContent()
  };
  report.assertions.wrongWeightCostsPatience = patienceBeforeWrong - patienceAfterWrong >= 2700;
  report.assertions.wrongWeightKeepsPaymentLocked = await page.locator("#patience-payment-button").isDisabled();

  await wrongWeight.click();
  await wrongWeight.click();
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatienceMistakes === "3" &&
      document.body.dataset.checkoutPatienceMood === "impatient",
    null,
    { timeout: 5000 }
  );
  await page.waitForFunction(
    () => {
      const image = document.querySelector("#checkout-patience-customer-mood");
      return image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.src.includes("customer-impatient.png");
    },
    null,
    { timeout: 5000 }
  );
  report.assertions.impatientCustomerAssetAppears = true;
  await page.screenshot({
    path: join(OUTPUT_DIR, "checkout-patience-impatient.png"),
    fullPage: true
  });

  for (let customer = 0; customer < 8; customer += 1) {
    await page.waitForFunction(
      (expectedCustomer) => document.body.dataset.checkoutPatienceCustomer === String(expectedCustomer + 1),
      customer,
      { timeout: 15000 }
    );

    await dragStandardItem(page);
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceScanned === "true",
      null,
      { timeout: 5000 }
    );
    report.completedScans += 1;

    const targetWeight = TARGET_WEIGHTS[customer];
    await page.locator(`[data-weight-kg="${targetWeight}"]`).click();
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceWeightCorrect === "true",
      null,
      { timeout: 5000 }
    );
    report.completedWeights += 1;

    const payment = page.locator("#patience-payment-button");
    await page.waitForFunction(
      () => {
        const button = document.querySelector("#patience-payment-button");
        return button instanceof HTMLButtonElement && button.disabled === false;
      },
      null,
      { timeout: 8000 }
    );
    await payment.click();
    await waitForSnapshot(page, { customersServed: customer + 1 }, 15000);
  }

  const complete = await waitForSnapshot(page, {
    step: "complete",
    customersServed: 8
  }, 15000);
  report.assertions.standardItemsRequireDrag = report.completedScans === 8;
  report.assertions.correctWeightsRequired = report.completedWeights === 8;
  report.assertions.eightCustomersComplete = Boolean(complete && complete.step === "complete");
  report.assertions.noCustomerAbandons = await page.evaluate(
    () => document.body.dataset.checkoutPatienceAbandonments === "0"
  );
  await page.screenshot({
    path: join(OUTPUT_DIR, "checkout-patience-complete.png"),
    fullPage: true
  });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Checkout patience audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
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

async function dragStandardItem(page) {
  const source = page.locator("#patience-standard-item");
  const target = page.locator("#patience-scan-zone");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Standard item or scanner has no bounds");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
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
