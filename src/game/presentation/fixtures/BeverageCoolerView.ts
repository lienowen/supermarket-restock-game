import Phaser from "phaser";
import {
  IntegratedBeverageCoolerView,
  type BeverageCoolerRushState,
  type BeverageCoolerViewConfig
} from "./IntegratedBeverageCoolerView";

export type { BeverageCoolerRushState, BeverageCoolerViewConfig };

const replaceTexture = (scene: Phaser.Scene, key: string): void => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
};

const aliasImageTexture = (
  scene: Phaser.Scene,
  aliasKey: string,
  sourceKey: string | undefined
): void => {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return;
  replaceTexture(scene, aliasKey);
  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  scene.textures.addImage(aliasKey, sourceImage);
};

interface SourceBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const sourceDimensions = (
  source: HTMLImageElement | HTMLCanvasElement
): { readonly width: number; readonly height: number } => ({
  width: source instanceof HTMLImageElement ? source.naturalWidth : source.width,
  height: source instanceof HTMLImageElement ? source.naturalHeight : source.height
});

const resolveOpaqueBounds = (
  source: HTMLImageElement | HTMLCanvasElement
): SourceBounds => {
  const dimensions = sourceDimensions(source);
  const scratch = document.createElement("canvas");
  scratch.width = dimensions.width;
  scratch.height = dimensions.height;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return { x: 0, y: 0, ...dimensions };

  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
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

const aliasCanvasTexture = (
  scene: Phaser.Scene,
  aliasKey: string,
  sourceKey: string | undefined,
  width: number,
  height: number,
  sourceAlpha = 1,
  trimTransparent = false
): void => {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return;
  replaceTexture(scene, aliasKey);
  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const sourceSize = sourceDimensions(sourceImage);
  const sourceBounds = trimTransparent
    ? resolveOpaqueBounds(sourceImage)
    : { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height };
  const texture = scene.textures.createCanvas(aliasKey, width, height);
  if (!texture) throw new Error(`Unable to create processed texture: ${aliasKey}`);
  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.globalAlpha = sourceAlpha;
  context.drawImage(
    sourceImage,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
    0,
    0,
    width,
    height
  );
  context.globalAlpha = 1;
  texture.refresh();
};

/**
 * Compatibility wrapper for the scene API. It prepares stable HD textures and
 * delegates rendering to the world-integrated cooler composition. No full-screen
 * backdrop is created, so the supermarket, employee, cart and case remain visible.
 */
export class BeverageCoolerView extends IntegratedBeverageCoolerView {
  constructor(scene: Phaser.Scene, config: BeverageCoolerViewConfig) {
    aliasImageTexture(scene, "restock-cooler-empty-hd-v3", config.coolerAssetKey);
    aliasCanvasTexture(
      scene,
      "restock-cooler-glass-hd-v3",
      "fixture-beverage-cooler-glass-hd-v3",
      768,
      512,
      0.18
    );
    aliasCanvasTexture(
      scene,
      "restock-cola-bottle-hd-v2",
      config.restockProductKey,
      46,
      108,
      1,
      true
    );
    super(scene, config);
  }
}
