import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import type { ProductId } from "./gameConfig";

type BoxItemLike = {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
};

type SceneInternals = Phaser.Scene & {
  worker: Phaser.GameObjects.Image;
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  shiftEnded: boolean;
  loadedProducts: ProductId[];
  selectedBox?: BoxItemLike;
  boxes: BoxItemLike[];
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  departureRequirement: () => number;
  showTransientHint: (message: string) => void;
  __groundingHandler?: () => void;
  __cartShadow?: Phaser.GameObjects.Ellipse;
};

type ScenePrototype = {
  create: () => void;
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItemLike;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
};

const WAREHOUSE_WORKER_GROUND = { x: 410, y: 950 };
const SALES_WORKER_GROUND = { x: 720, y: 925 };
const WAREHOUSE_CART_GROUND_Y = 962;
const SALES_CART_GROUND_Y = 948;
const MAX_WORKER_WIDTH = 188;
const MAX_WORKER_HEIGHT = 355;
const BOX_FLOOR_NUDGE = 8;

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalCreate = prototype.create;
const originalSpawnBox = prototype.spawnBox;
const originalSetWorkerTexture = prototype.setWorkerTexture;
const originalSnapCart = prototype.snapCart;

prototype.setWorkerTexture = function setWorkerTextureCalibrated(
  texture: string,
  maxWidth: number,
  maxHeight: number
): void {
  // worker_push_cart.png already contains a complete second cart. Using it together
  // with the real cart sprite creates the double-cart bug seen in playtests.
  const safeTexture = texture === Assets.characters.workerPush
    ? Assets.characters.workerIdle
    : texture;

  originalSetWorkerTexture.call(
    this,
    safeTexture,
    Math.min(maxWidth, MAX_WORKER_WIDTH),
    Math.min(maxHeight, MAX_WORKER_HEIGHT)
  );
};

prototype.spawnBox = function spawnGroundedBox(
  productId: ProductId,
  positionIndex: number,
  renewable: boolean
): BoxItemLike {
  const item = originalSpawnBox.call(this, productId, positionIndex, renewable);
  calibrateBox(item);
  return item;
};

prototype.snapCart = function snapCartGrounded(
  destination: "WAREHOUSE" | "SALES"
): void {
  originalSnapCart.call(this, destination);
  const scene = this as unknown as SceneInternals;
  const cartY = destination === "SALES" ? SALES_CART_GROUND_Y : WAREHOUSE_CART_GROUND_Y;
  const workerTarget = destination === "SALES" ? SALES_WORKER_GROUND : WAREHOUSE_WORKER_GROUND;

  // Override only the visual contact lines. X movement and business state still
  // come from the integrated GameScene implementation.
  scene.tweens.add({
    targets: scene.cart,
    y: cartY,
    duration: 260,
    ease: "Sine.Out"
  });

  scene.tweens.add({
    targets: scene.worker,
    x: workerTarget.x,
    y: workerTarget.y,
    duration: 260,
    ease: "Sine.Out"
  });
};

prototype.create = function createWithGroundCalibration(): void {
  originalCreate.call(this);
  const scene = this as unknown as SceneInternals;

  scene.boxes.forEach(calibrateBox);
  capWorker(scene.worker);
  configureCartInteraction(scene);
  ensureCartShadow(scene);

  scene.cart.y = scene.cartAtShelf ? SALES_CART_GROUND_Y : WAREHOUSE_CART_GROUND_Y;
  placeIdleWorker(scene);
  updateCartShadow(scene);

  if (scene.__groundingHandler) {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene.__groundingHandler);
  }

  const groundingHandler = (): void => {
    if (!scene.worker?.active || !scene.cart?.active) return;

    updateCartShadow(scene);

    if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;
    if (scene.tweens.isTweening(scene.worker)) return;

    placeIdleWorker(scene);
  };

  scene.__groundingHandler = groundingHandler;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
    if (scene.__groundingHandler === groundingHandler) scene.__groundingHandler = undefined;
    scene.__cartShadow?.destroy();
    scene.__cartShadow = undefined;
  });
};

function configureCartInteraction(scene: SceneInternals): void {
  // The old container hit area was centred around y=0 while the visible cart sits
  // mostly above y=0. This made first clicks miss and forced players to try again.
  scene.cart.disableInteractive();
  scene.cart.removeAllListeners("pointerdown");
  scene.cart.removeAllListeners("pointerup");

  scene.cart.setInteractive(
    new Phaser.Geom.Rectangle(-165, -255, 330, 285),
    Phaser.Geom.Rectangle.Contains
  );
  scene.input.setDraggable(scene.cart);
  if (scene.cart.input) scene.cart.input.cursor = "pointer";

  scene.cart.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    scene.cart.setData("tapStartX", pointer.worldX);
    scene.cart.setData("tapStartY", pointer.worldY);
  });

  scene.cart.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    const startX = Number(scene.cart.getData("tapStartX") ?? pointer.worldX);
    const startY = Number(scene.cart.getData("tapStartY") ?? pointer.worldY);
    const distance = Phaser.Math.Distance.Between(startX, startY, pointer.worldX, pointer.worldY);

    // A real drag keeps the original GameScene drag flow. A short tap becomes a
    // reliable one-click fallback, so players never need to click several times.
    if (distance > 12 || scene.movingCart || scene.restockBusy || scene.shiftEnded) return;

    if (scene.cartAtShelf) {
      scene.snapCart("WAREHOUSE");
      return;
    }

    const required = scene.departureRequirement();
    if (scene.loadedProducts.length >= required) {
      scene.snapCart("SALES");
    } else {
      scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more box(es) first.`);
    }
  });
}

function ensureCartShadow(scene: SceneInternals): void {
  scene.__cartShadow?.destroy();
  scene.__cartShadow = scene.add.ellipse(0, 0, 205, 22, 0x101515, 0.2)
    .setDepth(17);
}

function updateCartShadow(scene: SceneInternals): void {
  if (!scene.__cartShadow?.active) return;
  scene.__cartShadow
    .setPosition(scene.cart.x + 6, scene.cart.y + 3)
    .setDepth(Math.max(1, scene.cart.depth - 1))
    .setVisible(scene.cart.visible);
}

function calibrateBox(item: BoxItemLike): void {
  if (!item.image.getData("groundCalibrated")) {
    item.homeY += BOX_FLOOR_NUDGE;
    item.image.setData("groundCalibrated", true);
  }

  item.image
    .setOrigin(0.5, 1)
    .setPosition(item.homeX, item.homeY)
    .setDepth(16 + item.homeY / 10000);

  item.shadow
    .setPosition(item.homeX, item.homeY + 3)
    .setDisplaySize(76, 12)
    .setAlpha(0.22)
    .setDepth(15 + item.homeY / 10000);
}

function placeIdleWorker(scene: SceneInternals): void {
  const target = scene.cartAtShelf ? SALES_WORKER_GROUND : WAREHOUSE_WORKER_GROUND;
  capWorker(scene.worker);
  scene.worker
    .setOrigin(0.5, 1)
    .setPosition(target.x, target.y)
    .setDepth(17.8);
}

function capWorker(worker: Phaser.GameObjects.Image): void {
  const sourceWidth = Math.max(1, worker.width);
  const sourceHeight = Math.max(1, worker.height);
  const scale = Math.min(MAX_WORKER_WIDTH / sourceWidth, MAX_WORKER_HEIGHT / sourceHeight);
  worker.setScale(scale).setOrigin(0.5, 1);
}
