import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/late-level-assets");
const PORT = 4187;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";

const LEVELS = Object.freeze([
  Object.freeze({
    id: "starter-level-008",
    label: "l8",
    background: "environment-project-cleaning-l8-v1",
    spillKeys: Object.freeze([
      "spill-water-large",
      "spill-juice-large",
      "spill-dirt-smear-large",
      "spill-oil-large",
      "spill-footprint-large",
      "spill-trash-smear-large"
    ])
  }),
  Object.freeze({
    id: "starter-level-009",
    label: "l9",
    background: "environment-project-order-hunt-l9-v1"
  }),
  Object.freeze({
    id: "starter-level-010",
    label: "l10",
    background: "environment-project-restock-l10-v1"
  })
]);

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing");
mkdirSync(OUTPUT_DIR, { recursive: true });

const mimeType = (path) => {
  const extension = extname(path).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
};

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
  levels: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });

  for (const level of LEVELS) {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${level.label}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${level.label}: ${error.message}`));
    page.on("requestfailed", (request) => {
      report.failedRequests.push(`${level.label}: ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
    });

    const url = `${ORIGIN}/?test=1&briefing=0&guided=0&hold=0&cartload=0&checkout=0&patience=0&level=${encodeURIComponent(level.id)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
    await page.waitForFunction(({ id }) => (
      document.body.dataset.activeLevel === id &&
      Boolean(window.__IMMERSIVE_GAME__?.scene?.getScene("starter-market-shift"))
    ), { id: level.id }, { timeout: 30000 });
    await page.waitForTimeout(900);

    const state = await page.evaluate(({ sceneKey, expectedSpills }) => {
      const game = window.__IMMERSIVE_GAME__;
      const scene = game?.scene?.getScene(sceneKey);
      if (!scene) throw new Error(`Scene ${sceneKey} missing`);
      const background = scene.children.getByName("commercial-supermarket-salesfloor");
      const spillObjects = scene.children.list
        .filter((child) => /^clean-spill-\d+$/.test(child.name ?? ""))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const spillSourceKeys = spillObjects.map((spill) => spill.getData?.("spill-source-key"));
      const textures = expectedSpills.map((key) => ({ key, exists: scene.textures.exists(key) }));
      return {
        backgroundTexture: background?.texture?.key ?? null,
        sceneDressing: document.body.dataset.sceneDressing ?? null,
        cleaningSpillArt: document.body.dataset.cleaningSpillArt ?? null,
        spillCount: spillObjects.length,
        spillSourceKeys,
        textures
      };
    }, { sceneKey: SCENE_KEY, expectedSpills: level.spillKeys ?? [] });

    const assertions = {
      authoredBackgroundActive: state.backgroundTexture === level.background,
      backgroundOnlyScene: state.sceneDressing === "background-only"
    };

    if (level.spillKeys) {
      assertions.sixSpillsCreated = state.spillCount === level.spillKeys.length;
      assertions.sixDistinctSpillAssets = (
        state.spillSourceKeys.length === level.spillKeys.length &&
        level.spillKeys.every((key, index) => state.spillSourceKeys[index] === key)
      );
      assertions.sixSpillTexturesLoaded = state.textures.every(({ exists }) => exists);
      assertions.closingSpillPresentationActive = state.cleaningSpillArt === "six-variety-production";
    }

    report.levels[level.id] = { state, assertions };
    await page.screenshot({ path: join(OUTPUT_DIR, `${level.label}-initial.png`), fullPage: true });
    await page.close();
  }

  const failedAssertions = Object.entries(report.levels).flatMap(([levelId, value]) => (
    Object.entries(value.assertions)
      .filter(([, passed]) => !passed)
      .map(([name]) => `${levelId}:${name}`)
  ));
  const runtimeIssueCount = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length;
  if (failedAssertions.length || runtimeIssueCount) {
    throw new Error(
      `Late-level asset audit failed: ${failedAssertions.join(", ") || "runtime"}; issues ${runtimeIssueCount}`
    );
  }
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ levels: report.levels, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;
