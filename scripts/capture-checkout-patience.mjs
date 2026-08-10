import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-7");
const PORT = 4181;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const SERVICE_POINT = Object.freeze({ x: 1035, y: 690 });
const TARGET_WEIGHTS = [0.5, 1, 1.5, 0.5, 1.5, 1, 0.5, 1.5];

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
  const moodContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const moodPage = await createReadyPage(moodContext, report);
  report.assertions.patienceOverlayAppears = await moodPage.locator("#checkout-patience-overlay").isVisible();
  report.assertions.realProduceScaleLoads = await imageLoadsWith(moodPage, "#produce-scale-visual img", "equipment-produce-scale.png");
  report.assertions.initialHappyCustomerLoads = await imageLoadsWith(moodPage, "#checkout-patience-customer-mood", "customer-happy.png") &&
    await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMood === "happy");

  // Exercise the actual checkout sequence: scan first, then make two wrong
  // weighing decisions. This proves penalties and mood without racing the
  // customer to zero patience because of audit overhead.
  await moodPage.locator("#patience-standard-item").press("Enter");
  await moodPage.waitForFunction(() => document.body.dataset.checkoutPatienceScanned === "true", null, { timeout: 3000 });
  const beforeWrong = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  for (let mistake = 1; mistake <= 2; mistake += 1) {
    await moodPage.locator('[data-weight-kg="1"]').click();
    await moodPage.waitForFunction((expected) => Number(document.body.dataset.checkoutPatienceMistakes ?? "0") >= expected, mistake, { timeout: 2500 });
  }
  const afterWrong = Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0"));
  report.assertions.wrongWeightCostsPatience = beforeWrong - afterWrong >= 5200;
  await moodPage.waitForFunction(() => document.body.dataset.checkoutPatienceMood === "impatient", null, { timeout: 5000 });
  report.assertions.moodTurnsImpatient = true;
  report.assertions.impatientCustomerLoads = await imageLoadsWith(moodPage, "#checkout-patience-customer-mood", "customer-impatient.png");
  report.moodSession = {
    beforeWrong,
    afterWrong,
    mistakes: Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMistakes ?? "0")),
    remainingAtMood: Number(await moodPage.evaluate(() => document.body.dataset.checkoutPatienceRemaining ?? "0")),
    mood: await moodPage.evaluate(() => document.body.dataset.checkoutPatienceMood ?? null)
  };
  await moodPage.screenshot({ path: join(OUTPUT_DIR, "level-7-impatient-state.png"), fullPage: true });
  await moodPage.close();
  await moodContext.close();

  const completionContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await createReadyPage(completionContext, report);
  for (let customer = 0; customer < TARGET_WEIGHTS.length; customer += 1) {
    await page.waitForFunction((expected) => document.body.dataset.checkoutPatienceCustomer === String(expected + 1), customer, { timeout: 8000 });
    if (customer === 0) {
      await dragStandardItem(page);
      await page.waitForFunction(() => document.body.dataset.checkoutPatienceScanned === "true", null, { timeout: 3000 });
      report.assertions.standardItemDragWorks = true;
    } else {
      await page.locator("#patience-standard-item").press("Enter");
      await page.waitForFunction(() => document.body.dataset.checkoutPatienceScanned === "true", null, { timeout: 3000 });
    }

    const targetWeight = TARGET_WEIGHTS[customer];
    await page.locator(`[data-weight-kg="${targetWeight}"]`).click();
    await page.waitForFunction(() => document.body.dataset.checkoutPatienceWeightCorrect === "true", null, { timeout: 3000 });
    report.completedWeights += 1;

    await page.waitForFunction(() => {
      const button = document.querySelector("#patience-payment-button");
      return button instanceof HTMLButtonElement && !button.disabled;
    }, null, { timeout: 3000 });
    await page.evaluate(() => {
      const button = document.querySelector("#patience-payment-button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) throw new Error("Payment did not unlock");
      button.click();
    });
    await waitSnapshot(page, { customersServed: customer + 1 }, 6000);
  }

  const final = await waitSnapshot(page, { step: "complete", customersServed: 8 }, 8000);
  const abandonments = Number(await page.evaluate(() => document.body.dataset.checkoutPatienceAbandonments ?? "0"));
  report.assertions.eightCorrectWeightsRequired = report.completedWeights === 8;
  report.assertions.eightCustomersComplete = final?.step === "complete";
  report.assertions.noCustomerAbandons = abandonments === 0;
  report.completionSession = { final, abandonments };
  await page.screenshot({ path: join(OUTPUT_DIR, "level-7-mature-complete.png"), fullPage: true });
  await page.close();
  await completionContext.close();

  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Mature Level 7 audit failed: ${failed.join(", ")}`);
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

async function createReadyPage(context, audit) {
  const page = await context.newPage();
  attachListeners(page, audit);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&patience=1&level=starter-level-007`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-007", null, { timeout: 30000 });
  await page.evaluate(({ sceneKey, point }) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.player?.setDestination?.(point), { sceneKey: SCENE_KEY, point: SERVICE_POINT });
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 12000 });
  await page.evaluate((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    if (!action) throw new Error("Checkout action missing");
    action.emit("pointerdown");
  }, SCENE_KEY);
  await waitSnapshot(page, { step: "serve", customersServed: 0 }, 5000);
  await page.waitForFunction(() => document.body.dataset.checkoutPatience === "active", null, { timeout: 8000 });
  return page;
}

async function dragStandardItem(page) {
  const source = page.locator("#patience-standard-item");
  const target = page.locator("#patience-scan-zone");
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error("Standard item or scanner has no bounds");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function imageLoadsWith(page, selector, fragment) {
  return page.evaluate(({ selector, fragment }) => {
    const image = document.querySelector(selector);
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.includes(fragment);
  }, { selector, fragment });
}

async function waitSnapshot(page, expected, timeout = 10000) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const snapshot = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(expected).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, expected }, { timeout });
  return page.evaluate((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.controller?.snapshot?.() ?? null, SCENE_KEY);
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
