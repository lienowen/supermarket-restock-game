import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-7");
const PORT = 4181;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });
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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    patienceOverlayAppears: false,
    realProduceScaleLoads: false,
    initialHappyCustomerLoads: false,
    wrongWeightCostsPatience: false,
    moodTurnsImpatient: false,
    impatientCustomerLoads: false,
    standardItemDragWorks: false,
    eightCorrectWeightsRequired: false,
    eightCustomersComplete: false,
    noCustomerAbandons: false,
    noRuntimeIssues: false
  },
  moodSession: null,
  completionSession: null,
  completedWeights: 0,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  // Session A deliberately exercises mistakes and mood switching. It is kept
  // separate so evidence capture cannot consume the timer of the completion run.
  const moodContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const moodPage = await createReadyLevelSevenPage(moodContext, report);
  report.assertions.patienceOverlayAppears = await moodPage.locator("#checkout-patience-overlay").isVisible();
  report.assertions.realProduceScaleLoads = await imageLoadsWith(moodPage, "#produce-scale-visual img", "equipment-produce-scale.png");
  report.assertions.initialHappyCustomerLoads = Boolean(
    await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMood === "happy") &&
    await imageLoadsWith(moodPage, "#checkout-patience-customer-mood", "customer-happy.png")
  );

  const patienceBefore = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  for (let mistake = 1; mistake <= 3; mistake += 1) {
    await moodPage.locator('[data-weight-kg="1"]').click();
    await moodPage.waitForFunction(
      (expected) => Number(document.body.dataset.checkoutPatienceMistakes ?? "0") >= expected,
      mistake,
      { timeout: 4000 }
    );
  }
  await moodPage.waitForFunction(
    () => document.body.dataset.checkoutPatienceMood === "impatient",
    null,
    { timeout: 3000 }
  );
  const patienceAfter = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  report.assertions.wrongWeightCostsPatience = patienceBefore - patienceAfter >= 8200;
  report.assertions.moodTurnsImpatient = await moodPage.evaluate(
    () => document.body.dataset.checkoutPatienceMood === "impatient"
  );
  report.assertions.impatientCustomerLoads = await imageLoadsWith(
    moodPage,
    "#checkout-patience-customer-mood",
    "customer-impatient.png"
  );
  report.moodSession = {
    patienceBefore,
    patienceAfter,
    mistakes: Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMistakes ?? "0")),
    mood: await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMood ?? null)
  };
  await moodPage.screenshot({ path: join(OUTPUT_DIR, "level-7-impatient-state.png"), fullPage: true });
  await moodPage.close();
  await moodContext.close();

  // Session B is a clean speed run. No mid-run screenshots or deliberate waits
  // are allowed to consume the 15-second per-customer timer.
  const completionContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await createReadyLevelSevenPage(completionContext, report);

  for (let customer = 0; customer < TARGET_WEIGHTS.length; customer += 1) {
    await page.waitForFunction(
      (expectedCustomer) => document.body.dataset.checkoutPatienceCustomer === String(expectedCustomer + 1),
      customer,
      { timeout: 8000 }
    );

    if (customer === 0) {
      await dragStandardItem(page);
      await page.waitForFunction(
        () => document.body.dataset.checkoutPatienceScanned === "true",
        null,
        { timeout: 3000 }
      );
      report.assertions.standardItemDragWorks = true;
    } else {
      // Keyboard activation uses the same scan state transition and avoids
      // spending customer patience on Playwright pointer interpolation.
      await page.locator("#patience-standard-item").press("Enter");
      await page.waitForFunction(
        () => document.body.dataset.checkoutPatienceScanned === "true",
        null,
        { timeout: 3000 }
      );
    }

    const targetWeight = TARGET_WEIGHTS[customer];
    await page.locator(`[data-weight-kg="${targetWeight}"]`).click();
    await page.waitForFunction(
      () => document.body.dataset.checkoutPatienceWeightCorrect === "true",
      null,
      { timeout: 3000 }
    );
    report.completedWeights += 1;

    await page.waitForFunction(() => {
      const button = document.querySelector("#patience-payment-button");
      return button instanceof HTMLButtonElement && button.disabled === false;
    }, null, { timeout: 3000 });
    await page.evaluate(() => {
      const button = document.querySelector("#patience-payment-button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        throw new Error("Payment did not unlock after correct scan and weight");
      }
      button.click();
    });
    await waitForSnapshot(page, { customersServed: customer + 1 }, 6000);
  }

  const final = await waitForSnapshot(page, { step: "complete", customersServed: 8 }, 8000);
  const abandonments = Number(await page.evaluate(() => document.body.dataset.checkoutPatienceAbandonments ?? "0"));
  report.assertions.eightCorrectWeightsRequired = report.completedWeights === 8;
  report.assertions.eightCustomersComplete = Boolean(final && final.step === "complete");
  report.assertions.noCustomerAbandons = abandonments === 0;
  report.completionSession = { final, abandonments };
  await page.screenshot({ path: join(OUTPUT_DIR, "level-7-mature-complete.png"), fullPage: true });
  await page.close();
  await completionContext.close();

  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) throw new Error(`Mature Level 7 audit failed: ${failed.join(", ")}`);
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

async function createReadyLevelSevenPage(context, auditReport) {
  const page = await context.newPage();
  attachListeners(page, auditReport);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-007",
    null,
    { timeout: 30000 }
  );
  await page.evaluate(({ sceneKey, point }) => {
    window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point);
  }, { sceneKey: GAME_SCENE_KEY, point: SERVICE_POINT });
  await waitForInteractionReady(page);
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Checkout action is missing");
    action.emit("pointerdown");
  }, GAME_SCENE_KEY);
  await waitForSnapshot(page, { step: "serve", customersServed: 0 }, 5000);
  await page.waitForFunction(
    () => document.body.dataset.checkoutPatience === "active",
    null,
    { timeout: 8000 }
  );
  return page;
}

async function dragStandardItem(page) {
  const source = page.locator("#patience-standard-item");
  const target = page.locator("#patience-scan-zone");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Standard item or scanner has no bounds");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function imageLoadsWith(page, selector, expectedPathFragment) {
  return page.evaluate(({ selector, expected }) => {
    const image = document.querySelector(selector);
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.includes(expected);
  }, { selector, expected: expectedPathFragment });
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
  }, GAME_SCENE_KEY, { timeout: 12000 });
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
