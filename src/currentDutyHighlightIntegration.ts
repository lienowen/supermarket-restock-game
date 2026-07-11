import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";

type BoundsTarget = {
  getBounds: () => Phaser.Geom.Rectangle;
};

type RuntimeBox = {
  productId: ProductId;
  loaded: boolean;
  image: Phaser.GameObjects.Image;
};

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer?: boolean;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  boxes: RuntimeBox[];
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  cart: Phaser.GameObjects.Container;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  departureRequirement: () => number;
  __dutyHighlight?: Phaser.GameObjects.Rectangle;
  __dutyHighlightLabel?: Phaser.GameObjects.Text;
};

type RuntimeWing = Phaser.Scene & {
  __promoQueue?: unknown[];
  __promoRegisterButton?: Phaser.GameObjects.Image;
  __mainlineServiceBubble?: Phaser.GameObjects.Image;
  __mainlineDamageIcon?: Phaser.GameObjects.Image;
  __dutyHighlight?: Phaser.GameObjects.Rectangle;
  __dutyHighlightLabel?: Phaser.GameObjects.Text;
};

type CreatePrototype = {
  create: (...args: unknown[]) => void;
};

installGameDutyHighlight();
installPromotionDutyHighlight();

function installGameDutyHighlight(): void {
  const prototype = GameScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithDutyHighlight(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    createHighlight(scene);

    let lastUpdate = 0;
    const update = (): void => {
      if (scene.time.now - lastUpdate < 160) return;
      lastUpdate = scene.time.now;
      updateGameHighlight(scene);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, update);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, update);
    });
  };
}

function installPromotionDutyHighlight(): void {
  const prototype = PromotionWingScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithPromotionDutyHighlight(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeWing;
    createHighlight(scene);

    let lastUpdate = 0;
    const update = (): void => {
      if (scene.time.now - lastUpdate < 160) return;
      lastUpdate = scene.time.now;
      updatePromotionHighlight(scene);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, update);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, update);
    });
  };
}

function createHighlight(scene: RuntimeGame | RuntimeWing): void {
  scene.__dutyHighlight?.destroy();
  scene.__dutyHighlightLabel?.destroy();

  const highlight = scene.add.rectangle(0, 0, 120, 120, 0xffd75a, 0.06)
    .setStrokeStyle(7, 0xffd75a, 1)
    .setDepth(875)
    .setVisible(false);
  const label = scene.add.text(0, 0, "NEXT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#17231d",
    fontStyle: "bold",
    backgroundColor: "#ffd75a",
    padding: { x: 11, y: 6 }
  }).setOrigin(0.5, 1).setDepth(876).setVisible(false);

  scene.__dutyHighlight = highlight;
  scene.__dutyHighlightLabel = label;
  scene.tweens.add({
    targets: [highlight, label],
    alpha: 0.46,
    duration: 460,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function updateGameHighlight(scene: RuntimeGame): void {
  if (scene.shiftEnded || scene.phase === "RESULT" || scene.restockBusy || scene.movingCart) {
    hideHighlight(scene);
    return;
  }

  if (scene.phase === "CLOSING") {
    if (scene.cartAtShelf) showHighlight(scene, scene.cart, "RETURN CART", 34);
    else hideHighlight(scene);
    return;
  }

  if (!scene.cartAtShelf) {
    const required = scene.departureRequirement();
    if (scene.loadedProducts.length < required) {
      const nextCase = scene.boxes.find((item) => item.image.active && item.image.visible && !item.loaded);
      if (nextCase) showHighlight(scene, nextCase.image, "LOAD CASE", 24);
      else hideHighlight(scene);
      return;
    }

    showHighlight(scene, scene.cart, "MOVE CART", 24);
    return;
  }

  const missingSlots = scene.shelfSlots.filter((slot) => !slot.product && !slot.reservedForCustomer);
  const restockable = missingSlots.find((slot) => scene.loadedProducts.includes(slot.productId));
  if (restockable) {
    showHighlight(scene, restockable.hitArea, "RESTOCK", 18);
    return;
  }

  if (missingSlots.length > 0) {
    showHighlight(scene, scene.cart, "BACKROOM", 24);
    return;
  }

  hideHighlight(scene);
}

function updatePromotionHighlight(scene: RuntimeWing): void {
  if (scene.__mainlineServiceBubble?.active) {
    showHighlight(scene, scene.__mainlineServiceBubble, "HANDLE RETURN", 18);
    return;
  }
  if (scene.__mainlineDamageIcon?.active) {
    showHighlight(scene, scene.__mainlineDamageIcon, "REMOVE DAMAGE", 18);
    return;
  }
  if ((scene.__promoQueue?.length ?? 0) > 0 && scene.__promoRegisterButton?.active) {
    showHighlight(scene, scene.__promoRegisterButton, "CHECKOUT", 16);
    return;
  }
  hideHighlight(scene);
}

function showHighlight(
  scene: RuntimeGame | RuntimeWing,
  target: BoundsTarget,
  labelText: string,
  padding: number
): void {
  const bounds = target.getBounds();
  const highlight = scene.__dutyHighlight;
  const label = scene.__dutyHighlightLabel;
  if (!highlight || !label) return;

  const width = Math.max(82, bounds.width + padding * 2);
  const height = Math.max(72, bounds.height + padding * 2);
  highlight
    .setPosition(bounds.centerX, bounds.centerY)
    .setSize(width, height)
    .setDisplaySize(width, height)
    .setVisible(true);
  label
    .setText(labelText)
    .setPosition(bounds.centerX, Math.max(205, bounds.top - 8))
    .setVisible(true);
}

function hideHighlight(scene: RuntimeGame | RuntimeWing): void {
  scene.__dutyHighlight?.setVisible(false);
  scene.__dutyHighlightLabel?.setVisible(false);
}
