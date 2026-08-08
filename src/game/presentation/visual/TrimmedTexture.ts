import Phaser from "phaser";

export interface TrimmedTextureOptions {
  readonly alphaThreshold?: number;
  readonly opaque?: boolean;
  readonly suffix?: string;
  readonly padding?: number;
}

const DEFAULT_ALPHA_THRESHOLD = 10;

/**
 * Production art in the current repository often lives on a much larger
 * transparent canvas than the visible prop. Scaling that canvas directly is
 * why products, baskets and fixtures look tiny or appear to float.
 *
 * This helper derives a browser-local texture cropped to the real alpha bounds.
 * It never modifies the source asset on disk, so it is safe for the mature-pass
 * visual prototype and can later be replaced by a proper export pipeline.
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
  const texture = scene.textures.createCanvas(derivedKey, croppedWidth, croppedHeight);
  if (!texture) return sourceKey;

  const context = texture.context;
  context.clearRect(0, 0, croppedWidth, croppedHeight);
  context.drawImage(
    source,
    minX,
    minY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight
  );

  if (options.opaque) {
    const croppedData = context.getImageData(0, 0, croppedWidth, croppedHeight);
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
  const scale = Math.min(maxWidth / width, maxHeight / height);
  image.setDisplaySize(width * scale, height * scale);
}
