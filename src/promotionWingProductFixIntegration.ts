import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { PromotionWingScene } from "./scenes/PromotionWingScene";

type WingSlot = {
  x: number;
  y: number;
  product?: Phaser.GameObjects.Image;
  missing: Phaser.GameObjects.Text;
};

declare module "./scenes/PromotionWingScene" {
  interface PromotionWingScene {
    placeProduct(slot: WingSlot, animate: boolean): void;
  }
}

type RuntimePromotionWingScene = Phaser.Scene & {
  featuredProduct: ProductId;
};

type PromotionWingPrototype = {
  placeProduct: (slot: WingSlot, animate: boolean) => void;
};

const prototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;

// PromotionWingScene.syncSlotProducts() restores persistent room inventory when
// the player enters Room 2. The original room implementation called this method
// but did not define it, which crashed the scene before it became visible.
prototype.placeProduct = function placePromotionWingProduct(
  slot: WingSlot,
  animate: boolean
): void {
  const scene = this as unknown as RuntimePromotionWingScene;
  const definition = PRODUCTS[scene.featuredProduct ?? "water"];

  slot.product?.destroy();

  const product = scene.add.image(slot.x, slot.y + 58, definition.productKey)
    .setOrigin(0.5, 1)
    .setDepth(22);

  const sourceWidth = Math.max(1, product.width);
  const sourceHeight = Math.max(1, product.height);
  const targetWidth = definition.shelfWidth * 1.35;
  const targetHeight = definition.shelfHeight * 1.35;
  const finalScale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  product.setScale(finalScale);

  slot.product = product;
  slot.missing.setVisible(false);

  if (!animate) return;

  product.setAlpha(0).setScale(finalScale * 0.8);
  scene.tweens.add({
    targets: product,
    alpha: 1,
    scaleX: finalScale,
    scaleY: finalScale,
    duration: 180,
    ease: "Back.Out"
  });
};
