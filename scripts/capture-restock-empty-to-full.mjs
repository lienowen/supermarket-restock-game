import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const DIST_DIR = resolve("dist");
const OUTPUT_DIR = resolve("restock-visual-audit");
const PORT = 4182;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CANVAS_SELECTOR = "#app > canvas:not(#mobile-game-backdrop)";
const SCENE_KEY = "starter-market-shift";
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

if (!existsSync(join(DIST_DIR, "index.html"))) throw new Error("dist/index.html is missing. Run npm run build first.");
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
  rowIndex: null,
  interactionsPerRow: null,
  unitsPerInteraction: null,
  physicalItemsPerRow: null,
  states: [],
  assertions: {
    setupUsesLiveHudAction: false,
    productionV3BackgroundActive: false,
    integratedCoolerActive: false,
    legacyEmptyShellRemoved: false,
    compactMatureHudActive: false,
    legacyShiftHudHidden: false,
    checklistHandedOff: false,
    emptyShelfHasZeroItems: false,
    shelfBuildsByConfiguredUnits: false,
    finalInteractionCompletesShelf: false,
    noRuntimeIssues: false
  },
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null
};

const browser = await chromium.launch({ headless: true });
let thrownError;

try {
  const context = await browser.newContext({ viewport: { width: GAME_WIDTH, height: GAME_HEIGHT }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.CrazyGames = { SDK: { init: async () => undefined, game: {
      settings: { muteAudio: false }, gameplayStart: () => undefined, gameplayStop: () => undefined,
      loadingStart: () => undefined, loadingStop: () => undefined, setGameContext: () => undefined,
      clearGameContext: () => undefined, reportGameCompletedPercentage: () => undefined,
      addSettingsChangeListener: () => undefined, removeSettingsChangeListener: () => undefined
    } } };
  });

  const page = await context.newPage();
  attachListeners(page, report);
  await page.goto(`${ORIGIN}/?test=1&briefing=0&guided=0&level=starter-level-001`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(CANVAS_SELECTOR, { state: "visible", timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.activeLevel === "starter-level-001", null, { timeout: 30000 });

  await waitForHudAction(page);
  await clickHudAction(page);
  await waitForSnapshot(page, { step: "load", boxCollected: true }, 25000);
  await waitForInteractionReady(page);
  await waitForHudAction(page);
  await clickHudAction(page);
  await waitForSnapshot(page, { step: "restock", boxLoaded: true, boxOpened: true }, 30000);
  await waitForInteractionReady(page);
  await page.waitForFunction(() => document.body.dataset.matureRestockHud === "compact-v1", null, { timeout: 5000 });
  report.assertions.setupUsesLiveHudAction = true;

  const initial = await readVisualState(page);
  const rowIndex = initial.rush.activeRowIndex;
  if (!Number.isInteger(rowIndex)) throw new Error("Active restock row is missing");
  report.rowIndex = rowIndex;
  report.interactionsPerRow = initial.rush.itemsPerRow;
  report.unitsPerInteraction = initial.rush.unitsPerInteraction;
  report.physicalItemsPerRow = initial.rush.itemsPerRow * initial.rush.unitsPerInteraction;
  report.states.push(initial);

  report.assertions.productionV3BackgroundActive = initial.backgroundState === "production-v3-hd";
  report.assertions.integratedCoolerActive = initial.coolerView === "background-integrated" && initial.coolerForeground === "shelf-lips-only";
  report.assertions.legacyEmptyShellRemoved = initial.shell === null;
  report.assertions.compactMatureHudActive = initial.matureHudState === "compact-v1" && initial.matureHudVisible === true;
  report.assertions.legacyShiftHudHidden = initial.legacyHudVisibleCount === 0;
  report.assertions.checklistHandedOff = initial.checklistState === "handoff" && initial.checklistVisible === false;
  report.assertions.emptyShelfHasZeroItems = initial.itemCount === 0 && initial.rush.activeRowItemCount === 0 && initial.controller.stockedRows === 0;

  await page.screenshot({ path: join(OUTPUT_DIR, "level-1-mature-restock.png"), fullPage: true });
  await captureActiveRow(page, rowIndex, `restock-visual-0-of-${report.physicalItemsPerRow}.png`);
  const target = initial.target;
  if (!target) throw new Error("Active restock row target is missing");

  for (let interactionNumber = 1; interactionNumber <= report.interactionsPerRow; interactionNumber += 1) {
    await waitForInteractionReady(page);
    await clickGame(page, target.x, target.y);
    const expectedPhysicalItems = interactionNumber * report.unitsPerInteraction;
    await waitForRowState(page, rowIndex, interactionNumber, expectedPhysicalItems);
    if (interactionNumber === report.interactionsPerRow) await waitForSnapshot(page, { stockedRows: 1 }, 15000);
    const state = await readVisualState(page, rowIndex);
    report.states.push(state);
    await captureActiveRow(page, rowIndex, `restock-visual-${expectedPhysicalItems}-of-${report.physicalItemsPerRow}.png`);
  }

  await createContactSheet(context, report.states.map((state) => state.itemCount), report.physicalItemsPerRow);

  report.assertions.shelfBuildsByConfiguredUnits = report.states.every((state, index) => {
    const expectedPhysicalItems = index * report.unitsPerInteraction;
    return state.itemCount === expectedPhysicalItems && state.rush.rowItemCounts[rowIndex] === index;
  });
  const finalState = report.states.at(-1);
  report.assertions.finalInteractionCompletesShelf = Boolean(
    finalState?.itemCount === report.physicalItemsPerRow &&
    finalState?.controller.stockedRows === 1 &&
    finalState?.rush.filledRowIndexes.includes(rowIndex)
  );
  report.assertions.noRuntimeIssues = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.failedRequests.length === 0;

  const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`Restock visual audit failed: ${failed.join(", ")}`);

  await page.close();
  await context.close();
} catch (error) {
  thrownError = error;
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  writeFileSync(join(OUTPUT_DIR, "restock-visual-audit.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

console.log(JSON.stringify({ assertions: report.assertions, interactionsPerRow: report.interactionsPerRow, unitsPerInteraction: report.unitsPerInteraction, physicalItemsPerRow: report.physicalItemsPerRow, fatalError: report.fatalError }, null, 2));
if (thrownError) throw thrownError;

async function createContactSheet(context, counts, physicalItemsPerRow) {
  const evidencePage = await context.newPage();
  const panelWidth = 300;
  const panelHeight = 180;
  const width = panelWidth * counts.length;
  await evidencePage.setViewportSize({ width, height: panelHeight });
  const images = counts.map((count) => {
    const bytes = readFileSync(join(OUTPUT_DIR, `restock-visual-${count}-of-${physicalItemsPerRow}.png`));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  });
  await evidencePage.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:${width}px;height:${panelHeight}px;overflow:hidden;background:#101510}
    main{display:grid;grid-template-columns:repeat(${counts.length},${panelWidth}px);width:${width}px;height:${panelHeight}px}
    figure{position:relative;margin:0;width:${panelWidth}px;height:${panelHeight}px;overflow:hidden}
    img{display:block;width:${panelWidth}px;height:${panelHeight}px;object-fit:cover}
    figcaption{position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:999px;background:rgba(5,14,10,.9);color:#ffd95e;font:900 12px Arial,sans-serif}
  </style></head><body><main>${images.map((src, index) => `<figure><img src="${src}"><figcaption>${counts[index]}/${physicalItemsPerRow}</figcaption></figure>`).join("")}</main></body></html>`);
  await evidencePage.screenshot({ path: join(OUTPUT_DIR, "restock-contact-sheet.jpg"), type: "jpeg", quality: 78, fullPage: false });
  await evidencePage.close();
}

async function readVisualState(page, forcedRowIndex) {
  return page.evaluate(({ sceneKey, rowIndex }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now) ?? null;
    const activeRowIndex = Number.isInteger(rowIndex) ? rowIndex : rush?.activeRowIndex;
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${activeRowIndex}`);
    const target = scene?.children?.getByName?.(`beverage-cooler-row-target-${activeRowIndex}`);
    const shell = scene?.children?.getByName?.("beverage-cooler-empty-shell");
    const matureHud = scene?.children?.getByName?.("mature-restock-hud");
    const legacyHudVisibleCount = (scene?.children?.list ?? []).filter((entry) => {
      const depth = entry?.depth ?? -1;
      return depth >= 99 && depth <= 105 && entry?.visible === true;
    }).length;
    const checklist = document.getElementById("level-checklist");
    return {
      backgroundState: document.body.dataset.restockCoolerBackground ?? null,
      coolerView: document.body.dataset.restockCoolerView ?? null,
      coolerForeground: document.body.dataset.restockCoolerForeground ?? null,
      matureHudState: document.body.dataset.matureRestockHud ?? null,
      matureHudVisible: matureHud?.visible ?? false,
      legacyHudVisibleCount,
      checklistState: document.body.dataset.levelChecklist ?? null,
      checklistVisible: Boolean(checklist && checklist.style.visibility !== "hidden" && checklist.style.opacity !== "0"),
      controller: scene?.controller?.snapshot?.() ?? null,
      rush,
      itemCount: Array.isArray(holder?.list) ? holder.list.length : -1,
      target: target ? { x: target.x, y: target.y, width: target.width, height: target.height } : null,
      shell: shell ? { visible: shell.visible, alpha: shell.alpha, depth: shell.depth } : null
    };
  }, { sceneKey: SCENE_KEY, rowIndex: forcedRowIndex });
}

async function waitForRowState(page, rowIndex, expectedLogicalCount, expectedPhysicalCount) {
  await page.waitForFunction(({ sceneKey, rowIndex, expectedLogicalCount, expectedPhysicalCount }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const rush = scene?.rush?.snapshot?.(scene.time.now);
    const holder = scene?.children?.getByName?.(`beverage-cooler-row-${rowIndex}`);
    return rush?.rowItemCounts?.[rowIndex] === expectedLogicalCount && Array.isArray(holder?.list) && holder.list.length === expectedPhysicalCount;
  }, { sceneKey: SCENE_KEY, rowIndex, expectedLogicalCount, expectedPhysicalCount }, { timeout: 15000 });
}

async function waitForSnapshot(page, expected, timeout = 15000) {
  await page.waitForFunction(({ sceneKey, expected }) => {
    const scene = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey);
    const snapshot = scene?.controller?.snapshot?.();
    return Boolean(snapshot && Object.entries(expected).every(([key, value]) => snapshot[key] === value));
  }, { sceneKey: SCENE_KEY, expected }, { timeout });
}

async function waitForInteractionReady(page) {
  await page.waitForFunction((sceneKey) => window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.isInteractionReady?.() === true, SCENE_KEY, { timeout: 25000 });
}

async function waitForHudAction(page) {
  await page.waitForFunction((sceneKey) => {
    const action = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return Boolean(action?.visible && action?.input?.enabled);
  }, SCENE_KEY, { timeout: 15000 });
}

async function clickHudAction(page) {
  const action = await page.evaluate((sceneKey) => {
    const object = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.("shift-hud-action");
    return object ? { x: object.x, y: object.y } : null;
  }, SCENE_KEY);
  if (!action) throw new Error("Shift HUD action button is missing");
  await clickGame(page, action.x, action.y);
}

async function clickGame(page, gameX, gameY) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(box.x + (gameX / GAME_WIDTH) * box.width, box.y + (gameY / GAME_HEIGHT) * box.height);
}

async function captureActiveRow(page, rowIndex, filename) {
  const box = await page.locator(CANVAS_SELECTOR).boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  const row = await page.evaluate(({ sceneKey, rowIndex }) => {
    const target = window.__IMMERSIVE_GAME__?.scene?.getScene(sceneKey)?.children?.getByName?.(`beverage-cooler-row-target-${rowIndex}`);
    return target ? { x: target.x, y: target.y, width: target.width, height: target.height } : null;
  }, { sceneKey: SCENE_KEY, rowIndex });
  if (!row) throw new Error(`Row target ${rowIndex} is missing`);
  const marginX = 24;
  const marginY = 22;
  const left = row.x - row.width / 2 - marginX;
  const top = row.y - row.height / 2 - marginY;
  const width = row.width + marginX * 2;
  const height = row.height + marginY * 2;
  await page.screenshot({
    path: join(OUTPUT_DIR, filename),
    clip: {
      x: box.x + (left / GAME_WIDTH) * box.width,
      y: box.y + (top / GAME_HEIGHT) * box.height,
      width: (width / GAME_WIDTH) * box.width,
      height: (height / GAME_HEIGHT) * box.height
    }
  });
}

function attachListeners(page, auditReport) {
  page.on("console", (message) => { if (message.type() === "error") auditReport.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => auditReport.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown";
    if (!error.includes("ERR_ABORTED")) auditReport.failedRequests.push({ url: request.url(), error });
  });
}

function mimeType(filePath) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
