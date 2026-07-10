import Phaser from "phaser";
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
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  selectedBox?: BoxItemLike;
  boxes: BoxItemLike[];
  __groundingHandler?: () => void;
};

type ScenePrototype = {
  create: () => void;
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItemLike;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
};

const WAREHOUSE_WORKER_GROUND = { x: 410, y: 930 };
const SALES_WORKER_GROUND = { x: 720, y: 900 };
const MAX_WORKER_WIDTH = 190;
const MAX_WORKER_HEIGHT = 360;

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalCreate = prototype.create;
const originalSpawnBox = prototype.spawnBox;
const originalSetWorkerTexture = prototype.setWorkerTexture;

prototype.setWorkerTexture = function setWorkerTextureCalibrated(
  texture: string,
  maxWidth: number,
  maxHeight: number
): void {
  originalSetWorkerTexture.call(
    this,
    texture,
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

prototype.create = function createWithGroundCalibration(): void {
  originalCreate.call(this);
  const scene = this as unknown as SceneInternals;

  scene.boxes.forEach(calibrateBox);
  capWorker(scene.worker);
  placeIdleWorker(scene);

  if (scene.__groundingHandler) {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene.__groundingHandler);
  }

  const groundingHandler = (): void => {
    if (!scene.worker?.active) return;
    if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;
    if (scene.tweens.isTweening(scene.worker)) return;
    placeIdleWorker(scene);
  };

  scene.__groundingHandler = groundingHandler;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
    if (scene.__groundingHandler === groundingHandler) scene.__groundingHandler = undefined;
  });
};

function calibrateBox(item: BoxItemLike): void {
  item.image
    .setOrigin(0.5, 1)
    .setDepth(16 + item.homeY / 10000);

  // Tight contact shadow: the previous large ellipse created a visible gap and
  // made grounded boxes look as if they were hovering above the floor.
  item.shadow
    .setPosition(item.homeX, item.homeY - 1)
    .setDisplaySize(70, 10)
    .setAlpha(0.16)
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
