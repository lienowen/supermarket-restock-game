import Phaser from "phaser";
import {
  BeverageCoolerView as HdBeverageCoolerView,
  type BeverageCoolerRushState,
  type BeverageCoolerViewConfig
} from "./HdBeverageCoolerView";

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
 * Compatibility wrapper for the existing scene API. Runtime-resolved assets are
 * converted to stable close-up textures before the dedicated cooler view is
 * created. Transparent product padding is removed so the visible bottle base,
 * rather than its source canvas, sits on the real shelf baseline.
 */
export class BeverageCoolerView extends HdBeverageCoolerView {
  private readonly closeupBackdrop: Phaser.GameObjects.Rectangle;

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

    this.closeupBackdrop = scene.add.rectangle(800, 450, 1600, 900, 0xf4f1e9, 0.985)
      .setDepth(47)
      .setVisible(false)
      .setName("restock-cooler-closeup-backdrop");
  }

  override create(): void {
    super.create();
    this.closeupBackdrop.setVisible(false);
  }

  override sync(stockedRows: number): void {
    this.closeupBackdrop.setVisible(false);
    super.sync(stockedRows);
  }

  override syncRush(state: BeverageCoolerRushState): void {
    this.closeupBackdrop.setVisible(true);
    super.syncRush(state);
  }

  override destroy(): void {
    this.closeupBackdrop.destroy();
    super.destroy();
  }
}
