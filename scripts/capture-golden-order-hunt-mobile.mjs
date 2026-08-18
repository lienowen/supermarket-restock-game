import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-hunt-mobile");
const PORT = 4195;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const W = 1600;
const H = 900;
const ORDER_ICON_IDS = Object.freeze(["milk-bottle", "apple", "cereal-box"]);

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
  viewport: { width: 390, height: 844 },
  assertions: {
    softwareLandscapeActive: false,
    canvasFitsViewport: false,
    authoredBackground: false,
    backgroundOnly: false,
    noAmbientDressing: false,
    expandedProductHotspots: false,
    joystickVisibleAndInteractive: false,
    orderIconsNormalized: false,
    productsReadable: false,
    mobileMoveSpeed: false,
    wrongTouchCostsTime: false,
    wrongTouchDoesNotAdvance: false,
    appleTouchPicks: false,
    cerealTouchPicks: false,
    milkTouchPicks: false,
    workerAutoWalks: false,
    pickupPoseObserved: false,
    basketReceivesThree: false,
    orderCompletes: false,
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
  const context = await browser.newContext({
    viewport: report.viewport,
    screen: report.viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36"
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
  attach(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=starter-level-005`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.goldenLevel === "level-5-three-zone-v3", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });
  await page.waitForFunction(() => document.body.dataset.goldenMobileTouch === "expanded-product-hotspots-v2", null, { timeout: 10000 });
  await page.waitForTimeout(350);

  const layout = await page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      softwareLandscape: document.body.dataset.softwareLandscape ?? "false"
    };
  }, CANVAS);
  report.assertions.softwareLandscapeActive = layout?.softwareLandscape === "true";
  report.assertions.canvasFitsViewport = Boolean(layout && layout.width > 300 && layout.height > 600 && layout.left >= -1 && layout.top >= -1 && layout.right <= layout.viewportWidth + 1 && layout.bottom <= layout.viewportHeight + 1 && layout.scrollWidth <= layout.viewportWidth + 1 && layout.scrollHeight <= layout.viewportHeight + 1);

  const initial = await readState(page);
  report.initial = initial;
  report.assertions.authoredBackground = initial.environmentKey === "environment-project-order-hunt-v2";
  report.assertions.backgroundOnly = initial.sceneDressing === "background-only";
  report.assertions.noAmbientDressing = initial.ambientCount === 0;
  report.assertions.expandedProductHotspots = initial.mobileTouch === "expanded-product-hotspots-v2";
  report.assertions.joystickVisibleAndInteractive = initial.joystickVisible === true && initial.joystickInteractive === true;
  report.assertions.orderIconsNormalized = (
    initial.orderIcons.length === ORDER_ICON_IDS.length &&
    initial.orderIcons.every((icon) => (
      icon.visible === true &&
      icon.alpha >= 0.99 &&
      icon.width >= 28 &&
      icon.height >= 28 &&
      icon.textureKey?.includes("--opaque-cutout")
    ))
  );
  report.assertions.productsReadable = initial.products.length === 8 && initial.products.every((item) => (
    item.width >= 35 && item.height >= 45 && Math.max(item.width, item.height) >= 68
  ));
  report.assertions.mobileMoveSpeed = initial.mobileMoveSpeed === "690";
  await page.screenshot({ path: join(OUTPUT_DIR, "level-5-mobile-initial.png"), fullPage: true });

  const cdp = await context.newCDPSession(page);
  const beforeWrong = initial.challenge;
  await tapLogical(page, cdp, 720, 348);
  await page.waitForFunction((key) => window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().mistakes === 1, SCENE_KEY, { timeout: 7000 });
  const afterWrong = await readState(page);
  report.assertions.wrongTouchCostsTime = beforeWrong.remainingMs - afterWrong.challenge.remainingMs >= 4500;
  report.assertions.wrongTouchDoesNotAdvance = afterWrong.controller.progress === 0 && afterWrong.challenge.collectedProductIds.length === 0;

  for (const product of [
    { id: "apple", x: 220, y: 475, assertion: "appleTouchPicks" },
    { id: "cereal-box", x: 620, y: 342, assertion: "cerealTouchPicks" },
    { id: "milk-bottle", x: 1290, y: 348, assertion: "milkTouchPicks" }
  ]) {
    await tapLogical(page, cdp, product.x, product.y);
    await page.waitForFunction(({ key, id }) => (
      window.__IMMERSIVE_GAME__?.scene?.getScene(key)?.findChallenge?.snapshot?.().collectedProductIds?.includes(id) === true
    ), { key: SCENE_KEY, id: product.id }, { timeout: 15000 });
    report.assertions[product.assertion] = true;
  }

  const final = await readState(page);
  report.final = final;
  report.assertions.workerAutoWalks = final.walkObserved === "true";
  report.assertions.pickupPoseObserved = final.pickupObserved === "true";
  report.assertions.basketReceivesThree = final.basketCount === "3";
  report.assertions.orderCompletes = final.controller.step === "complete" && final.challenge.status === "complete" && final.challenge.collectedProductIds.length === 3;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;
  await page.screenshot({ path: join(OUTPUT_DIR, "level-5-mobile-complete.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 5 mobile audit failed: ${failed.join(", ")}`);
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
  return page.evaluate(({ key, orderIconIds }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(key);
    const list = scene?.children?.list ?? [];
    const ambientNames = new Set(["ambient-produce-display", "ambient-backroom-rack", "ambient-shopping-cart", "ambient-customer-a", "ambient-customer-b"]);
    const joystick = scene?.children?.getByName?.("virtual-movement-joystick");
    const joystickHitZone = scene?.children?.getByName?.("virtual-movement-joystick-hit-zone");
    return {
      environmentKey: document.body.dataset.goldenEnvironment ?? scene?.context?.levelAssets?.environment?.key ?? null,
      sceneDressing: document.body.dataset.sceneDressing ?? null,
      mobileTouch: document.body.dataset.goldenMobileTouch ?? null,
      manualControl: document.body.dataset.goldenManualControl ?? null,
      mobileMoveSpeed: document.body.dataset.goldenMobileMoveSpeed ?? null,
      controller: scene?.controller?.snapshot?.() ?? null,
      challenge: scene?.findChallenge?.snapshot?.() ?? null,
      walkObserved: document.body.dataset.goldenWorkerWalkObserved ?? null,
      pickupObserved: document.body.dataset.goldenPickupObserved ?? null,
      basketCount: document.body.dataset.goldenBasketCount ?? null,
      joystickVisible: joystick?.visible ?? false,
      joystickInteractive: Boolean(joystickHitZone?.input?.enabled),
      orderIcons: orderIconIds.map((id) => {
        const icon = scene?.children?.getByName?.(`order-ticket-icon-${id}`);
        return {
          id,
          visible: icon?.visible === true,
          alpha: icon?.alpha ?? 0,
          width: icon?.displayWidth ?? 0,
          height: icon?.displayHeight ?? 0,
          textureKey: icon?.texture?.key ?? null
        };
      }),
      ambientCount: list.filter((entry) => ambientNames.has(entry?.name)).length,
      products: list.filter((entry) => typeof entry?.name === "string")
        .filter((entry) => entry.name.startsWith("find-item-") || entry.name.startsWith("find-decoy-"))
        .filter((entry) => entry.visible !== false && entry.active !== false)
        .map((entry) => ({ name: entry.name, width: entry.displayWidth ?? 0, height: entry.displayHeight ?? 0 }))
    };
  }, { key: SCENE_KEY, orderIconIds: ORDER_ICON_IDS });
}

async function tapLogical(page, cdp, logicalX, logicalY) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error("Missing game canvas bounds");
  const rotated = await page.evaluate(() => document.body.dataset.softwareLandscape === "true");
  const x = rotated
    ? box.x + box.width - (logicalY / H) * box.width
    : box.x + (logicalX / W) * box.width;
  const y = rotated
    ? box.y + (logicalX / W) * box.height
    : box.y + (logicalY / H) * box.height;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }] });
  await page.waitForTimeout(42);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
function attach(page, target) {
  page.on("console", (m) => { if (m.type() === "error") target.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => target.pageErrors.push(e.message));
  page.on("requestfailed", (r) => { const e = r.failure()?.errorText ?? "unknown"; if (!e.includes("ERR_ABORTED")) target.failedRequests.push(`${r.method()} ${r.url()} :: ${e}`); });
}
function mimeType(path) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
