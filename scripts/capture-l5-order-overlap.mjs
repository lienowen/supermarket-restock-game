import { createServer } from "node:http";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("ui-audit/golden-order-overlap");
const PORT = 4196;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const ORDER_ICON_IDS = Object.freeze(["milk-bottle", "apple", "cereal-box"]);
const SOURCE_ASSETS = Object.freeze([
  ["milk-source.png", "assets/game/production-v1/products/product-milk-jug.png"],
  ["apple-source.png", "assets/game/production-v1/products/product-apple.png"],
  ["cereal-source.png", "assets/game/production-v1/products/product-cereal-box.png"]
]);

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing");
mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [fileName, relativePath] of SOURCE_ASSETS) {
  const sourcePath = join(DIST_DIR, relativePath);
  if (existsSync(sourcePath)) copyFileSync(sourcePath, join(OUTPUT_DIR, fileName));
}

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
    exactlyThreeOrderIcons: false,
    noOrderIconToOrderIconOverlap: false,
    noUnexpectedImageOverlap: false,
    noDuplicateOrderTextures: false,
    runtimeTexturesExported: false,
    noRuntimeIssues: false
  },
  orderTicket: null,
  orderIcons: [],
  imageOverlaps: [],
  exportedTextures: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrown;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
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
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  page.on("requestfailed", (r) => {
    const error = r.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) report.failedRequests.push(`${r.method()} ${r.url()} :: ${error}`);
  });

  await page.goto(`${ORIGIN}/?test=1&briefing=0&level=starter-level-005`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.goldenLevel === "level-5-three-zone-v3", null, { timeout: 30000 });
  await page.waitForTimeout(500);

  const runtime = await page.evaluate(({ sceneKey, orderIconIds }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene) throw new Error("Missing L5 scene");
    const ticket = scene.children?.getByName?.("find-items-order-ticket");
    if (!ticket || !Array.isArray(ticket.list)) throw new Error("Missing order ticket container");

    const boundsOf = (object) => {
      try {
        const b = object?.getBounds?.();
        if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
          return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
        }
      } catch {}
      return null;
    };

    const flatten = (objects, parentName = null, out = []) => {
      for (const object of objects ?? []) {
        if (!object) continue;
        out.push({ object, parentName });
        if (Array.isArray(object.list)) flatten(object.list, object.name || parentName, out);
      }
      return out;
    };

    const flat = flatten(scene.children?.list ?? []);
    const images = flat
      .filter(({ object }) => object?.type === "Image" && object.visible !== false && object.active !== false)
      .map(({ object, parentName }) => ({
        name: object.name || null,
        parentName,
        textureKey: object.texture?.key ?? null,
        alpha: object.alpha ?? 1,
        depth: object.depth ?? 0,
        bounds: boundsOf(object)
      }))
      .filter((entry) => entry.bounds);

    const icons = orderIconIds.map((id) => {
      const name = `order-ticket-icon-${id}`;
      const matches = flat
        .filter(({ object }) => object?.name === name)
        .map(({ object, parentName }) => ({
          id,
          name,
          parentName,
          textureKey: object.texture?.key ?? null,
          alpha: object.alpha ?? 0,
          visible: object.visible !== false,
          depth: object.depth ?? 0,
          bounds: boundsOf(object)
        }));
      return { id, matches };
    });

    const ticketBounds = boundsOf(ticket);
    return { ticket: { name: ticket.name, depth: ticket.depth ?? 0, bounds: ticketBounds }, icons, images };
  }, { sceneKey: SCENE_KEY, orderIconIds: ORDER_ICON_IDS });

  report.orderTicket = runtime.ticket;
  report.orderIcons = runtime.icons;

  const icons = runtime.icons.flatMap((entry) => entry.matches);
  report.assertions.exactlyThreeOrderIcons = runtime.icons.every((entry) => entry.matches.length === 1) && icons.length === 3;

  const iconPairs = [];
  for (let i = 0; i < icons.length; i += 1) {
    for (let j = i + 1; j < icons.length; j += 1) {
      const ratio = overlapRatio(icons[i].bounds, icons[j].bounds);
      if (ratio > 0.01) iconPairs.push({ a: icons[i].name, b: icons[j].name, overlapRatio: ratio });
    }
  }
  report.assertions.noOrderIconToOrderIconOverlap = iconPairs.length === 0;

  const iconNames = new Set(icons.map((entry) => entry.name));
  const suspicious = [];
  for (const icon of icons) {
    for (const image of runtime.images) {
      if (!image.name || iconNames.has(image.name)) continue;
      const ratio = overlapRatio(icon.bounds, image.bounds);
      if (ratio >= 0.2 && image.depth >= runtime.ticket.depth) {
        suspicious.push({ icon: icon.name, other: image.name, textureKey: image.textureKey, depth: image.depth, overlapRatio: ratio });
      }
    }
  }
  report.imageOverlaps = suspicious;
  report.assertions.noUnexpectedImageOverlap = suspicious.length === 0;

  const textureCounts = new Map();
  for (const icon of icons) textureCounts.set(icon.textureKey, (textureCounts.get(icon.textureKey) ?? 0) + 1);
  report.assertions.noDuplicateOrderTextures = [...textureCounts.values()].every((count) => count === 1);

  for (const icon of icons) {
    if (!icon.textureKey) continue;
    const exported = await exportTexture(page, icon.textureKey);
    if (!exported) continue;
    const fileName = `${icon.id}-runtime.png`;
    writeFileSync(join(OUTPUT_DIR, fileName), Buffer.from(exported.base64, "base64"));
    report.exportedTextures.push({ id: icon.id, textureKey: icon.textureKey, fileName, width: exported.width, height: exported.height });
  }
  report.assertions.runtimeTexturesExported = report.exportedTextures.length === ORDER_ICON_IDS.length;
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;

  await page.screenshot({ path: join(OUTPUT_DIR, "level-5-order-overlap.png"), fullPage: true });

  const failed = Object.entries(report.assertions).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`L5 order overlap diagnostic failed: ${failed.join(", ")}`);

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

console.log(JSON.stringify({ assertions: report.assertions, imageOverlaps: report.imageOverlaps, exportedTextures: report.exportedTextures, fatalError: report.fatalError }, null, 2));
if (thrown) throw thrown;

async function exportTexture(page, textureKey) {
  return page.evaluate(({ sceneKey, textureKey }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.textures?.exists?.(textureKey)) return null;
    const source = scene.textures.get(textureKey).getSourceImage();
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
    return { width, height, base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  }, { sceneKey: SCENE_KEY, textureKey });
}

function overlapRatio(a, b) {
  if (!a || !b) return 0;
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? intersection / smaller : 0;
}

function mimeType(path) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" })[extname(path).toLowerCase()] ?? "application/octet-stream";
}
