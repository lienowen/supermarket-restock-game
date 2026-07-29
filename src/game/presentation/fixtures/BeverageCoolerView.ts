import Phaser from "phaser";
import {
  BeverageCoolerView as HdBeverageCoolerView,
  type BeverageCoolerRushState,
  type BeverageCoolerViewConfig
} from "./HdBeverageCoolerView";

export type { BeverageCoolerRushState, BeverageCoolerViewConfig };

const aliasTexture = (
  scene: Phaser.Scene,
  aliasKey: string,
  sourceKey: string | undefined
): void => {
  if (!sourceKey || scene.textures.exists(aliasKey) || !scene.textures.exists(sourceKey)) return;
  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  scene.textures.addImage(aliasKey, sourceImage);
};

/**
 * Compatibility wrapper for the existing scene API. Runtime-resolved assets are
 * aliased to the HD close-up keys before the dedicated cooler view is created,
 * so the scene controller and level content remain unchanged.
 */
export class BeverageCoolerView extends HdBeverageCoolerView {
  constructor(scene: Phaser.Scene, config: BeverageCoolerViewConfig) {
    aliasTexture(scene, "restock-cooler-empty-hd-v3", config.coolerAssetKey);
    aliasTexture(
      scene,
      "restock-cooler-glass-hd-v3",
      "fixture-beverage-cooler-glass-hd-v3"
    );
    aliasTexture(scene, "restock-cola-bottle-hd-v2", config.restockProductKey);
    super(scene, config);
  }
}
