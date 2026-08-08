import Phaser from "phaser";

const DEFAULT_ALPHA_THRESHOLD = 18;

/**
 * Some early production character renders contain semi-transparent body pixels,
 * which makes the worker look ghosted against a bright supermarket floor.
 * For the mature pass we normalize every visible character pixel to full alpha
 * while keeping genuinely transparent canvas pixels transparent.
 */
export function createOpaqueCutoutTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD
): string {
  const derivedKey = `${sourceKey}--opaque-cutout`;
  if (scene.textures.exists(derivedKey)) return derivedKey;
  if (!scene.textures.exists(sourceKey)) return sourceKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;
  if (!width || !height) return sourceKey;

  const texture = scene.textures.createCanvas(derivedKey, width, height);
  if (!texture) return sourceKey;

  const context = texture.context;
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset] ?? 0;
    pixels[offset] = alpha < alphaThreshold ? 0 : 255;
  }
  context.putImageData(imageData, 0, 0);
  texture.refresh();

  return derivedKey;
}
