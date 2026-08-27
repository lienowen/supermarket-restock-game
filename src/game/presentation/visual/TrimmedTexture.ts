import Phaser from "phaser";

export interface TrimmedTextureOptions {
  readonly alphaThreshold?: number;
  readonly opaque?: boolean;
  readonly suffix?: string;
  readonly padding?: number;
  /**
   * Clears light neutral pixels connected to the source canvas edge before
   * trimming. Enabled by default for gameplay sprites so exported white/grey
   * matte and anti-aliased halos do not become visible in L1-L5.
   */
  readonly removeLightNeutralBackground?: boolean;
}

const DEFAULT_ALPHA_THRESHOLD = 10;
// L5 products live inside authored produce, grocery and dairy zones. Scaling
// them above their measured boxes made them look like floating promotional
// stickers instead of products placed on shelves.
const GOLDEN_REQUESTED_ITEM_SCALE = 0.9;
const GOLDEN_DECOY_ITEM_SCALE = 0.82;

const fitSize = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { readonly width: number; readonly height: number } => {
  const scale = Math.min(maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
};

const normalizedTextureSize = (
  sourceKey: string,
  suffix: string,
  width: number,
  height: number
): { readonly width: number; readonly height: number } => {
  if (suffix === "--checkout-product") return fitSize(width, height, 44, 64);
  if (suffix === "--checkout-trimmed" && sourceKey === "equipment-shopping-basket") {
    return fitSize(width, height, 88, 62);
  }
  return { width, height };
};

const pixelOffset = (pixelIndex: number): number => pixelIndex * 4;

const isLightNeutralPixel = (
  pixels: Uint8ClampedArray,
  pixelIndex: number
): boolean => {
  const offset = pixelOffset(pixelIndex);
  const red = pixels[offset] ?? 0;
  const green = pixels[offset + 1] ?? 0;
  const blue = pixels[offset + 2] ?? 0;
  const alpha = pixels[offset + 3] ?? 0;
  if (alpha <= 8) return true;

  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const average = (red + green + blue) / 3;
  return maximum - minimum <= 42 && average >= 168;
};

/**
 * Removes only light neutral pixels connected to the outside of the source
 * canvas. Interior whites remain untouched, so labels and product details are
 * preserved while export mattes / white halos disappear.
 */
const removeConnectedLightNeutralBackground = (
  image: ImageData,
  width: number,
  height: number
): void => {
  const pixels = image.data;
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex] === 1 || !isLightNeutralPixel(pixels, pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head] ?? 0;
    head += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (visited[pixelIndex] !== 1) continue;
    pixels[pixelOffset(pixelIndex) + 3] = 0;
  }
};

/**
 * Production art in the current repository often lives on a much larger
 * transparent canvas than the visible prop. Scaling that canvas directly is
 * why products, baskets and fixtures look tiny or appear to float.
 *
 * This helper derives a browser-local texture cropped to the real alpha bounds.
 * Before cropping it also removes a connected light neutral export matte by
 * default. It never modifies the source asset on disk.
 */
export function createTrimmedTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  options: TrimmedTextureOptions = {}
): string {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const suffix = options.suffix ?? "--trimmed";
  const derivedKey = `${sourceKey}${suffix}`;
  if (scene.textures.exists(derivedKey)) return derivedKey;
  if (!scene.textures.exists(sourceKey)) return sourceKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;
  if (!width || !height) return sourceKey;

  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  if (!scratchContext) return sourceKey;
  scratchContext.clearRect(0, 0, width, height);
  scratchContext.drawImage(source, 0, 0, width, height);

  const sourceData = scratchContext.getImageData(0, 0, width, height);
  if (options.removeLightNeutralBackground !== false) {
    removeConnectedLightNeutralBackground(sourceData, width, height);
    scratchContext.putImageData(sourceData, 0, 0);
  }

  const pixels = sourceData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < alphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return sourceKey;

  const padding = Math.max(0, Math.floor(options.padding ?? 0));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;
  const outputSize = normalizedTextureSize(sourceKey, suffix, croppedWidth, croppedHeight);
  const texture = scene.textures.createCanvas(derivedKey, outputSize.width, outputSize.height);
  if (!texture) return sourceKey;

  const context = texture.context;
  context.clearRect(0, 0, outputSize.width, outputSize.height);
  // Draw from the cleaned scratch canvas, not the original source. Drawing the
  // source again here would re-introduce the matte that was just removed.
  context.drawImage(
    scratch,
    minX,
    minY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    outputSize.width,
    outputSize.height
  );

  if (options.opaque) {
    const croppedData = context.getImageData(0, 0, outputSize.width, outputSize.height);
    const croppedPixels = croppedData.data;
    for (let offset = 3; offset < croppedPixels.length; offset += 4) {
      const alpha = croppedPixels[offset] ?? 0;
      croppedPixels[offset] = alpha < alphaThreshold ? 0 : 255;
    }
    context.putImageData(croppedData, 0, 0);
  }

  texture.refresh();
  return derivedKey;
}

export function fitImageIntoBox(
  image: Phaser.GameObjects.Image,
  maxWidth: number,
  maxHeight: number
): void {
  const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source.width || 1;
  const height = source.height || 1;
  const baseScale = Math.min(maxWidth / width, maxHeight / height);
  const goldenZone = image.getData("golden-zone");
  const goldenRequested = image.getData("requested");
  const visibilityScale = goldenZone
    ? (goldenRequested ? GOLDEN_REQUESTED_ITEM_SCALE : GOLDEN_DECOY_ITEM_SCALE)
    : 1;
  const scale = baseScale * visibilityScale;
  image.setDisplaySize(width * scale, height * scale);
}
