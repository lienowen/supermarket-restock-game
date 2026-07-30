import Phaser from "phaser";

type CanvasImageSourceLike = HTMLImageElement | HTMLCanvasElement;

interface SourceDimensions {
  readonly width: number;
  readonly height: number;
}

interface OpaqueBounds extends SourceDimensions {
  readonly x: number;
  readonly y: number;
}

const sourceDimensions = (source: CanvasImageSourceLike): SourceDimensions => ({
  width: source instanceof HTMLImageElement ? source.naturalWidth : source.width,
  height: source instanceof HTMLImageElement ? source.naturalHeight : source.height
});

const createSourceCanvas = (
  source: CanvasImageSourceLike,
  removeLightNeutralBackground: boolean
): HTMLCanvasElement => {
  const dimensions = sourceDimensions(source);
  const scratch = document.createElement("canvas");
  scratch.width = dimensions.width;
  scratch.height = dimensions.height;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return scratch;

  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
  if (!removeLightNeutralBackground) return scratch;

  const image = context.getImageData(0, 0, dimensions.width, dimensions.height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const alpha = pixels[index + 3] ?? 0;
    if (alpha <= 8) continue;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const average = (red + green + blue) / 3;
    const neutral = max - min <= 30;
    const bright = average >= 176;
    if (neutral && bright) pixels[index + 3] = 0;
  }
  context.putImageData(image, 0, 0);
  return scratch;
};

const resolveOpaqueBounds = (source: HTMLCanvasElement): OpaqueBounds => {
  const dimensions = sourceDimensions(source);
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return { x: 0, y: 0, ...dimensions };

  const pixels = context.getImageData(0, 0, dimensions.width, dimensions.height).data;
  let left = dimensions.width;
  let top = dimensions.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const alpha = pixels[(y * dimensions.width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return { x: 0, y: 0, ...dimensions };
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1
  };
};

/**
 * Creates a transparent texture containing only the source object's visible
 * pixels. Optional cleanup removes a baked checkerboard. trimBottomRatio is
 * used for composite source art where an unwanted pallet is below the object.
 */
export function prepareTrimmedTexture(
  scene: Phaser.Scene,
  sourceKey: string | undefined,
  aliasKey: string,
  padding = 8,
  removeLightNeutralBackground = false,
  trimBottomRatio = 0
): string {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return sourceKey ?? aliasKey;
  if (scene.textures.exists(aliasKey)) return aliasKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSourceLike;
  const cleanedSource = createSourceCanvas(source, removeLightNeutralBackground);
  const sourceSize = sourceDimensions(cleanedSource);
  const opaque = resolveOpaqueBounds(cleanedSource);
  const safeBottomTrim = Phaser.Math.Clamp(trimBottomRatio, 0, 0.65);
  const retainedOpaqueHeight = Math.max(1, Math.round(opaque.height * (1 - safeBottomTrim)));
  const left = Math.max(0, opaque.x - padding);
  const top = Math.max(0, opaque.y - padding);
  const right = Math.min(sourceSize.width, opaque.x + opaque.width + padding);
  const bottom = Math.min(sourceSize.height, opaque.y + retainedOpaqueHeight + padding);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const texture = scene.textures.createCanvas(aliasKey, width, height);
  if (!texture) return sourceKey;
  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.drawImage(cleanedSource, left, top, width, height, 0, 0, width, height);
  texture.refresh();

  return aliasKey;
}
