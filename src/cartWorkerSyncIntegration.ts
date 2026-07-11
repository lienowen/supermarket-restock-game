import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";

type CartDestination = "WAREHOUSE" | "SALES";

type RuntimeGameScene = Phaser.Scene & {
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  updateHud: () => void;
  endShift: () => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  __cartWorkerSyncHandler?: () => void;
};

type GameScenePrototype = {
  create: () => void;
  snapCart: (destination: CartDestination) => void;
};

const WAREHOUSE_WORKER_GROUND = { x: 410, y: 950 };
const SALES_WORKER_GROUND = { x: 720, y: 925 };
const WAREHOUSE_CART_GROUND = { x: 505, y: 962 };
const SALES_CART_GROUND = { x: 760, y: 948 };
const PUSH_OFFSET_TO_SALES = -108;
const PUSH_OFFSET_TO_WAREHOUSE = 108;

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithCartWorkerSync(): void {
  originalCreate.call(this);
  installCartWorkerSync(this as unknown as RuntimeGameScene);
};

prototype.snapCart = function snapCartWithAttachedWorker(destination: CartDestination): void {
  const scene = this as unknown as RuntimeGameScene;
  const cartTarget = destination === "SALES" ? SALES_CART_GROUND : WAREHOUSE_CART_GROUND;
  const workerTarget = destination === "SALES" ? SALES_WORKER_GROUND : WAREHOUSE_WORKER_GROUND;
  const pushOffset = destination === "SALES"
    ? PUSH_OFFSET_TO_SALES
    : PUSH_OFFSET_TO_WAREHOUSE;

  scene.tweens.killTweensOf(scene.cart);
  scene.tweens.killTweensOf(scene.worker);
  scene.cart.setData("workerSyncOffset", pushOffset);
  scene.movingCart = true;
  scene.cart.setDepth(38);
  scene.setWorkerTexture(Assets.characters.workerPush, 250, 455);
  syncWorkerToCart(scene, pushOffset);

  // Animate one object only. The worker is derived from the cart position on every
  // update, so the cart can never arrive before the employee.
  scene.tweens.add({
    targets: scene.cart,
    x: cartTarget.x,
    y: cartTarget.y,
    duration: 230,
    ease: "Cubic.Out",
    onUpdate: () => syncWorkerToCart(scene, pushOffset),
    onComplete: () => {
      scene.cartAtShelf = destination === "SALES";
      scene.movingCart = false;
      scene.cart.setDepth(18);
      scene.cart.setData("workerSyncOffset", undefined);
      scene.setWorkerTexture(
        Assets.characters.workerIdle,
        destination === "SALES" ? 205 : 220,
        destination === "SALES" ? 420 : 440
      );
      scene.worker
        .setPosition(workerTarget.x, workerTarget.y)
        .setDepth(17.8);

      if (destination === "WAREHOUSE" && scene.phase === "CLOSING") {
        scene.endShift();
        return;
      }

      scene.updateHud();
    }
  });
};

function installCartWorkerSync(scene: RuntimeGameScene): void {
  if (scene.__cartWorkerSyncHandler) {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene.__cartWorkerSyncHandler);
  }

  const handler = (): void => {
    if (!scene.movingCart || !scene.cart?.active || !scene.worker?.active) return;

    const storedOffset = scene.cart.getData("workerSyncOffset");
    const fromSales = Boolean(scene.cart.getData("immediateDragFromSales"));
    const offset = typeof storedOffset === "number"
      ? storedOffset
      : fromSales
        ? PUSH_OFFSET_TO_WAREHOUSE
        : PUSH_OFFSET_TO_SALES;

    syncWorkerToCart(scene, offset);
  };

  scene.__cartWorkerSyncHandler = handler;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, handler);
    if (scene.__cartWorkerSyncHandler === handler) {
      scene.__cartWorkerSyncHandler = undefined;
    }
  });
}

function syncWorkerToCart(scene: RuntimeGameScene, offset: number): void {
  scene.worker
    .setPosition(scene.cart.x + offset, scene.cart.y)
    .setDepth(37.8);
}
