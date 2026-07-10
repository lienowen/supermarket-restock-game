import Phaser from "phaser";
import { Assets } from "../assets";
import { GameScene } from "../scenes/GameScene";

type CartDestination = "WAREHOUSE" | "SALES";

type ImmediateCartScene = Phaser.Scene & {
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  shiftEnded: boolean;
  loadedProducts: unknown[];
  departureRequirement: () => number;
  clearGuide: () => void;
  snapCart: (destination: CartDestination) => void;
  showTransientHint: (message: string) => void;
  updateHud: () => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
};

type GameScenePrototype = {
  create: () => void;
};

const DOORWAY_X = 690;
const CART_MIN_X = 455;
const CART_MAX_X = 820;
const CART_MIN_Y = 790;
const CART_MAX_Y = 970;

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithImmediateCartDrag(): void {
  originalCreate.call(this);
  installImmediateCartDrag(this as unknown as ImmediateCartScene);
};

function installImmediateCartDrag(scene: ImmediateCartScene): void {
  const cart = scene.cart;
  if (!cart?.active) return;

  // Replace every older cart drag listener with one deterministic path.
  cart.removeAllListeners("dragstart");
  cart.removeAllListeners("drag");
  cart.removeAllListeners("dragend");
  cart.removeAllListeners("pointerdown");
  cart.removeAllListeners("pointerup");

  scene.input.setDraggable(cart);

  // No movement threshold and no hold threshold: the first pointer movement is drag.
  scene.input.dragDistanceThreshold = 0;
  scene.input.dragTimeThreshold = 0;
  scene.game.canvas.style.touchAction = "none";

  if (cart.input) cart.input.cursor = "grab";

  cart.on("dragstart", () => {
    const blocked =
      scene.time.paused ||
      scene.shiftEnded ||
      scene.movingCart ||
      scene.restockBusy;

    cart.setData("immediateDragBlocked", blocked);
    cart.setData("immediateDragFromSales", scene.cartAtShelf);
    cart.setData("immediateUnderloaded", !scene.cartAtShelf && scene.loadedProducts.length < scene.departureRequirement());
    cart.setData("immediateHintShown", false);

    if (blocked) return;

    // Cancel any residual positioning tween before the pointer starts moving.
    scene.tweens.killTweensOf(cart);
    scene.tweens.killTweensOf(scene.worker);

    scene.clearGuide();
    scene.movingCart = true;
    cart.setDepth(38);
    cart.setScale(1);
    if (cart.input) cart.input.cursor = "grabbing";

    scene.setWorkerTexture(Assets.characters.workerPush, 250, 455);
    scene.worker.setPosition(cart.x - 108, cart.y);
    scene.updateHud();
  });

  cart.on(
    "drag",
    (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (cart.getData("immediateDragBlocked")) return;

      // Direct pointer mapping: no lerp, no tween, no pre-drag animation.
      cart.setPosition(
        Phaser.Math.Clamp(dragX, CART_MIN_X, CART_MAX_X),
        Phaser.Math.Clamp(dragY, CART_MIN_Y, CART_MAX_Y)
      );

      // Keep the worker visually attached to the push action without lagging behind.
      scene.worker.setPosition(cart.x - 108, cart.y);

      const underloaded = Boolean(cart.getData("immediateUnderloaded"));
      const hintShown = Boolean(cart.getData("immediateHintShown"));
      if (underloaded && !hintShown && cart.x >= DOORWAY_X - 16) {
        const missing = Math.max(0, scene.departureRequirement() - scene.loadedProducts.length);
        scene.showTransientHint(`Load ${missing} more box(es) before leaving.`);
        cart.setData("immediateHintShown", true);
      }
    }
  );

  cart.on("dragend", () => {
    if (cart.input) cart.input.cursor = "grab";

    const blocked = Boolean(cart.getData("immediateDragBlocked"));
    if (blocked) return;

    const fromSales = Boolean(cart.getData("immediateDragFromSales"));
    const underloaded = Boolean(cart.getData("immediateUnderloaded"));

    cart.setData("immediateDragBlocked", false);

    // The player can move instantly even when underloaded; business rules are
    // enforced only after release, so the input itself never feels delayed.
    if (!fromSales && underloaded) {
      if (!cart.getData("immediateHintShown")) {
        const missing = Math.max(0, scene.departureRequirement() - scene.loadedProducts.length);
        scene.showTransientHint(`Load ${missing} more box(es) before leaving.`);
      }
      scene.snapCart("WAREHOUSE");
      return;
    }

    const destination: CartDestination = fromSales
      ? cart.x <= DOORWAY_X
        ? "WAREHOUSE"
        : "SALES"
      : cart.x >= DOORWAY_X
        ? "SALES"
        : "WAREHOUSE";

    scene.snapCart(destination);
  });
}
