import Phaser from "phaser";
import { Assets } from "./assets";
import { GAME_RULES, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type BoxItem = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  positionIndex: number;
  renewable: boolean;
  loaded: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  selectedBox?: BoxItem;
  loadedProducts: ProductId[];
  cartAtShelf: boolean;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItem;
  scheduleReserveRespawn: (productId: ProductId, positionIndex: number) => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  updateCartCount: () => void;
  updateHud: () => void;
};

type GamePrototype = {
  createInitialBoxes: () => void;
  loadSelectedBox: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreateInitialBoxes = prototype.createInitialBoxes;

prototype.createInitialBoxes = function createOnlyDeliveredOpeningCases(): void {
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day === "day01") {
    (["cola", "water", "milk"] as ProductId[]).forEach((productId, index) => {
      scene.spawnBox(productId, index, false);
    });
    return;
  }

  if (gameSession.day === "day02") {
    (["cola", "water", "milk", "cola"] as ProductId[]).forEach((productId, index) => {
      scene.spawnBox(productId, index, false);
    });
    return;
  }

  originalCreateInitialBoxes.call(this);
};

prototype.loadSelectedBox = function loadCaseAsShelfUnits(): void {
  const scene = this as unknown as RuntimeGameScene;
  const item = scene.selectedBox;
  if (!item || scene.cartAtShelf) return;

  const capacityRemaining = Math.max(0, GAME_RULES.cartCapacity - scene.loadedProducts.length);
  if (capacityRemaining <= 0) return;

  scene.selectedBox = undefined;
  item.image.clearTint().disableInteractive();
  item.shadow.destroy();

  scene.tweens.add({
    targets: item.image,
    x: scene.cart.x,
    y: scene.cart.y - 55,
    scaleX: item.image.scaleX * 0.42,
    scaleY: item.image.scaleY * 0.42,
    duration: 320,
    ease: "Cubic.Out",
    onComplete: () => {
      item.loaded = true;
      item.image.setVisible(false);

      // Opening delivery cases contain two shelf units. Renewable reserve cases
      // represent one urgent replacement unit after the store is already open.
      const unitsInCase = item.renewable ? 1 : Math.min(2, capacityRemaining);
      for (let unit = 0; unit < unitsInCase; unit += 1) {
        scene.loadedProducts.push(item.productId);
      }

      scene.setWorkerTexture(Assets.characters.workerIdle, 220, 440);
      scene.worker.setPosition(490, 565);
      scene.updateCartCount();

      if (item.renewable) scene.scheduleReserveRespawn(item.productId, item.positionIndex);
      scene.updateHud();
    }
  });
};
