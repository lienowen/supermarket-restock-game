import Phaser from "phaser";

interface TextureBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ProjectionBand {
  readonly start: number;
  readonly end: number;
  readonly score: number;
}

const ALPHA_THRESHOLD = 18;
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
    const bounds = dominantOpaqueSubjectBounds(pixels, width, height);
    boundsByTextureKey.set(textureKey, bounds);
    return bounds;
  } catch (error) {
    console.warn(`Unable to crop commercial product texture ${textureKey}.`, error);
    boundsByTextureKey.set(textureKey, null);
    return null;
  }
}

function dominantOpaqueSubjectBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): TextureBounds | null {
  const rowCounts = new Uint32Array(height);
  let opaquePixels = 0;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (pixels[(rowOffset + x) * 4 + 3] > ALPHA_THRESHOLD) count += 1;
    }
    rowCounts[y] = count;
    opaquePixels += count;
  }

  if (opaquePixels < 24) return null;
  const maximumRowCount = maximumValue(rowCounts);
  const rowActivityThreshold = Math.max(2, Math.floor(maximumRowCount * 0.025));
  const rowBand = strongestBand(rowCounts, rowActivityThreshold);
  if (!rowBand) return null;

  const columnCounts = new Uint32Array(width);
  for (let y = rowBand.start; y <= rowBand.end; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      if (pixels[(rowOffset + x) * 4 + 3] > ALPHA_THRESHOLD) columnCounts[x] += 1;
    }
  }

  const maximumColumnCount = maximumValue(columnCounts);
  const columnActivityThreshold = Math.max(2, Math.floor(maximumColumnCount * 0.025));
  const columnBand = strongestBand(columnCounts, columnActivityThreshold);
  if (!columnBand) return null;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = rowBand.start; y <= rowBand.end; y += 1) {
    const rowOffset = y * width;
    for (let x = columnBand.start; x <= columnBand.end; x += 1) {
      if (pixels[(rowOffset + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) return null;
  const rawWidth = right - left + 1;
  const rawHeight = bottom - top + 1;
  const paddingX = Math.max(2, Math.round(rawWidth * 0.06));
  const paddingY = Math.max(2, Math.round(rawHeight * 0.06));
  const x = Math.max(0, left - paddingX);
  const y = Math.max(0, top - paddingY);
  const paddedRight = Math.min(width - 1, right + paddingX);
  const paddedBottom = Math.min(height - 1, bottom + paddingY);

  return Object.freeze({
    x,
    y,
    width: paddedRight - x + 1,
    height: paddedBottom - y + 1
  });
}

function strongestBand(
  counts: Uint32Array,
  activityThreshold: number
): ProjectionBand | undefined {
  let best: ProjectionBand | undefined;
  let start = -1;
  let score = 0;

  for (let index = 0; index <= counts.length; index += 1) {
    const count = index < counts.length ? counts[index] ?? 0 : 0;
    if (count >= activityThreshold) {
      if (start < 0) start = index;
      score += count;
      continue;
    }

    if (start < 0) continue;
    const candidate: ProjectionBand = {
      start,
      end: index - 1,
      score
    };
    if (!best || candidate.score > best.score) best = candidate;
    start = -1;
    score = 0;
  }

  return best;
}

function maximumValue(values: Uint32Array): number {
  let maximum = 0;
  for (const value of values) {
    if (value > maximum) maximum = value;
  }
  return maximum;
}
