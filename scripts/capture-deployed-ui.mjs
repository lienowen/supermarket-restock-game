import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = (process.env.AUDIT_BASE_URL ?? "https://supermarket-restock-game.vercel.app").replace(/\/+$/, "");
const OUTPUT_DIR = resolve("deployed-ui-audit");

mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  target: BASE_URL,
  generatedAt: new Date().toISOString(),
  finalUrl: "",
  title: "",
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  canvasState: null,
  resources: null
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

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  report.finalUrl = page.url();
  report.title = await page.title();
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await capture(page, "01-live-storefront.png", "Live storefront desktop");

  await clickGame(page, 1120, 1080);
  await page.waitForTimeout(500);
  await capture(page, "02-live-settings.png", "Live settings modal");

  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await clickGame(page, 965, 770);
  await page.waitForTimeout(1000);
  await capture(page, "03-live-start-flow.png", "Live start and opening flow");

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem("supermarket.activeDay", "day03");
    localStorage.setItem("supermarket.bestStars", JSON.stringify({ day01: 3, day02: 3 }));
    localStorage.removeItem("supermarket.lastShiftResult");
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await page.setViewportSize({ width: 907, height: 510 });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);
  await page.waitForTimeout(500);
  await capture(page, "04-live-mobile-907x510.png", "Live mobile landscape");

  report.canvasState = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportMode: document.body.dataset.viewportMode,
      scene: document.body.dataset.gameScene,
      marginLeft: getComputedStyle(canvas).marginLeft,
      marginTop: getComputedStyle(canvas).marginTop
    };
  });

  report.resources = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const entries = resources.map((entry) => ({
      name: entry.name,
      durationMs: Math.round(entry.duration),
      transferSize: "transferSize" in entry ? entry.transferSize : 0,
      decodedBodySize: "decodedBodySize" in entry ? entry.decodedBodySize : 0,
      initiatorType: "initiatorType" in entry ? entry.initiatorType : ""
    }));
    return {
      count: entries.length,
      transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
      decodedBytes: entries.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      slowest: [...entries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15),
      largest: [...entries].sort((a, b) => b.decodedBodySize - a.decodedBodySize).slice(0, 15)
    };
  });

  writeFileSync(join(OUTPUT_DIR, "deployed-ui-report.json"), JSON.stringify(report, null, 2));

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  console.log(`Audited ${BASE_URL} with ${issueCount} browser issue(s).`);
  console.log(JSON.stringify({
    finalUrl: report.finalUrl,
    title: report.title,
    canvasState: report.canvasState,
    resourceCount: report.resources?.count,
    transferBytes: report.resources?.transferBytes,
    decodedBytes: report.resources?.decodedBytes,
    consoleErrors: report.consoleErrors,
    pageErrors: report.pageErrors,
    failedRequests: report.failedRequests,
    badResponses: report.badResponses
  }, null, 2));
} finally {
  await browser.close();
}

async function waitForCanvas(page) {
  await page.waitForSelector("canvas", { state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  }, { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function clickGame(page, gameX, gameY) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  const x = box.x + (gameX / 1330) * box.width;
  const y = box.y + (gameY / 1182) * box.height;
  await page.mouse.click(x, y);
}

async function capture(page, filename, label) {
  await page.screenshot({ path: join(OUTPUT_DIR, filename), fullPage: true });
  report.screenshots.push({ filename, label, viewport: page.viewportSize() });
}
