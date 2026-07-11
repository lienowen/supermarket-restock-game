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
const CART_MIN_X = 430;
const CART_MAX_X = 850;
const CART_MIN_Y = 760;
const CART_MAX_Y = 985;

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithImmediateCartDrag(): void {
  originalCreate.call(this);
  installImmediateCartDrag(this as unknown as ImmediateCartScene);
};

function installImmediateCartDrag(scene: ImmediateCartScene): void {
  const cart = scene.cart;
  if (!cart?.active) return;

  // Replace every older cart listener and rebuild a forgiving hit area around
  // the full artwork, labels and handle. The player should not need pixel-perfect aim.
  cart.disableInteractive();
  cart.removeAllListeners("dragstart");
  cart.removeAllListeners("drag");
  cart.removeAllListeners("dragend");
  cart.removeAllListeners("pointerdown");
  cart.removeAllListeners("pointerup");

  cart.setSize(430, 390);
  cart.setInteractive(
    new Phaser.Geom.Rectangle(-215, -325, 430, 390),
    Phaser.Geom.Rectangle.Contains
  );
  scene.input.setDraggable(cart);

  // No movement threshold and no hold threshold: first movement starts the drag.
  scene.input.dragDistanceThreshold = 0;
  scene.input.dragTimeThreshold = 0;
  scene.game.canvas.style.touchAction = "none";
  if (cart.input) cart.input.cursor = "grab";

  // Interrupt an unfinished snap immediately on press. Previously movingCart made
  // the cart ignore input during the whole landing tween, which felt unresponsive.
  cart.on("pointerdown", () => {
    if (scene.time.paused || scene.shiftEnded || scene.restockBusy) return;
    scene.tweens.killTweensOf(cart);
    scene.tweens.killTweensOf(scene.worker);
    scene.movingCart = false;
    if (cart.input) cart.input.cursor = "grabbing";
  });

  cart.on("dragstart", () => {
    const blocked = scene.time.paused || scene.shiftEnded || scene.restockBusy;

    cart.setData("immediateDragBlocked", blocked);
    cart.setData("immediateDragFromSales", scene.cartAtShelf);
    cart.setData(
      "immediateUnderloaded",
      !scene.cartAtShelf && scene.loadedProducts.length < scene.departureRequirement()
    );
    cart.setData("immediateHintShown", false);

    if (blocked) return;

    scene.tweens.killTweensOf(cart);
    scene.tweens.killTweensOf(scene.worker);
    scene.clearGuide();
    scene.movingCart = true;
    cart.setDepth(38).setScale(1);
    if (cart.input) cart.input.cursor = "grabbing";

    scene.setWorkerTexture(Assets.characters.workerPush, 250, 455);
    scene.worker.setPosition(cart.x - 108, cart.y);
    scene.updateHud();
  });

  cart.on(
    "drag",
    (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (cart.getData("immediateDragBlocked")) return;

      // Direct pointer mapping: no lerp, tween or pre-drag scale animation.
      cart.setPosition(
        Phaser.Math.Clamp(dragX, CART_MIN_X, CART_MAX_X),
        Phaser.Math.Clamp(dragY, CART_MIN_Y, CART_MAX_Y)
      );
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
    cart.setData("immediateDragBlocked", false);
    if (blocked) return;

    const fromSales = Boolean(cart.getData("immediateDragFromSales"));
    const underloaded = Boolean(cart.getData("immediateUnderloaded"));

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
