import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

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
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  fatalError: null,
  regressions: {
    stockedLobby: false,
    milkCaseVisible: false,
    day3ReachedGame: false
  }
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({ viewport: { width: 1330, height: 1182 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) report.failedRequests.push({ url: request.url(), error });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) report.badResponses.push({ url: response.url(), status: response.status() });
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("supermarket.activeDay", "day03");
    localStorage.setItem("supermarket.bestStars", JSON.stringify({ day01: 3, day02: 3 }));
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await waitForCanvas(page);

  report.regressions.stockedLobby = await page.evaluate(() => document.body.dataset.stockedLobbyVisual === "ready");
  await capture(page, report, "01-stocked-lobby.png", "Stocked supermarket lobby");

  await clickGame(page, 965, 770);
  await waitForScene(page, "opening", 60000);
  await capture(page, report, "02-day3-receiving.png", "Day 3 receiving area");

  await clickGame(page, 835, 1085);
  await page.waitForFunction(() => document.body.dataset.milkCaseVisual === "ready", { timeout: 30000 });
  report.regressions.milkCaseVisible = true;
  await page.waitForTimeout(350);
  await capture(page, report, "03-visible-milk-case.png", "Visible milk delivery case");

  const cases = [
    { from: [380, 807], to: [865, 840] },
    { from: [500, 807], to: [985, 875] },
    { from: [385, 882], to: [1105, 840] },
    { from: [505, 882], to: [955, 955] }
  ];

  for (const deliveryCase of cases) {
    await dragGame(page, deliveryCase.from[0], deliveryCase.from[1], deliveryCase.to[0], deliveryCase.to[1]);
    await page.waitForTimeout(950);
  }

  await clickGame(page, 835, 1085);
  await page.waitForTimeout(500);
  await clickGame(page, 665, 830);
  await page.waitForTimeout(500);
  await clickGame(page, 835, 1085);
  await page.waitForTimeout(1400);
  await clickGame(page, 835, 1085);
  await waitForScene(page, "game", 60000);
  await page.waitForTimeout(800);

  report.regressions.day3ReachedGame = await page.evaluate(() => document.body.dataset.gameScene === "game");
  await capture(page, report, "04-day3-backroom.png", "Day 3 entered backroom without black screen");

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + report.badResponses.length;
  const failed = Object.entries(report.regressions).filter(([, value]) => !value).map(([key]) => key);
  if (issueCount > 0 || failed.length > 0) {
    throw new Error(`Release regressions failed: ${failed.join(", ") || "browser runtime"}; browser issues ${issueCount}`);
  }
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "ui-audit-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ regressions: report.regressions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function waitForCanvas(page) {
  await page.waitForSelector("canvas", { state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  }, { timeout: 30000 });
  await page.waitForTimeout(850);
}

async function waitForScene(page, scene, timeout) {
  await page.waitForFunction((expected) => document.body.dataset.gameScene === expected, scene, { timeout });
}

async function gamePoint(page, gameX, gameY) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  return {
    x: box.x + (gameX / 1330) * box.width,
    y: box.y + (gameY / 1182) * box.height
  };
}

async function clickGame(page, gameX, gameY) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function dragGame(page, fromX, fromY, toX, toY) {
  const from = await gamePoint(page, fromX, fromY);
  const to = await gamePoint(page, toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

async function capture(page, auditReport, filename, label) {
  await page.screenshot({ path: join(OUTPUT_DIR, filename), fullPage: true });
  auditReport.screenshots.push({ filename, label });
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
