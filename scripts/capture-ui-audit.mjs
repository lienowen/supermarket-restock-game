import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;

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

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: []
};

try {
  const context = await browser.newContext({
    viewport: { width: 1330, height: 1182 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (error.includes("ERR_ABORTED")) return;
    report.failedRequests.push({ url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) report.badResponses.push({ url: response.url(), status: response.status() });
  });

  await clearProgress(page);
  await openGame(page);
  await capture(page, report, "01-storefront-day1.png", "Day 1 storefront lobby", "desktop");

  await clickGame(page, 180, 1080);
  await page.waitForTimeout(450);
  await capture(page, report, "02-shift-selector.png", "Shift selector", "desktop");

  await page.reload({ waitUntil: "networkidle" });
  await waitForCanvas(page);
  await clickGame(page, 1120, 1080);
  await page.waitForTimeout(500);
  await capture(page, report, "03-settings.png", "Settings modal", "desktop");

  await page.reload({ waitUntil: "networkidle" });
  await waitForCanvas(page);
  await clickGame(page, 965, 770);
  await waitForScene(page, "opening");
  await page.waitForTimeout(450);
  await capture(page, report, "04-opening-receiving.png", "Opening receiving flow", "desktop");

  await clickGame(page, 835, 1085);
  await page.waitForTimeout(1250);
  await capture(page, report, "05-delivery-truck.png", "Delivery truck and draggable cases", "desktop");

  await setProgress(page, "day02", { day01: 3 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForCanvas(page);
  await capture(page, report, "06-storefront-day2.png", "Day 2 storefront lobby", "desktop");

  await setProgress(page, "day03", { day01: 3, day02: 3 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForCanvas(page);
  await capture(page, report, "07-storefront-day3.png", "Day 3 storefront lobby", "desktop");

  await page.setViewportSize({ width: 907, height: 510 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForCanvas(page);
  await page.waitForTimeout(450);
  await capture(page, report, "08-mobile-landscape-storefront.png", "Mobile landscape storefront", "907x510");

  report.canvasState = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      viewportMode: document.body.dataset.viewportMode,
      scene: document.body.dataset.gameScene
    };
  });

  writeFileSync(join(OUTPUT_DIR, "ui-audit-report.json"), JSON.stringify(report, null, 2));

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  console.log(`Captured ${report.screenshots.length} UI states with ${issueCount} browser issue(s).`);
  if (issueCount > 0) {
    console.log(JSON.stringify({
      consoleErrors: report.consoleErrors,
      pageErrors: report.pageErrors,
      failedRequests: report.failedRequests,
      badResponses: report.badResponses
    }, null, 2));
  }
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

async function clearProgress(page) {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
}

async function setProgress(page, activeDay, bestStars) {
  await page.evaluate(({ activeDayValue, bestStarsValue }) => {
    localStorage.setItem("supermarket.activeDay", activeDayValue);
    localStorage.setItem("supermarket.bestStars", JSON.stringify(bestStarsValue));
    localStorage.removeItem("supermarket.lastShiftResult");
  }, { activeDayValue: activeDay, bestStarsValue: bestStars });
}

async function openGame(page) {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await waitForCanvas(page);
}

async function waitForCanvas(page) {
  await page.waitForSelector("canvas", { state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  });
  await page.waitForTimeout(650);
}

async function waitForScene(page, scene) {
  await page.waitForFunction((expectedScene) => document.body.dataset.gameScene === expectedScene, scene, {
    timeout: 10000
  });
}

async function clickGame(page, gameX, gameY) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  const x = box.x + (gameX / 1330) * box.width;
  const y = box.y + (gameY / 1182) * box.height;
  await page.mouse.click(x, y);
}

async function capture(page, auditReport, filename, label, viewport) {
  const target = join(OUTPUT_DIR, filename);
  await page.screenshot({ path: target, fullPage: true });
  auditReport.screenshots.push({ filename, label, viewport });
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
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav"
  }[extension] ?? "application/octet-stream";
}
