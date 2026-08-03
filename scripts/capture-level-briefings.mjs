import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit");
const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;

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
  captures: [],
  details: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  assertions: {
    desktopLevelOne: false,
    mobileLevelOne: false,
    distinctLevelSeven: false,
    startResumesGameplay: false,
    touchTarget: false
  },
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
  const desktopPage = await desktopContext.newPage();
  attachListeners(desktopPage, report);
  const desktopInfo = await openBriefing(desktopPage, "starter-level-001");
  report.details.desktopLevelOne = desktopInfo;
  report.assertions.desktopLevelOne = (
    desktopInfo.title === "First Delivery" &&
    desktopInfo.modeLabel === "GUIDED DELIVERY" &&
    desktopInfo.objective.includes("cola case") &&
    desktopInfo.briefingState === "open" &&
    desktopInfo.panelInsideViewport
  );
  report.assertions.touchTarget = desktopInfo.buttonWidth >= 220 && desktopInfo.buttonHeight >= 52;
  await desktopPage.screenshot({
    path: join(OUTPUT_DIR, "briefing-level1-desktop.png"),
    fullPage: true
  });
  report.captures.push({ filename: "briefing-level1-desktop.png", viewport: "1600x900" });

  await desktopPage.locator("#level-briefing-overlay button").click();
  await desktopPage.waitForFunction(() => document.body.dataset.levelBriefing === "closed", null, {
    timeout: 10000
  });
  report.assertions.startResumesGameplay = await desktopPage.evaluate(() => (
    document.body.dataset.levelBriefing === "closed" &&
    document.body.dataset.activeLevel === "starter-level-001"
  ));
  await desktopPage.close();
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  attachListeners(mobilePage, report);
  const mobileInfo = await openBriefing(mobilePage, "starter-level-001");
  report.details.mobileLevelOne = mobileInfo;
  report.assertions.mobileLevelOne = mobileInfo.panelInsideViewport && mobileInfo.buttonHeight >= 52;
  await mobilePage.screenshot({
    path: join(OUTPUT_DIR, "briefing-level1-mobile-landscape.png"),
    fullPage: true
  });
  report.captures.push({ filename: "briefing-level1-mobile-landscape.png", viewport: "844x390@2x" });
  await mobilePage.close();
  await mobileContext.close();

  const variantContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const variantPage = await variantContext.newPage();
  attachListeners(variantPage, report);
  const variantInfo = await openBriefing(variantPage, "starter-level-007");
  report.details.levelSeven = variantInfo;
  report.assertions.distinctLevelSeven = (
    variantInfo.title === "Evening Checkout" &&
    variantInfo.modeLabel === "PATIENCE & WEIGHT" &&
    variantInfo.objective.includes("eight evening customers") &&
    variantInfo.objective.includes("patience bars") &&
    variantInfo.modeLabel !== desktopInfo.modeLabel &&
    variantInfo.panelInsideViewport
  );
  await variantPage.screenshot({
    path: join(OUTPUT_DIR, "briefing-level7-desktop.png"),
    fullPage: true
  });
  report.captures.push({ filename: "briefing-level7-desktop.png", viewport: "1366x768" });
  await variantPage.close();
  await variantContext.close();

  const issueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0 || issueCount > 0) {
    throw new Error(`Level briefing audit failed: ${failed.join(", ") || "browser runtime"}; issues ${issueCount}`);
  }
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(
    join(OUTPUT_DIR, "level-briefing-audit.json"),
    JSON.stringify(report, null, 2)
  );
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function openBriefing(page, levelId) {
  await page.goto(`${ORIGIN}/?level=${encodeURIComponent(levelId)}&briefing=1`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector("#level-briefing-overlay", { state: "visible", timeout: 30000 });
  await page.waitForFunction(
    (expectedLevel) => (
      document.body.dataset.activeLevel === expectedLevel &&
      document.body.dataset.levelBriefing === "open"
    ),
    levelId,
    { timeout: 30000 }
  );

  return page.evaluate(() => {
    const overlay = document.querySelector("#level-briefing-overlay");
    const titleElement = overlay?.querySelector("#level-briefing-title");
    const objectiveElement = titleElement?.nextElementSibling?.tagName === "P"
      ? titleElement.nextElementSibling
      : overlay?.querySelector("p");
    const panel = overlay?.firstElementChild?.getBoundingClientRect();
    const button = overlay?.querySelector("button")?.getBoundingClientRect();
    const panelInsideViewport = Boolean(
      panel &&
      panel.left >= 0 &&
      panel.top >= 0 &&
      panel.right <= window.innerWidth &&
      panel.bottom <= window.innerHeight
    );

    return {
      title: titleElement?.textContent?.trim() ?? "",
      modeLabel: document.body.dataset.levelExperience ?? "",
      objective: objectiveElement?.textContent?.trim() ?? "",
      briefingState: document.body.dataset.levelBriefing,
      panelInsideViewport,
      buttonWidth: button?.width ?? 0,
      buttonHeight: button?.height ?? 0
    };
  });
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
