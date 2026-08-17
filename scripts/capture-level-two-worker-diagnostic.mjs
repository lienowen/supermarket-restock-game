import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/mature-level-2-worker-diagnostic");
const PORT = 4199;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SCENE_KEY = "starter-market-shift";
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";

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
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const report = {
  generatedAt: new Date().toISOString(),
  level: "starter-level-002",
  assertions: {
    latestV2Selected: false,
    uniformRuntimeScale: false,
    runtimeTextureExported: false,
    noRuntimeIssues: false
  },
  worker: null,
  levelAssets: null,
  matchingTextureKeys: [],
  exportedTextures: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
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
    } } };
  });

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    report.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });

  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-002`, {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(
    () => document.body.dataset.activeLevel === "starter-level-002",
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(500);

  const runtime = await page.evaluate((sceneKey) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene) throw new Error("Missing Level 2 scene");
    const actor = scene.children?.getByName?.("restock-worker");
    if (!actor) throw new Error("Missing restock-worker game object");
    const source = actor.texture?.getSourceImage?.();
    const frame = actor.frame;
    const allKeys = scene.textures?.getTextureKeys?.() ?? [];
    const matchingTextureKeys = allKeys.filter((key) => (
      key.includes("worker-restock") ||
      key.includes("cut-restock-worker") ||
      key.includes("worker-a-idle") ||
      key.includes("worker-a-walk")
    ));
    return {
      worker: {
        textureKey: actor.texture?.key ?? null,
        frameName: frame?.name ?? null,
        frameWidth: frame?.width ?? null,
        frameHeight: frame?.height ?? null,
        frameRealWidth: frame?.realWidth ?? null,
        frameRealHeight: frame?.realHeight ?? null,
        frameCutWidth: frame?.cutWidth ?? null,
        frameCutHeight: frame?.cutHeight ?? null,
        sourceWidth: source instanceof HTMLImageElement ? source.naturalWidth : source?.width ?? null,
        sourceHeight: source instanceof HTMLImageElement ? source.naturalHeight : source?.height ?? null,
        displayWidth: actor.displayWidth ?? null,
        displayHeight: actor.displayHeight ?? null,
        scaleX: actor.scaleX ?? null,
        scaleY: actor.scaleY ?? null,
        originX: actor.originX ?? null,
        originY: actor.originY ?? null,
        x: actor.x ?? null,
        y: actor.y ?? null,
        flipX: actor.flipX ?? null
      },
      levelAssets: {
        workerIdle: scene.context?.levelAssets?.workerIdle?.key ?? null,
        workerIdlePath: scene.context?.levelAssets?.workerIdle?.path ?? null,
        workerPush: scene.context?.levelAssets?.workerPush?.key ?? null,
        workerPushPath: scene.context?.levelAssets?.workerPush?.path ?? null,
        workerWalk: (scene.context?.levelAssets?.workerWalk ?? []).map((asset) => ({
          key: asset?.key ?? null,
          path: asset?.path ?? null
        }))
      },
      matchingTextureKeys
    };
  }, SCENE_KEY);

  report.worker = runtime.worker;
  report.levelAssets = runtime.levelAssets;
  report.matchingTextureKeys = runtime.matchingTextureKeys;
  report.assertions.latestV2Selected = (
    runtime.levelAssets.workerIdle === "worker-restock-idle-v2" &&
    runtime.levelAssets.workerPush === "worker-restock-push-v2"
  );
  report.assertions.uniformRuntimeScale = Boolean(
    Number.isFinite(runtime.worker.scaleX) &&
    Number.isFinite(runtime.worker.scaleY) &&
    Math.abs(Math.abs(runtime.worker.scaleX) - Math.abs(runtime.worker.scaleY)) <= 0.002
  );

  const textureKeys = [...new Set([
    "worker-restock-idle-v2",
    "cut-restock-worker-idle",
    "cut-restock-worker-idle--opaque-cutout",
    runtime.worker.textureKey,
    ...runtime.matchingTextureKeys
  ].filter(Boolean))];

  for (const key of textureKeys) {
    const exported = await exportTexture(page, key);
    if (!exported) continue;
    const fileName = `${safeFileName(key)}.png`;
    writeFileSync(join(OUTPUT_DIR, fileName), Buffer.from(exported.base64, "base64"));
    report.exportedTextures.push({
      key,
      fileName,
      width: exported.width,
      height: exported.height
    });
  }

  report.assertions.runtimeTextureExported = report.exportedTextures.some(
    (entry) => entry.key === runtime.worker.textureKey
  );
  report.assertions.noRuntimeIssues = (
    report.consoleErrors.length === 0 &&
    report.pageErrors.length === 0 &&
    report.failedRequests.length === 0
  );

  await page.screenshot({ path: join(OUTPUT_DIR, "level-2-worker-runtime.png"), fullPage: true });

  const failed = Object.entries(report.assertions)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length > 0) {
    throw new Error(`L2 worker texture audit failed: ${failed.join(", ")}`);
  }

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}

console.log(JSON.stringify({
  assertions: report.assertions,
  worker: report.worker,
  levelAssets: report.levelAssets,
  matchingTextureKeys: report.matchingTextureKeys,
  exportedTextures: report.exportedTextures,
  fatalError: report.fatalError
}, null, 2));
if (thrownError) throw thrownError;

async function exportTexture(page, key) {
  return page.evaluate(({ sceneKey, key }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.textures?.exists?.(key)) return null;
    const source = scene.textures.get(key).getSourceImage();
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source?.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source?.height;
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/png");
    return {
      width,
      height,
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1)
    };
  }, { sceneKey: SCENE_KEY, key });
}

function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function mimeType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}
