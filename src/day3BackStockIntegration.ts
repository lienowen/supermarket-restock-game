import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { BackStockScene } from "./scenes/BackStockScene";
import { gameSession } from "./systems/GameSession";

type RuntimeSlot = {
  productId: ProductId;
  product?: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  showTransientHint: (message: string) => void;
};

type BackStockPrototype = {
  tryAttach: () => void;
  seedOpeningShelfStock: (scene: RuntimeGameScene) => void;
};

const prototype = BackStockScene.prototype as unknown as BackStockPrototype;
const originalTryAttach = prototype.tryAttach;
const originalSeedOpeningShelfStock = prototype.seedOpeningShelfStock;
let attachingDay3 = false;

prototype.tryAttach = function attachBackStockForDay3(): void {
  if (gameSession.day !== "day03") {
    originalTryAttach.call(this);
    return;
  }

  // BackStockScene's existing implementation is already stable for Day 2. During
  // attachment only, expose Day 3 as the same inventory-capable mode; afterward the
  // canonical GameSession day immediately returns to Day 3.
  attachingDay3 = true;
  Object.defineProperty(gameSession, "day", {
    configurable: true,
    get: () => "day02"
  });

  try {
    originalTryAttach.call(this);
  } finally {
    delete (gameSession as unknown as Record<string, unknown>).day;
    attachingDay3 = false;
  }
};

prototype.seedOpeningShelfStock = function seedDay3OpeningStock(scene: RuntimeGameScene): void {
  if (!attachingDay3) {
    originalSeedOpeningShelfStock.call(this, scene);
    return;
  }

  const originalHint = scene.showTransientHint;
  scene.showTransientHint = (message: string) => {
    originalHint.call(
      scene,
      message.replace(
        "Day 2 starts at Shelf 3/6. Bring one COLA, WATER and MILK case to open.",
        "Day 3 starts at Shelf 3/6. Prepare one mixed cart, then use customer service choices during trading."
      )
    );
  };

  try {
    originalSeedOpeningShelfStock.call(this, scene);
  } finally {
    scene.showTransientHint = originalHint;
  }
};
