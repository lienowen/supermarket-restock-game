import Phaser from "phaser";

interface TextureBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const ALPHA_THRESHOLD = 18;
const MIN_COMPONENT_PIXELS = 24;
const boundsByTextureKey = new Map<string, TextureBounds | null>();

export function tightenCommercialProductImage(image: Phaser.GameObjects.Image): boolean {
  if (image.getData("commercialCropApplied") === true) return true;
  const productId = image.getData("productId");
  if (typeof productId !== "string" || !productId.trim()) return false;

  const sourceTextureKey = String(image.texture.key);
  const source = image.texture.getSourceImage(image.frame.sourceIndex) as CanvasImageSource;
  const sourceWidth = Number((source as CanvasImageSource & { width?: number }).width ?? 0);
  const sourceHeight = Number((source as CanvasImageSource & { height?: number }).height ?? 0);
  const bounds = resolveTextureBounds(source, sourceTextureKey, sourceWidth, sourceHeight);
  image.setData("commercialCropApplied", true);
  if (!bounds) return false;

  const tightTextureKey = tightTextureName(sourceTextureKey, bounds);
  if (!image.scene.textures.exists(tightTextureKey)) {
    const tightCanvas = createTightCanvas(source, bounds);
    if (!tightCanvas || !image.scene.textures.addCanvas(tightTextureKey, tightCanvas)) return false;
  }

  const target = targetDisplaySize(image);
  image.setTexture(tightTextureKey);
  image.setOrigin(0.5, 0.5);
  image.setScale(Math.min(
    target.width / Math.max(1, bounds.width),
    target.height / Math.max(1, bounds.height)
  ));
  image.y += target.verticalOffset;
  image.setData("commercialCropBounds", bounds);
  image.setData("commercialTightTexture", tightTextureKey);
  return true;
}

function targetDisplaySize(image: Phaser.GameObjects.Image): {
  readonly width: number;
  readonly height: number;
  readonly verticalOffset: number;
} {
  const parent = image.parentContainer;
  const bayWidth = Math.max(1, parent?.width ?? 0);
  const bayHeight = Math.max(1, parent?.height ?? 0);
  const slotWidth = bayWidth > 1 ? (bayWidth - 46) / 3 : image.displayWidth;
  const slotHeight = bayHeight > 1 ? Math.max(54, bayHeight - 60) : image.displayHeight;

  return Object.freeze({
    width: Math.max(1, slotWidth * 0.82),
    height: Math.max(1, slotHeight * 0.78),
    verticalOffset: Math.max(0, slotHeight * 0.06)
  });
}

function resolveTextureBounds(
  source: CanvasImageSource,
  textureKey: string,
  width: number,
  height: number
): TextureBounds | null {
  if (boundsByTextureKey.has(textureKey)) return boundsByTextureKey.get(textureKey) ?? null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    boundsByTextureKey.set(textureKey, null);
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      boundsByTextureKey.set(textureKey, null);
      return null;
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const bounds = largestOpaqueComponentBounds(pixels, width, height);
    boundsByTextureKey.set(textureKey, bounds);
    return bounds;
  } catch (error) {
    console.warn(`Unable to inspect commercial product texture ${textureKey}.`, error);
    boundsByTextureKey.set(textureKey, null);
    return null;
  }
}

function createTightCanvas(
  source: CanvasImageSource,
  bounds: TextureBounds
): HTMLCanvasElement | undefined {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    return canvas;
  } catch {
    return undefined;
  }
}

function tightTextureName(sourceTextureKey: string, bounds: TextureBounds): string {
  return [
    sourceTextureKey,
    "commercial-tight",
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height
  ].join("-");
}

function largestOpaqueComponentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): TextureBounds | null {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  let bestCount = 0;
  let bestLeft = 0;
  let bestTop = 0;
  let bestRight = 0;
  let bestBottom = 0;

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] === 1 || pixels[start * 4 + 3] <= ALPHA_THRESHOLD) continue;

    let stackSize = 1;
    stack[0] = start;
    visited[start] = 1;
    let componentCount = 0;
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;

    while (stackSize > 0) {
      const index = stack[--stackSize];
      if (index === undefined) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      componentCount += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;

      visit(index - 1, x > 0);
      visit(index + 1, x + 1 < width);
      visit(index - width, y > 0);
      visit(index + width, y + 1 < height);
      visit(index - width - 1, x > 0 && y > 0);
      visit(index - width + 1, x + 1 < width && y > 0);
      visit(index + width - 1, x > 0 && y + 1 < height);
      visit(index + width + 1, x + 1 < width && y + 1 < height);
    }

    if (componentCount > bestCount) {
      bestCount = componentCount;
      bestLeft = left;
      bestTop = top;
      bestRight = right;
      bestBottom = bottom;
    }

    function visit(index: number, inBounds: boolean): void {
      if (!inBounds || visited[index] === 1 || pixels[index * 4 + 3] <= ALPHA_THRESHOLD) return;
      visited[index] = 1;
      stack[stackSize] = index;
      stackSize += 1;
    }
  }

  if (bestCount < MIN_COMPONENT_PIXELS) return null;
  const rawWidth = bestRight - bestLeft + 1;
  const rawHeight = bestBottom - bestTop + 1;
  const paddingX = Math.max(2, Math.round(rawWidth * 0.04));
  const paddingY = Math.max(2, Math.round(rawHeight * 0.04));
  const x = Math.max(0, bestLeft - paddingX);
  const y = Math.max(0, bestTop - paddingY);
  const paddedRight = Math.min(width - 1, bestRight + paddingX);
  const paddedBottom = Math.min(height - 1, bestBottom + paddingY);

  return Object.freeze({
    x,
    y,
    width: paddedRight - x + 1,
    height: paddedBottom - y + 1
  });
}
