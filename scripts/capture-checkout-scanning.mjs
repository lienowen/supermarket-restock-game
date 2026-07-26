import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4177;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const GAME_SCENE_KEY = "starter-market-shift";
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
await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const report = {
  generatedAt: new Date().toISOString(),
  scannedItems: 0,
  assertions: {
    scanOverlayAppears: false,
    earlyPaymentLocked: false,
    oldRegisterTapBlocked: false,
    allItemsRequireDrag: false,
    paymentAdvancesOneCustomer: false,
    allCustomersComplete: false
  },
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&checkout=1&level=starter-level-003`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-003",
    null,
    { timeout: 30000 }
  );

  await movePlayerByTap(page, { x: 900, y: 690 });
  await waitForInteractionReady(page);
  await clickGame(page, 1035, 690);
  await waitForSnapshot(page, { step: "serve", customersServed: 0 });
  await page.waitForFunction(
    () => document.body.dataset.checkoutScan === "active",
    null,
    { timeout: 10000 }
  );
  report.assertions.scanOverlayAppears = await page.locator("#checkout-scan-overlay").isVisible();
  report.assertions.earlyPaymentLocked = await page.locator("#checkout-payment-button").isDisabled();
  await page.screenshot({ path: join(OUTPUT_DIR, "checkout-scan-active.png"), fullPage: true });

  const beforeOldTap = await readSnapshot(page);
  await clickGame(page, 1035, 690);
  await page.waitForTimeout(300);
  const afterOldTap = await readSnapshot(page);
  report.assertions.oldRegisterTapBlocked = (
    beforeOldTap.customersServed === 0 &&
    afterOldTap.customersServed === 0 &&
    documentState(await page.evaluate(() => document.body.dataset.checkoutScan)) === "active"
  );

  for (let customer = 0; customer < 6; customer += 1) {
    await page.waitForFunction(
      (expectedCustomer) => {
        const label = document.querySelector("#checkout-scan-overlay")?.textContent ?? "";
        return document.body.dataset.checkoutScan === "active" && label.includes(`CUSTOMER ${expectedCustomer + 1}/6`);
      },
      customer,
      { timeout: 15000 }
    );
    const cards = page.locator(".checkout-product-card");
    const count = await cards.count();
    if (count < 2 || count > 3) throw new Error(`Unexpected product count ${count}`);
    const targetBox = await page.locator("#checkout-scan-zone").boundingBox();
    if (!targetBox) throw new Error("Scan zone has no bounds");

    for (let item = 0; item < count; item += 1) {
      const card = cards.nth(item);
      const cardBox = await card.boundingBox();
      if (!cardBox) throw new Error(`Product card ${item} has no bounds`);
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();
      report.scannedItems += 1;
    }

    const payment = page.locator("#checkout-payment-button");
    await payment.waitFor({ state: "visible", timeout: 5000 });
    if (await payment.isDisabled()) throw new Error(`Payment did not unlock for customer ${customer + 1}`);
    await payment.click();
    await waitForSnapshot(page, { customersServed: customer + 1 }, 15000);
    if (customer === 0) report.assertions.paymentAdvancesOneCustomer = true;
  }

  const complete = await waitForSnapshot(page, {
    step: "complete",
    customersServed: 6
  }, 15000);
  report.assertions.allItemsRequireDrag = report.scannedItems === 15;
  report.assertions.allCustomersComplete = Boolean(complete && complete.step === "complete");
  await page.screenshot({ path: join(OUTPUT_DIR, "checkout-scan-complete.png"), fullPage: true });

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Checkout scanning audit failed: ${failed.join(", ") || "runtime"}; issues ${issueCount}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "checkout-scanning-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, scannedItems: report.scannedItems, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

function documentState(value) {
  return typeof value === "string" ? value : "";
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
  await clickGame(page, point.x, point.y);
  await page.waitForFunction(({ sceneKey, target }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const position = scene?.playerPosition?.();
    return position && Math.hypot(position.x - target.x, position.y - target.y) <= 10;
  }, { sceneKey: GAME_SCENE_KEY, target: point }, { timeout: 15000 });
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
