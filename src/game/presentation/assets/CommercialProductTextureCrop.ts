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

  const textureKey = String(image.texture.key);
  const bounds = resolveTextureBounds(image, textureKey);
  image.setData("commercialCropApplied", true);
  if (!bounds) return false;

  const frameWidth = Math.max(1, image.frame.realWidth || image.frame.width);
  const frameHeight = Math.max(1, image.frame.realHeight || image.frame.height);
  const targetWidth = Math.max(1, image.displayWidth);
  const targetHeight = Math.max(1, image.displayHeight);
  const cropCenterX = bounds.x + bounds.width / 2;
  const cropCenterY = bounds.y + bounds.height / 2;

  image.setCrop(bounds.x, bounds.y, bounds.width, bounds.height);
  image.setOrigin(cropCenterX / frameWidth, cropCenterY / frameHeight);

  const scale = Math.min(
    targetWidth / bounds.width,
    targetHeight / bounds.height
  ) * 0.92;
  image.setScale(scale);
  image.setData("commercialCropBounds", bounds);
  return true;
}

function resolveTextureBounds(
  image: Phaser.GameObjects.Image,
  textureKey: string
): TextureBounds | null {
  if (boundsByTextureKey.has(textureKey)) return boundsByTextureKey.get(textureKey) ?? null;

  const source = image.texture.getSourceImage(image.frame.sourceIndex);
  const width = Number((source as CanvasImageSource & { width?: number }).width ?? 0);
  const height = Number((source as CanvasImageSource & { height?: number }).height ?? 0);
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
    context.drawImage(source as CanvasImageSource, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const bounds = largestOpaqueComponentBounds(pixels, width, height);
    boundsByTextureKey.set(textureKey, bounds);
    return bounds;
  } catch (error) {
    console.warn(`Unable to crop commercial product texture ${textureKey}.`, error);
    boundsByTextureKey.set(textureKey, null);
    return null;
  }
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

      visitOpaque(index - 1, x > 0);
      visitOpaque(index + 1, x + 1 < width);
      visitOpaque(index - width, y > 0);
      visitOpaque(index + width, y + 1 < height);
      visitOpaque(index - width - 1, x > 0 && y > 0);
      visitOpaque(index - width + 1, x + 1 < width && y > 0);
      visitOpaque(index + width - 1, x > 0 && y + 1 < height);
      visitOpaque(index + width + 1, x + 1 < width && y + 1 < height);
    }

    if (componentCount > bestCount) {
      bestCount = componentCount;
      bestLeft = left;
      bestTop = top;
      bestRight = right;
      bestBottom = bottom;
    }

    function visitOpaque(index: number, inBounds: boolean): void {
      if (!inBounds || visited[index] === 1 || pixels[index * 4 + 3] <= ALPHA_THRESHOLD) return;
      visited[index] = 1;
      stack[stackSize] = index;
      stackSize += 1;
    }
  }

  if (bestCount < MIN_COMPONENT_PIXELS) return null;
  const rawWidth = bestRight - bestLeft + 1;
  const rawHeight = bestBottom - bestTop + 1;
  const paddingX = Math.max(2, Math.round(rawWidth * 0.06));
  const paddingY = Math.max(2, Math.round(rawHeight * 0.06));
  const x = Math.max(0, bestLeft - paddingX);
  const y = Math.max(0, bestTop - paddingY);
  const right = Math.min(width - 1, bestRight + paddingX);
  const bottom = Math.min(height - 1, bestBottom + paddingY);

  return Object.freeze({
    x,
    y,
    width: right - x + 1,
    height: bottom - y + 1
  });
}
