import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const spec = JSON.parse(fs.readFileSync(path.join(root, "asset-spec.json"), "utf8"));
const rawDir = path.join(root, spec.rawDir);
const gameDir = path.join(root, spec.gameDir);
const genDir = path.join(root, "src", "generated");

function pixelIdx(width, x, y) {
  return (y * width + x) * 4;
}

function isKeyedBackground(data, idx, key) {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  const a = data[idx + 3];
  if (a <= key.alphaMin) return true;
  return r >= key.whiteMin && g >= key.whiteMin && b >= key.whiteMin;
}

function stripEdgeWhite(png, key = { whiteMin: 240, alphaMin: 20 }) {
  const { width, height, data } = png;
  const bg = new Uint8Array(width * height);
  const queue = [];

  function trySeed(x, y) {
    const p = y * width + x;
    const idx = pixelIdx(width, x, y);
    if (!isKeyedBackground(data, idx, key) || bg[p]) return;
    bg[p] = 1;
    queue.push(p);
  }

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const np = ny * width + nx;
      if (bg[np]) continue;
      const idx = pixelIdx(width, nx, ny);
      if (!isKeyedBackground(data, idx, key)) continue;
      bg[np] = 1;
      queue.push(np);
    }
  }

  for (let p = 0; p < bg.length; p++) {
    if (bg[p]) data[p * 4 + 3] = 0;
  }
}

function alphaBounds(data, width, height, key = { alphaMin: 20 }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = pixelIdx(width, x, y);
      if (data[idx + 3] > key.alphaMin) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function findRaw(candidates) {
  const files = fs.readdirSync(rawDir);
  for (const name of candidates) {
    const exact = files.find((f) => f.toLowerCase() === name.toLowerCase());
    if (exact) return path.join(rawDir, exact);
    const partial = files.find((f) => f.includes(name));
    if (partial) return path.join(rawDir, partial);
  }
  throw new Error(`Missing raw file in ${spec.rawDir}: ${candidates.join(" | ")}`);
}

function computeShelfCells(cols, rows, grid) {
  const { outerL, outerT, outerR, outerB, gapX, gapY } = grid;
  const cellW = (1 - outerL - outerR - gapX * (cols - 1)) / cols;
  const cellH = (1 - outerT - outerB - gapY * (rows - 1)) / rows;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const rowCells = [];
    for (let col = 0; col < cols; col++) {
      rowCells.push({
        nx: +(outerL + col * (cellW + gapX)).toFixed(4),
        ny: +(outerT + row * (cellH + gapY)).toFixed(4),
        nw: +cellW.toFixed(4),
        nh: +cellH.toFixed(4),
      });
    }
    cells.push(rowCells);
  }
  return cells;
}

function cropRegion(png, bounds, pad = 0) {
  const sx = Math.max(0, bounds.minX - pad);
  const sy = Math.max(0, bounds.minY - pad);
  const ex = Math.min(png.width - 1, bounds.maxX + pad);
  const ey = Math.min(png.height - 1, bounds.maxY + pad);
  const w = ex - sx + 1;
  const h = ey - sy + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((sy + y) * png.width + (sx + x)) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}

function blit(dest, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dest.width || ty >= dest.height) continue;
      const si = (y * src.width + x) * 4;
      const di = (ty * dest.width + tx) * 4;
      const a = src.data[si + 3] / 255;
      if (a <= 0) continue;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = Math.round(a * 255);
    }
  }
}

function normalizeItem(srcPath, destPath) {
  const { width, height, padding, backgroundKey } = spec.item;
  const src = readPng(srcPath);
  stripEdgeWhite(src, backgroundKey);
  const bounds = alphaBounds(src.data, src.width, src.height, backgroundKey);
  if (!bounds) throw new Error(`No visible pixels: ${srcPath}`);
  const cropped = cropRegion(src, bounds, padding);

  const scale = Math.min((width - padding * 2) / cropped.width, (height - padding * 2) / cropped.height);
  const dw = Math.max(1, Math.round(cropped.width * scale));
  const dh = Math.max(1, Math.round(cropped.height * scale));

  const scaled = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(cropped.width - 1, Math.floor((x / dw) * cropped.width));
      const sy = Math.min(cropped.height - 1, Math.floor((y / dh) * cropped.height));
      const si = (sy * cropped.width + sx) * 4;
      const di = (y * dw + x) * 4;
      scaled.data[di] = cropped.data[si];
      scaled.data[di + 1] = cropped.data[si + 1];
      scaled.data[di + 2] = cropped.data[si + 2];
      scaled.data[di + 3] = cropped.data[si + 3];
    }
  }

  const out = new PNG({ width, height });
  const dx = Math.round((width - dw) / 2);
  const dy = height - padding - dh;
  blit(out, scaled, dx, dy);
  writePng(destPath, out);
}

function prepareShelf(shelf) {
  const fileName = spec.shelf.naming.replace("{cols}", shelf.cols).replace("{rows}", shelf.rows);
  const legacy = spec.legacyRawMatch?.[`shelf-${shelf.id}`];
  const src = findRaw([fileName, legacy].filter(Boolean));
  const dest = path.join(gameDir, fileName);
  fs.copyFileSync(src, dest);
  return {
    id: shelf.id,
    src: `/game/${fileName}`,
    cols: shelf.cols,
    rows: shelf.rows,
    cells: computeShelfCells(shelf.cols, shelf.rows, spec.shelf.grid),
  };
}

function prepareItem(id) {
  const fileName = spec.item.naming.replace("{id}", id);
  const legacy = spec.legacyRawMatch?.[`item-${id}`];
  const src = findRaw([fileName, legacy].filter(Boolean));
  const dest = path.join(gameDir, fileName);
  normalizeItem(src, dest);
  return { id, src: `/game/${fileName}` };
}

function normalizeUi(srcPath, destPath, uiSpec) {
  const { width, maxHeight } = uiSpec;
  const src = readPng(srcPath);
  const scale = Math.min(width / src.width, maxHeight / src.height);
  const dw = Math.max(1, Math.round(src.width * scale));
  const dh = Math.max(1, Math.round(src.height * scale));
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / dw) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / dh) * src.height));
      const si = (sy * src.width + sx) * 4;
      const di = (y * dw + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  writePng(destPath, out);
}

function prepareUi(id, uiSpec) {
  const fileName = uiSpec.naming;
  const legacy = spec.legacyRawMatch?.[`ui-${id}`];
  const src = findRaw([fileName, legacy].filter(Boolean));
  const dest = path.join(gameDir, fileName);
  normalizeUi(src, dest, uiSpec);
  return { id, src: `/game/${fileName}`, width: uiSpec.width, maxHeight: uiSpec.maxHeight };
}

fs.mkdirSync(gameDir, { recursive: true });
fs.mkdirSync(genDir, { recursive: true });
for (const old of fs.readdirSync(gameDir)) fs.unlinkSync(path.join(gameDir, old));

const shelves = spec.shelves.map(prepareShelf);
const items = Object.fromEntries(spec.items.map((id) => [id, prepareItem(id).src]));

const shelfCells = Object.fromEntries(shelves.map((s) => [s.id, s.cells]));
const shelfSkins = Object.fromEntries(shelves.map((s) => [s.id, s.src]));

const ui = spec.ui
  ? Object.fromEntries(
      Object.entries(spec.ui).map(([id, uiSpec]) => {
        const prepared = prepareUi(id, uiSpec);
        return [id, prepared.src];
      }),
    )
  : {};

const manifest = {
  version: spec.version,
  itemCanvas: { width: spec.item.width, height: spec.item.height },
  shelfGrid: spec.shelf.grid,
  items,
  shelves: shelfSkins,
  shelfCells,
  ui,
};

fs.writeFileSync(path.join(gameDir, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(genDir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Standard v${spec.version}: ${spec.items.length} items -> ${spec.item.width}x${spec.item.height}px`);
console.log(`${shelves.length} shelves, grid from asset-spec.json (no manual coords)`);
if (Object.keys(ui).length) console.log(`UI: ${Object.keys(ui).join(", ")}`);
console.log("Output: public/game/ + src/generated/manifest.json");
console.log("Done. Run: npm run dev");
