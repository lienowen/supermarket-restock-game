import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { PromotionWingScene } from "./scenes/PromotionWingScene";

type WingSlot = {
  index: number;
  x: number;
  y: number;
  product?: Phaser.GameObjects.Image;
  missing: Phaser.GameObjects.Image;
  hitArea: Phaser.GameObjects.Rectangle;
  reserved: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  shiftEnded: boolean;
  loadedProducts: ProductId[];
  money: number;
  __promotionWingStock?: number;
  __day2PromoActive?: boolean;
  __day2BackStockSaves?: number;
  updateCartCount: () => void;
  updateHud: () => void;
};

type RuntimeBackStock = Phaser.Scene & {
  inventory?: Record<ProductId, number>;
  refreshButtons?: () => void;
};

type RuntimePromotionWing = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  backStockScene?: RuntimeBackStock;
  featuredProduct: ProductId;
  worker?: Phaser.GameObjects.Image;
  restockBusy: boolean;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  showFloating: (x: number, y: number, message: string, color: number) => void;
};

type PromotionWingPrototype = {
  placeProduct: (slot: WingSlot, animate: boolean) => void;
  restockSlot: (slot: WingSlot) => void;
};

const BACK_STOCK_SAVE_REWARD = 6;
const WING_RESTOCK_REWARD = 4;
const MAX_WING_STOCK = 6;
const prototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;

prototype.placeProduct = function placeSizedProductionSlot(slot: WingSlot, animate: boolean): void {
  const scene = this as unknown as RuntimePromotionWing;
  const texture = scene.featuredProduct === "cola"
    ? Assets.promotion.slotCola
    : scene.featuredProduct === "milk"
      ? Assets.promotion.slotMilk
      : Assets.promotion.slotWater;

  slot.product?.destroy();
  const product = scene.add.image(slot.x, slot.y, texture)
    .setDisplaySize(112, 140)
    .setDepth(9);
  const finalScaleX = product.scaleX;
  const finalScaleY = product.scaleY;
  slot.product = product;
  slot.missing.setVisible(false);

  if (!animate) return;
  product
    .setScale(finalScaleX * 0.78, finalScaleY * 0.78)
    .setAlpha(0);
  scene.tweens.add({
    targets: product,
    scaleX: finalScaleX,
    scaleY: finalScaleY,
    alpha: 1,
    duration: 180,
    ease: "Back.Out"
  });
};

prototype.restockSlot = function restockProductionSlot(slot: WingSlot): void {
  const scene = this as unknown as RuntimePromotionWing;
  const game = scene.gameScene;
  if (!game || scene.restockBusy || slot.product || slot.reserved || game.shiftEnded) return;

  const cartIndex = game.loadedProducts.indexOf(scene.featuredProduct);
  const backStockAmount = scene.backStockScene?.inventory?.[scene.featuredProduct] ?? 0;
  const useCart = cartIndex >= 0;
  const useBackStock = !useCart && backStockAmount > 0;

  if (!useCart && !useBackStock) {
    scene.showFloating(
      slot.x,
      slot.y - 95,
      `NO ${PRODUCTS[scene.featuredProduct].label} STOCK`,
      0xff8179
    );
    return;
  }

  if (useCart) {
    game.loadedProducts.splice(cartIndex, 1);
    game.updateCartCount();
  } else if (scene.backStockScene?.inventory) {
    scene.backStockScene.inventory[scene.featuredProduct] -= 1;
    scene.backStockScene.refreshButtons?.();
    if (game.__day2PromoActive) {
      game.__day2BackStockSaves = Math.min(3, (game.__day2BackStockSaves ?? 0) + 1);
      game.money += BACK_STOCK_SAVE_REWARD;
    }
  }

  scene.restockBusy = true;
  scene.worker?.setTexture(Assets.characters.workerCarry);
  if (scene.worker) scene.fitImage(scene.worker, 190, 345);

  scene.tweens.add({
    targets: scene.worker,
    x: slot.x - 78,
    y: slot.y + 205,
    duration: 350,
    ease: "Sine.InOut",
    onComplete: () => {
      prototype.placeProduct.call(this, slot, true);
      game.__promotionWingStock = Math.min(MAX_WING_STOCK, (game.__promotionWingStock ?? 0) + 1);
      game.money += WING_RESTOCK_REWARD;
      game.updateHud();

      scene.worker?.setTexture(Assets.characters.workerIdle);
      if (scene.worker) scene.fitImage(scene.worker, 170, 330);
      scene.tweens.add({
        targets: scene.worker,
        x: 165,
        y: 1040,
        duration: 260,
        ease: "Sine.Out"
      });

      scene.restockBusy = false;
      scene.showFloating(
        slot.x,
        slot.y - 100,
        useBackStock
          ? `BACK STOCK SAVE +${BACK_STOCK_SAVE_REWARD}`
          : `PROMO RESTOCK +${WING_RESTOCK_REWARD}`,
        0x9ff18d
      );
    }
  });
};
