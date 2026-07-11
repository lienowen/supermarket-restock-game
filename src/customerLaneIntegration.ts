import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import type { ShiftPhase } from "./domain/gameTypes";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  phase: ShiftPhase;
  shiftEnded: boolean;
  restockBusy: boolean;
  __finalServiceActive?: boolean;
  __promotionWingActive?: boolean;
  __activeMainCustomers?: number;
  __lastMainCustomerAt?: number;
  customerSequence: number;
  stocked: number;
  money: number;
  soldCount: number;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  pickWeightedSlot: (slots: RuntimeSlot[]) => RuntimeSlot;
  showIncome: (x: number, y: number, amount: number) => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
  updateHud: () => void;
};

type GameScenePrototype = {
  customerPurchase: () => void;
};

const prototype = GameScene.prototype as unknown as GameScenePrototype;

prototype.customerPurchase = function purchaseFromControlledCustomerLane(): void {
  const scene = this as unknown as RuntimeGameScene;
  const customersAllowed =
    scene.phase === "OPEN" ||
    scene.phase === "RUSH" ||
    Boolean(scene.__finalServiceActive);

  if (
    scene.shiftEnded ||
    scene.restockBusy ||
    scene.__promotionWingActive ||
    !customersAllowed
  ) return;

  const activeLimit = gameSession.day === "day01" ? 1 : 2;
  const activeCustomers = scene.__activeMainCustomers ?? 0;
  if (activeCustomers >= activeLimit) return;

  const minimumGap = scene.phase === "RUSH" ? 3600 : 5000;
  const lastSpawn = scene.__lastMainCustomerAt ?? -Infinity;
  if (scene.time.now - lastSpawn < minimumGap) return;

  const available = scene.shelfSlots.filter((slot) => slot.product && !slot.reservedForCustomer);
  if (available.length === 0) return;

  const slot = scene.pickWeightedSlot(available);
  slot.reservedForCustomer = true;
  scene.__lastMainCustomerAt = scene.time.now;
  scene.__activeMainCustomers = activeCustomers + 1;

  const customerKeys = scene.customerSequence % 2 === 0
    ? { idle: Assets.characters.customer01Idle, basket: Assets.characters.customer01Basket }
    : { idle: Assets.characters.customer02Idle, basket: Assets.characters.customer02Basket };
  scene.customerSequence += 1;

  const customer = scene.add.image(1340, 900, customerKeys.idle)
    .setOrigin(0.5, 1)
    .setDepth(35);
  scene.fitImage(customer, 140, 292);

  const shoppingLaneX = 1255;
  const shoppingLaneY = 875;
  scene.tweens.add({
    targets: customer,
    x: shoppingLaneX,
    y: shoppingLaneY,
    duration: 720,
    ease: "Sine.InOut",
    onComplete: () => {
      // A short browse pause makes customers readable instead of instantly
      // deleting products the moment they enter the scene.
      scene.time.delayedCall(650, () => {
        completePurchaseWhenLaneIsClear(scene, customer, customerKeys, slot);
      });
    }
  });
};

function completePurchaseWhenLaneIsClear(
  scene: RuntimeGameScene,
  customer: Phaser.GameObjects.Image,
  customerKeys: { idle: string; basket: string },
  slot: RuntimeSlot
): void {
  if (!scene.scene.isActive() || scene.shiftEnded || !customer.active) {
    releaseCustomer(scene, slot, customer);
    return;
  }

  if (scene.__promotionWingActive) {
    // The player moved to Room 2. Let this shopper leave without consuming stock;
    // only the currently visible room may generate sales.
    releaseCustomer(scene, slot, customer, true);
    return;
  }

  if (scene.restockBusy) {
    scene.tweens.add({
      targets: customer,
      x: 1290,
      duration: 130,
      ease: "Sine.Out"
    });
    scene.time.delayedCall(240, () => completePurchaseWhenLaneIsClear(scene, customer, customerKeys, slot));
    return;
  }

  if (!slot.product) {
    releaseCustomer(scene, slot, customer, true);
    return;
  }

  const soldProduct = slot.product;
  slot.product = undefined;
  slot.reservedForCustomer = false;
  soldProduct.destroy();
  slot.missingTag.setVisible(true);
  scene.stocked = Math.max(0, scene.stocked - 1);

  customer.setTexture(customerKeys.basket);
  scene.fitImage(customer, 146, 300);

  const price = PRODUCTS[slot.productId].price;
  scene.money += price;
  scene.soldCount += 1;
  scene.updateStars();
  scene.showIncome(slot.hitArea.x, slot.hitArea.y - 55, price);
  scene.advanceBusinessPhase();
  scene.updateHud();

  scene.tweens.add({
    targets: customer,
    x: 1345,
    y: 965,
    alpha: 0,
    duration: 720,
    ease: "Sine.In",
    onComplete: () => releaseCustomer(scene, slot, customer)
  });
}

function releaseCustomer(
  scene: RuntimeGameScene,
  slot: RuntimeSlot,
  customer: Phaser.GameObjects.Image,
  animateOut = false
): void {
  slot.reservedForCustomer = false;
  scene.__activeMainCustomers = Math.max(0, (scene.__activeMainCustomers ?? 1) - 1);

  if (!customer.active) return;
  if (!animateOut) {
    customer.destroy();
    return;
  }

  scene.tweens.add({
    targets: customer,
    x: 1360,
    alpha: 0,
    duration: 360,
    ease: "Sine.In",
    onComplete: () => customer.destroy()
  });
}
