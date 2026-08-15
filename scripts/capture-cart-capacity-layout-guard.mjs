import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/cart-capacity-layout-guard");
const PORT = 4197;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
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
  viewport: { width: 390, height: 844 },
  assertions: {
    softwareLandscapeActive: false,
    panelInsideViewport: false,
    undoFullyInsidePanel: false,
    undoInsideViewport: false,
    feedbackFullyInsidePanel: false,
    feedbackInsideViewport: false,
    taskGuardActive: false,
    compactOverlayPaddingActive: false,
    noRuntimeIssues: false
  },
  layout: null,
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
  await page.goto(`${ORIGIN}/?test=1&briefing=0&cartload=1&level=starter-level-006`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-006", null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.softwareLandscape === "true", null, { timeout: 10000 });

  const cdp = await context.newCDPSession(page);
  await tapLogical(page, cdp, 1228, 850);
  await page.waitForFunction(() => document.body.dataset.cartCapacityLoad === "active", null, { timeout: 20000 });
  await page.locator("#cart-capacity-load").waitFor({ state: "visible", timeout: 10000 });

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height
      };
    };
    const overlay = document.querySelector("#cart-capacity-load");
    const panel = document.querySelector("#cart-capacity-panel");
    const before = overlay instanceof HTMLElement ? getComputedStyle(overlay, "::before") : null;
    const overlayStyle = overlay instanceof HTMLElement ? getComputedStyle(overlay) : null;
    const panelStyle = panel instanceof HTMLElement ? getComputedStyle(panel) : null;
    return {
      overlay: rect("#cart-capacity-load"),
      panel: rect("#cart-capacity-panel"),
      undo: rect("#cart-capacity-undo"),
      feedback: rect("#cart-capacity-feedback"),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      softwareLandscape: document.body.dataset.softwareLandscape ?? "false",
      overlayPaddingTop: overlayStyle?.paddingTop ?? null,
      overlayPaddingBottom: overlayStyle?.paddingBottom ?? null,
      panelOverflow: panelStyle?.overflow ?? null,
      guard: before ? {
        content: before.content,
        width: before.width,
        height: before.height,
        backgroundImage: before.backgroundImage,
        backgroundColor: before.backgroundColor
      } : null
    };
  });
  report.layout = layout;

  const inside = (inner, outer, tolerance = 1.5) => Boolean(inner && outer &&
    inner.left >= outer.left - tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.bottom <= outer.bottom + tolerance);
  const insideViewport = (inner, viewport, tolerance = 1.5) => Boolean(inner && viewport &&
    inner.left >= -tolerance && inner.top >= -tolerance &&
    inner.right <= viewport.width + tolerance && inner.bottom <= viewport.height + tolerance);

  report.assertions.softwareLandscapeActive = layout.softwareLandscape === "true";
  report.assertions.panelInsideViewport = insideViewport(layout.panel, layout.viewport, 2);
  report.assertions.undoFullyInsidePanel = inside(layout.undo, layout.panel, 2);
  report.assertions.undoInsideViewport = insideViewport(layout.undo, layout.viewport, 2);
  report.assertions.feedbackFullyInsidePanel = inside(layout.feedback, layout.panel, 2);
  report.assertions.feedbackInsideViewport = insideViewport(layout.feedback, layout.viewport, 2);
  report.assertions.taskGuardActive = Boolean(layout.guard &&
    layout.guard.content !== "none" &&
    layout.guard.content !== "normal" &&
    parseFloat(layout.guard.width) >= 300 &&
    parseFloat(layout.guard.height) >= 100 &&
    layout.guard.backgroundImage !== "none");
  report.assertions.compactOverlayPaddingActive =
    parseFloat(layout.overlayPaddingTop ?? "99") <= 6 &&
    parseFloat(layout.overlayPaddingBottom ?? "99") <= 6;
  report.assertions.noRuntimeIssues =
    report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;

  await page.screenshot({ path: join(OUTPUT_DIR, "level-6-mobile-layout-guard.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Level 6 layout guard failed: ${failed.join(", ")}`);
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

console.log(JSON.stringify({ assertions: report.assertions, layout: report.layout, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

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
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }]
  });
  await page.waitForTimeout(48);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

function attach(page, target) {
  page.on("console", (message) => {
    if (message.type() === "error") target.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => target.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) target.failedRequests.push(`${request.method()} ${request.url()} :: ${error}`);
  });
}

function mimeType(path) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
