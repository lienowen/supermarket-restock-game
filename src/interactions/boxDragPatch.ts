import Phaser from "phaser";
import { Assets } from "../assets";
import { GAME_RULES, PRODUCTS, type ProductId } from "../gameConfig";
import { GameScene } from "../scenes/GameScene";

type BoxItemLike = {
  id: number;
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  positionIndex: number;
  renewable: boolean;
  loaded: boolean;
};

type SceneInternals = GameScene & {
  selectedBox?: BoxItemLike;
  loadedProducts: ProductId[];
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  shiftEnded: boolean;
  hintText: Phaser.GameObjects.Text;
  showTransientHint: (message: string) => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  updateHud: () => void;
  loadSelectedBox: () => void;
};

type ScenePrototype = {
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItemLike;
  selectBox: (item: BoxItemLike) => void;
  updateHud: () => void;
};

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalSpawnBox = prototype.spawnBox;
const originalUpdateHud = prototype.updateHud;

prototype.selectBox = function selectBoxWithoutScale(item: BoxItemLike): void {
  const scene = this as unknown as SceneInternals;

  if (scene.shiftEnded || scene.movingCart || item.loaded || !item.image.visible) return;

  if (scene.loadedProducts.length >= GAME_RULES.cartCapacity) {
    scene.showTransientHint("The cart is full. Restock a shelf slot first.");
    return;
  }

  if (scene.selectedBox && scene.selectedBox !== item) {
    scene.selectedBox.image.clearTint();
  }

  // Selection is intentionally idempotent: repeated clicks never multiply scale.
  scene.selectedBox = item;
  item.image.setTint(0xfff0a6);
  scene.setWorkerTexture(Assets.characters.workerCarry, 255, 500);
  scene.updateHud();
};

prototype.spawnBox = function spawnBoxWithSmoothDrag(
  productId: ProductId,
  positionIndex: number,
  renewable: boolean
): BoxItemLike {
  const scene = this as unknown as SceneInternals;
  const item = originalSpawnBox.call(this, productId, positionIndex, renewable);
  installSmoothDrag(scene, item);
  return item;
};

prototype.updateHud = function updateHudForDragInteraction(): void {
  originalUpdateHud.call(this);
  const scene = this as unknown as SceneInternals;

  if (scene.shiftEnded || scene.movingCart || scene.cartAtShelf) return;

  if (scene.selectedBox) {
    scene.hintText.setText(
      `2. Drag ${PRODUCTS[scene.selectedBox.productId].label} onto the cart · or tap cart`
    );
    return;
  }

  scene.hintText.setText(
    `1. Drag boxes onto cart · ${scene.loadedProducts.length}/${GAME_RULES.firstMoveRequirement}`
  );
};

function installSmoothDrag(scene: SceneInternals, item: BoxItemLike): void {
  const image = item.image;
  if (image.getData("smoothDragReady")) return;

  image.setData("smoothDragReady", true);
  image.setData("homeX", image.x);
  image.setData("homeY", image.y);
  image.setData("homeScaleX", image.scaleX);
  image.setData("homeScaleY", image.scaleY);
  image.setData("dragBlocked", false);

  scene.input.setDraggable(image);

  image.on("dragstart", () => {
    const blocked =
      scene.shiftEnded ||
      scene.movingCart ||
      item.loaded ||
      !image.visible ||
      scene.loadedProducts.length >= GAME_RULES.cartCapacity;

    image.setData("dragBlocked", blocked);

    if (blocked) {
      if (scene.loadedProducts.length >= GAME_RULES.cartCapacity) {
        scene.showTransientHint("The cart is full. Restock a shelf slot first.");
      }
      return;
    }

    scene.tweens.killTweensOf(image);
    prototype.selectBox.call(scene as unknown as GameScene, item);
    image.setDepth(46).setAlpha(0.96);
    scene.cartSprite.setTint(0xffef9f);
  });

  image.on(
    "drag",
    (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (image.getData("dragBlocked")) return;

      image.setPosition(
        Phaser.Math.Clamp(dragX, 45, 1285),
        Phaser.Math.Clamp(dragY, 190, 1085)
      );

      scene.cartSprite.setTint(isOverCart(scene, image) ? 0xbff3a8 : 0xffef9f);
    }
  );

  image.on("dragend", () => {
    const blocked = Boolean(image.getData("dragBlocked"));
    image.setData("dragBlocked", false);
    scene.cartSprite.clearTint();

    if (blocked) {
      returnHome(scene, item, false);
      return;
    }

    if (isOverCart(scene, image)) {
      scene.selectedBox = item;
      image.setAlpha(1).setDepth(16);
      scene.loadSelectedBox();
      return;
    }

    returnHome(scene, item, true);
  });
}

function isOverCart(scene: SceneInternals, image: Phaser.GameObjects.Image): boolean {
  const bounds = scene.cart.getBounds();
  const paddedBounds = new Phaser.Geom.Rectangle(
    bounds.x - 35,
    bounds.y - 35,
    bounds.width + 70,
    bounds.height + 70
  );
  return paddedBounds.contains(image.x, image.y);
}

function returnHome(scene: SceneInternals, item: BoxItemLike, updateHud: boolean): void {
  const image = item.image;
  const homeX = Number(image.getData("homeX"));
  const homeY = Number(image.getData("homeY"));
  const homeScaleX = Number(image.getData("homeScaleX"));
  const homeScaleY = Number(image.getData("homeScaleY"));

  if (scene.selectedBox === item) scene.selectedBox = undefined;

  image.clearTint().setAlpha(1).setDepth(16);
  scene.setWorkerTexture(Assets.characters.workerIdle, 250, 490);

  scene.tweens.add({
    targets: image,
    x: homeX,
    y: homeY,
    scaleX: homeScaleX,
    scaleY: homeScaleY,
    duration: 220,
    ease: "Sine.Out",
    onComplete: () => {
      if (updateHud) scene.updateHud();
    }
  });
}
