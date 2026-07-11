import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { gameSession } from "./systems/GameSession";

type TutorialStage = "BOX_TO_CART" | "CART_TO_SALES" | "RESTOCK" | "DONE";

type RuntimeBox = {
  loaded?: boolean;
  image: Phaser.GameObjects.Image;
};

type RuntimeGameScene = {
  __dayOneHookActive?: boolean;
  cartAtShelf: boolean;
  loadedProducts: ProductId[];
  boxes: RuntimeBox[];
};

type RuntimeOverlay = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
};

type OverlayPrototype = {
  resolveTutorialStage: () => TutorialStage;
};

const prototype = PolishOverlayScene.prototype as unknown as OverlayPrototype;
const originalResolveTutorialStage = prototype.resolveTutorialStage;

prototype.resolveTutorialStage = function resolveDayOneHookStage(): TutorialStage {
  const overlay = this as unknown as RuntimeOverlay;
  const scene = overlay.gameScene;

  if (gameSession.day === "day01" && scene?.__dayOneHookActive) {
    if (scene.cartAtShelf) return "RESTOCK";
    if (scene.loadedProducts.length >= 1) return "CART_TO_SALES";
    const availableCase = scene.boxes.some(
      (item) => item.image.active && item.image.visible && !item.loaded
    );
    return availableCase ? "BOX_TO_CART" : "DONE";
  }

  return originalResolveTutorialStage.call(this);
};
