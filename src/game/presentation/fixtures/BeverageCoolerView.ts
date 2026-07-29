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

const aliasCanvasTexture = (
  scene: Phaser.Scene,
  aliasKey: string,
  sourceKey: string | undefined,
  width: number,
  height: number,
  sourceAlpha = 1
): void => {
  if (!sourceKey || !scene.textures.exists(sourceKey)) return;
  replaceTexture(scene, aliasKey);
  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
  const texture = scene.textures.createCanvas(aliasKey, width, height);
  if (!texture) throw new Error(`Unable to create processed texture: ${aliasKey}`);
  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.globalAlpha = sourceAlpha;
  context.drawImage(sourceImage, 0, 0, width, height);
  context.globalAlpha = 1;
  texture.refresh();
};

/**
 * Compatibility wrapper for the existing scene API. Runtime-resolved assets are
 * converted to stable close-up textures before the dedicated cooler view is
 * created. The bottle alias owns its final on-shelf dimensions, preventing a
 * tween scale from restoring the source artwork to its original giant canvas.
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
      108
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
