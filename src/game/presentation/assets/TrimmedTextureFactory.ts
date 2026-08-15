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

export type TextureMaskRun = readonly [
  row: number,
  startX: number,
  endXExclusive: number
];

const sourceDimensions = (source: CanvasImageSourceLike): SourceDimensions => ({
  width: source instanceof HTMLImageElement ? source.naturalWidth : source.width,
  height: source instanceof HTMLImageElement ? source.naturalHeight : source.height
});

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
 * Removes only light neutral pixels connected to the canvas edge. This clears
 * white/checkerboard matte and anti-aliased fringe without deleting enclosed
 * white details such as labels or other interior art.
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
  removeConnectedLightNeutralBackground(image, dimensions.width, dimensions.height);
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

const createTrimmedTextureFromCanvas = (
  scene: Phaser.Scene,
  sourceKey: string,
  aliasKey: string,
  source: HTMLCanvasElement,
  padding: number,
  trimBottomRatio: number
): string => {
  const sourceSize = sourceDimensions(source);
  const opaque = resolveOpaqueBounds(source);
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
  context.drawImage(source, left, top, width, height, 0, 0, width, height);
  texture.refresh();

  return aliasKey;
};

/**
 * Creates a transparent texture containing only the source object's visible
 * pixels. Connected light-neutral edge cleanup is enabled by default so the
 * same export-matte rule is applied to restock props and actors in L1-L2.
 * trimBottomRatio is used for composite source art where an unwanted pallet is
 * below the object.
 */
export function prepareTrimmedTexture(
  scene: Phaser.Scene,
  sourceKey: string | undefined,
  aliasKey: string,
  padding = 8,
  removeLightNeutralBackground = true,
  trimBottomRatio = 0
): string {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return sourceKey ?? aliasKey;
  if (scene.textures.exists(aliasKey)) return aliasKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSourceLike;
  const cleanedSource = createSourceCanvas(source, removeLightNeutralBackground);
  return createTrimmedTextureFromCanvas(
    scene,
    sourceKey,
    aliasKey,
    cleanedSource,
    padding,
    trimBottomRatio
  );
}

/**
 * Applies an approved row-run mask before trimming. This is used for production
 * source art that contains an unwanted baked fixture behind a reusable actor.
 * Edge-matte cleanup happens before the mask so white fringe cannot survive the
 * mask path.
 */
export function prepareMaskedTrimmedTexture(
  scene: Phaser.Scene,
  sourceKey: string | undefined,
  aliasKey: string,
  maskRuns: readonly TextureMaskRun[],
  padding = 8
): string {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return sourceKey ?? aliasKey;
  if (scene.textures.exists(aliasKey)) return aliasKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSourceLike;
  const maskedSource = createSourceCanvas(source, true);
  const dimensions = sourceDimensions(maskedSource);
  const context = maskedSource.getContext("2d");
  if (!context) return sourceKey;

  const mask = document.createElement("canvas");
  mask.width = dimensions.width;
  mask.height = dimensions.height;
  const maskContext = mask.getContext("2d");
  if (!maskContext) return sourceKey;

  maskContext.clearRect(0, 0, dimensions.width, dimensions.height);
  maskContext.fillStyle = "#ffffff";
  for (const [row, startX, endXExclusive] of maskRuns) {
    if (row < 0 || row >= dimensions.height) continue;
    const left = Phaser.Math.Clamp(startX, 0, dimensions.width);
    const right = Phaser.Math.Clamp(endXExclusive, left, dimensions.width);
    if (right > left) maskContext.fillRect(left, row, right - left, 1);
  }

  context.globalCompositeOperation = "destination-in";
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "source-over";

  return createTrimmedTextureFromCanvas(
    scene,
    sourceKey,
    aliasKey,
    maskedSource,
    padding,
    0
  );
}

/**
 * Creates a same-canvas lower foreground layer from an already-clean texture.
 * Placing this above a case lets the cart's platform edge and wheels occlude it
 * correctly instead of making the case look embedded in the cart.
 */
export function prepareLowerOverlayTexture(
  scene: Phaser.Scene,
  sourceKey: string | undefined,
  aliasKey: string,
  startRatio = 0.57
): string {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return sourceKey ?? aliasKey;
  if (scene.textures.exists(aliasKey)) return aliasKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSourceLike;
  const dimensions = sourceDimensions(source);
  const startY = Phaser.Math.Clamp(
    Math.round(dimensions.height * startRatio),
    0,
    Math.max(0, dimensions.height - 1)
  );
  const retainedHeight = Math.max(1, dimensions.height - startY);
  const texture = scene.textures.createCanvas(aliasKey, dimensions.width, dimensions.height);
  if (!texture) return sourceKey;

  const context = texture.getContext();
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(
    source,
    0,
    startY,
    dimensions.width,
    retainedHeight,
    0,
    startY,
    dimensions.width,
    retainedHeight
  );
  texture.refresh();
  return aliasKey;
}
