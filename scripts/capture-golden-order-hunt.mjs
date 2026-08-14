import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-hunt");
const PORT = 4184;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const W = 1600;
const H = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing");
mkdirSync(OUTPUT_DIR, { recursive: true });
const server = createServer((request, response) => {
  const raw = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let path = join(DIST_DIR, safe);
  if (!existsSync(path) || !statSync(path).isFile()) path = join(DIST_DIR, "index.html");
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeType(path));
  response.setHeader("Cache-Control", "no-store");
  response.end(readFileSync(path));
});
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  assertions: {
    rebuiltSceneActive: false,
    authoredOrderHuntBackground: false,
    backgroundOnly: false,
    noAmbientDressing: false,
    compactHudActive: false,
    eightProductsVisible: false,
    threeZonesReadable: false,
    productScaleSane: false,
    wrongItemCostsTime: false,
    wrongItemDoesNotAdvance: false,
    autoWalkPickupWorks: false,
    orderCompletes: false,
    basketReceivesThree: false,
    noRuntimeIssues: false
  },
  initial: null,
  final: null,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=starter-level-005`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.goldenLevel === "level-5-three-zone-v2", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.findItemsVisibleCount === "8", null, { timeout: 15000 });

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.rebuiltSceneActive = initial.goldenLevel === "level-5-three-zone-v2";
  report.assertions.authoredOrderHuntBackground = initial.environmentKey === "environment-project-order-hunt-v2";
  report.assertions.backgroundOnly = initial.sceneDressing === "background-only";
  report.assertions.noAmbientDressing = initial.ambientCount === 0;
  report.assertions.compactHudActive = initial.goldenHud === "compact-v2";
  report.assertions.eightProductsVisible = initial.products.length === 8;
  report.assertions.productScaleSane = initial.products.every((item) => item.width >= 25 && item.width <= 72 && item.height >= 30 && item.height <= 86);

  const byName = new Map(initial.products.map((item) => [item.name, item]));
  const inside = (name, x1, x2, y1, y2) => {
    const item = byName.get(name);
    return Boolean(item && item.x >= x1 && item.x <= x2 && item.y >= y1 && item.y <= y2);
  };
  report.assertions.threeZonesReadable = Boolean(
    inside("find-decoy-banana", 80, 350, 480, 540) &&
    inside("find-item-apple", 80, 350, 480, 540) &&
    inside("find-decoy-grapes", 80, 350, 480, 540) &&
    inside("find-item-cereal-box", 580, 850, 350, 430) &&
    inside("find-decoy-oats", 580, 850, 350, 430) &&
    inside("find-decoy-peanut-butter", 580, 850, 350, 430) &&
    inside("find-item-milk-bottle", 1250, 1440, 370, 440) &&
    inside("find-decoy-yogurt", 1250, 1440, 370, 440)
  );
  await page.screenshot({ path: join(OUTPUT_DIR, "golden-order-hunt-initial.png"), fullPage: true });

  const beforeMistake = initial.challenge;
  await clickGame(page, 720, 390);
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().mistakes === 1, SCENE_KEY, { timeout: 7000 });
  const afterMistake = await readState(page);
  report.assertions.wrongItemCostsTime = beforeMistake.remainingMs - afterMistake.challenge.remainingMs >= 4500;
  report.assertions.wrongItemDoesNotAdvance = afterMistake.controller.progress === 0 && afterMistake.challenge.collectedProductIds.length === 0;

  for (const product of [
    { id: "apple", x: 220, y: 515 },
    { id: "cereal-box", x: 620, y: 390 },
    { id: "milk-bottle", x: 1290, y: 405 }
  ]) {
    await clickGame(page, product.x, product.y);
    await page.waitForFunction(({ key, id }) => (
      window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().collectedProductIds?.includes(id) === true
    ), { key: SCENE_KEY, id: product.id }, { timeout: 15000 });
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.autoWalkPickupWorks = final.walkObserved === "true" && final.pickupObserved === "true";
  report.assertions.orderCompletes = final.controller.step === "complete" && final.challenge.status === "complete" && final.challenge.collectedProductIds.length === 3;
  report.assertions.basketReceivesThree = final.basketCount === "3";
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "golden-order-hunt-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 5 desktop audit failed: ${failed.join(", ")}`);
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

async function readState(page) {
  return page.evaluate((key) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const list = scene?.children?.list ?? [];
    const ambientNames = new Set(["ambient-produce-display", "ambient-backroom-rack", "ambient-shopping-cart", "ambient-customer-a", "ambient-customer-b"]);
    return {
      goldenLevel: document.body.dataset.goldenLevel ?? null,
      goldenHud: document.body.dataset.goldenHud ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      environmentKey: scene?.context?.levelAssets?.environment?.key ?? scene?.goldenContext?.levelAssets?.environment?.key ?? document.body.dataset.goldenEnvironment ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      walkObserved: document.body.dataset.goldenWorkerWalkObserved ?? null,
      pickupObserved: document.body.dataset.goldenPickupObserved ?? null,
      basketCount: document.body.dataset.goldenBasketCount ?? null,
      ambientCount: list.filter((entry) => ambientNames.has(entry?.name)).length,
      products: list.filter((entry) => typeof entry?.name === "string")
        .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
        .filter((entry) => entry.visible !== false && entry.active !== false)
        .map((entry) => ({ name: entry.name, x: entry.x, y: entry.y, width: entry.displayWidth ?? 0, height: entry.displayHeight ?? 0 }))
    };
  }, SCENE_KEY);
}

async function clickGame(page, x, y) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Missing game canvas bounds");
  await page.mouse.click(box.x + (x / W) * box.width, box.y + (y / H) * box.height);
}
function attach(page, target) {
  page.on("console", (m) => { if (m.type() === "error") target.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => target.pageErrors.push(e.message));
  page.on("requestfailed", (r) => { const e = r.failure()?.errorText ?? "unknown"; if (!e.includes("ERR_ABORTED")) target.failedRequests.push(`${r.method()} ${r.url()} :: ${e}`); });
}
function mimeType(path) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
