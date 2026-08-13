import Phaser from "phaser";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";

type CanvasImageSourceLike = HTMLImageElement | HTMLCanvasElement;

const sourceDimensions = (source: CanvasImageSourceLike): { width: number; height: number } => ({
  width: source instanceof HTMLImageElement ? source.naturalWidth : source.width,
  height: source instanceof HTMLImageElement ? source.naturalHeight : source.height
});

export function prepareCheckoutActorTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  role: string
): string {
  return prepareTrimmedTexture(
    scene,
    sourceKey,
    `${sourceKey}--checkout-${role}-matte-clean-v3`,
    3,
    true
  );
}

/**
 * The checkout-counter source contains a baked light floor matte around its
 * lower edge. It looks like a white sticker when placed over the authored
 * checkout background. Remove only lower neutral pixels, then reuse the
 * connected-edge cleanup before trimming the texture.
 */
export function prepareCheckoutCounterTexture(
  scene: Phaser.Scene,
  sourceKey: string
): string {
  const aliasKey = `${sourceKey}--checkout-counter-matte-clean-v3`;
  if (!scene.textures.exists(sourceKey) || scene.textures.exists(aliasKey)) {
    return scene.textures.exists(aliasKey) ? aliasKey : sourceKey;
  }

  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSourceLike;
  const { width, height } = sourceDimensions(source);
  const scratchKey = `${aliasKey}--source`;
  const texture = scene.textures.createCanvas(scratchKey, width, height);
  if (!texture) return sourceKey;

  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (bottom >= top) {
    const visibleHeight = bottom - top + 1;
    const lowerStart = top + Math.round(visibleHeight * 0.72);
    for (let y = lowerStart; y <= bottom; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const alpha = pixels[offset + 3] ?? 0;
        if (alpha <= 8) continue;

        const red = pixels[offset] ?? 0;
        const green = pixels[offset + 1] ?? 0;
        const blue = pixels[offset + 2] ?? 0;
        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);
        const average = (red + green + blue) / 3;

        if (maximum - minimum <= 100 && average >= 100) {
          pixels[offset + 3] = 0;
        }
      }
    }
  }

  context.putImageData(image, 0, 0);
  texture.refresh();

  return prepareTrimmedTexture(
    scene,
    scratchKey,
    aliasKey,
    2,
    true
  );
}
