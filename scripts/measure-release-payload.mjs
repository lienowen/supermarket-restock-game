import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_FILE = resolve("release-payload-report.json");
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}/?test=1`;
const GAME_CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const MOBILE_HOMEPAGE_TARGET_BYTES = 20 * 1024 * 1024;
const BASIC_LAUNCH_TARGET_BYTES = 50 * 1024 * 1024;
const MOBILE_NETWORK_PROFILE = {
  label: "mobile-10mbps",
  latencyMs: 80,
  downloadMbps: 10,
  uploadMbps: 3
};
const TIMING_LIMITS_MS = {
  canvasVisible: 20_000,
  lobbyInteractive: 30_000,
  firstShiftReady: 60_000
};

if (!existsSync(join(DIST_DIR, "index.html"))) {
  throw new Error("dist/index.html is missing. Run npm run build first.");
}

let activePhase = null;
const requestsByPhase = {
  homepageCold: [],
  firstShiftAdditional: []
};

const server = createServer((request, response) => {
  const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const requested = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(DIST_DIR, safePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(DIST_DIR, "index.html");

  if (activePhase) {
    requestsByPhase[activePhase].push({
      path: relative(DIST_DIR, filePath),
      bytes: statSync(filePath).size
    });
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", mimeType(filePath));
  response.setHeader("Cache-Control", "no-store");
  response.end(readFileSync(filePath));
});

await new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", resolveServer));

const browser = await chromium.launch({ headless: true });
let thrownError;
let report;

try {
  const context = await browser.newContext({
    viewport: { width: 1330, height: 1182 },
    deviceScaleFactor: 1
  });
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
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: MOBILE_NETWORK_PROFILE.latencyMs,
    downloadThroughput: mbpsToBytesPerSecond(MOBILE_NETWORK_PROFILE.downloadMbps),
    uploadThroughput: mbpsToBytesPerSecond(MOBILE_NETWORK_PROFILE.uploadMbps),
    connectionType: "cellular4g"
  });

  const runtimeIssues = [];
  page.on("pageerror", (error) => runtimeIssues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (!failure.includes("ERR_ABORTED")) runtimeIssues.push(`requestfailed: ${request.url()} (${failure})`);
  });

  const navigationStartedAt = Date.now();
  activePhase = "homepageCold";
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
  const navigationReadyMs = Date.now() - navigationStartedAt;

  await waitForCanvas(page);
  const canvasVisibleMs = Date.now() - navigationStartedAt;

  await page.waitForFunction(
    () => document.body.dataset.stockedLobbyVisual === "ready",
    null,
    { timeout: 45000 }
  );
  const lobbyInteractiveMs = Date.now() - navigationStartedAt;
  const browserNavigation = await readNavigationTiming(page);

  await page.waitForTimeout(3500);
  activePhase = null;

  activePhase = "firstShiftAdditional";
  const firstShiftStartedAt = Date.now();
  await clickGame(page, 965, 770);
  await page.waitForFunction(
    () => (
      document.body.dataset.gameScene === "opening" ||
      document.body.dataset.crazyGamesScene === "receiving"
    ),
    null,
    { timeout: 90000 }
  );
  const firstShiftReadyMs = Date.now() - firstShiftStartedAt;
  await page.waitForTimeout(2500);
  activePhase = null;

  report = {
    generatedAt: new Date().toISOString(),
    networkProfile: MOBILE_NETWORK_PROFILE,
    timings: {
      navigationReadyMs,
      canvasVisibleMs,
      lobbyInteractiveMs,
      firstShiftReadyMs,
      browserNavigation
    },
    homepageCold: summarize(requestsByPhase.homepageCold),
    firstShiftAdditional: summarize(requestsByPhase.firstShiftAdditional),
    runtimeIssues
  };

  report.budgets = {
    homepageMobile20MiB: byteBudget(MOBILE_HOMEPAGE_TARGET_BYTES, report.homepageCold.transferredBytes),
    homepageBasic50MiB: byteBudget(BASIC_LAUNCH_TARGET_BYTES, report.homepageCold.transferredBytes),
    canvasVisible20s: timingBudget(TIMING_LIMITS_MS.canvasVisible, canvasVisibleMs),
    lobbyInteractive30s: timingBudget(TIMING_LIMITS_MS.lobbyInteractive, lobbyInteractiveMs),
    firstShiftReady60s: timingBudget(TIMING_LIMITS_MS.firstShiftReady, firstShiftReadyMs)
  };

  if (runtimeIssues.length > 0) {
    throw new Error(`Payload measurement encountered ${runtimeIssues.length} browser issue(s).`);
  }
  const failedBudgets = Object.entries(report.budgets)
    .filter(([, budget]) => !budget.passed)
    .map(([name]) => name);
  if (failedBudgets.length > 0) {
    throw new Error(`Loading or payload budgets failed: ${failedBudgets.join(", ")}.`);
  }
} catch (error) {
  thrownError = error;
  report ??= {
    generatedAt: new Date().toISOString(),
    networkProfile: MOBILE_NETWORK_PROFILE,
    timings: null,
    homepageCold: summarize(requestsByPhase.homepageCold),
    firstShiftAdditional: summarize(requestsByPhase.firstShiftAdditional),
    runtimeIssues: []
  };
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  activePhase = null;
  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(`Release payload and speed measurement (${MOBILE_NETWORK_PROFILE.label}):`);
printSummary("Cold homepage", report.homepageCold);
printSummary("First shift additional", report.firstShiftAdditional);
if (report.timings) printTimingSummary(report.timings);
if (report.budgets) {
  Object.entries(report.budgets).forEach(([name, budget]) => {
    console.log(`${name}: ${budget.passed ? "PASS" : "OVER"}`);
  });
}
if (thrownError) throw thrownError;

function summarize(requests) {
  const totals = new Map();
  let transferredBytes = 0;
  for (const request of requests) {
    transferredBytes += request.bytes;
    totals.set(request.path, Math.max(totals.get(request.path) ?? 0, request.bytes));
  }
  const files = [...totals.entries()]
    .map(([path, bytes]) => ({ path, bytes }))
    .sort((left, right) => right.bytes - left.bytes);
  return {
    requestCount: requests.length,
    uniqueFileCount: files.length,
    transferredBytes,
    transferredMiB: toMiB(transferredBytes),
    uniqueBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    uniqueMiB: toMiB(files.reduce((sum, file) => sum + file.bytes, 0)),
    topFiles: files.slice(0, 20)
  };
}

function printSummary(label, summary) {
  console.log(
    `${label}: ${summary.transferredMiB} MiB transferred, ${summary.requestCount} requests, ` +
    `${summary.uniqueFileCount} unique files.`
  );
  summary.topFiles.slice(0, 10).forEach((file, index) => {
    console.log(`  ${String(index + 1).padStart(2, "0")}. ${toMiB(file.bytes).padStart(7)} MiB  ${file.path}`);
  });
}

function printTimingSummary(timings) {
  console.log("Loading timings:");
  console.log(`  Navigation network-idle: ${toSeconds(timings.navigationReadyMs)} s`);
  console.log(`  Canvas visible:          ${toSeconds(timings.canvasVisibleMs)} s`);
  console.log(`  Lobby interactive:       ${toSeconds(timings.lobbyInteractiveMs)} s`);
  console.log(`  Start to receiving:      ${toSeconds(timings.firstShiftReadyMs)} s`);
  if (timings.browserNavigation) {
    console.log(`  Browser DOMContentLoaded:${toSeconds(timings.browserNavigation.domContentLoadedMs)} s`);
    console.log(`  Browser load event:      ${toSeconds(timings.browserNavigation.loadEventMs)} s`);
  }
}

async function waitForCanvas(page) {
  await page.waitForSelector(GAME_CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction((selector) => {
    const canvas = document.querySelector(selector);
    return Boolean(canvas && canvas.getBoundingClientRect().width > 100);
  }, GAME_CANVAS_SELECTOR, { timeout: 45000 });
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(GAME_CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  await page.mouse.click(
    box.x + (gameX / 1330) * box.width,
    box.y + (gameY / 1182) * box.height
  );
}

async function readNavigationTiming(page) {
  return page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    if (!(entry instanceof PerformanceNavigationTiming)) return null;
    return {
      responseStartMs: Math.round(entry.responseStart),
      domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
      loadEventMs: Math.round(entry.loadEventEnd),
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize
    };
  });
}

function byteBudget(limitBytes, actualBytes) {
  return { limitBytes, actualBytes, passed: actualBytes <= limitBytes };
}

function timingBudget(limitMs, actualMs) {
  return { limitMs, actualMs, passed: actualMs <= limitMs };
}

function mbpsToBytesPerSecond(mbps) {
  return Math.round((mbps * 1024 * 1024) / 8);
}

function toMiB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function toSeconds(milliseconds) {
  return (milliseconds / 1000).toFixed(2);
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
