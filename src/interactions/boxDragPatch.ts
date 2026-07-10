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

type ShelfSlotLike = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type SceneInternals = Phaser.Scene & {
  selectedBox?: BoxItemLike;
  loadedProducts: ProductId[];
  shelfSlots: ShelfSlotLike[];
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  cartCountText: Phaser.GameObjects.Text;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  shiftEnded: boolean;
  storeOpen: boolean;
  stocked: number;
  hintText: Phaser.GameObjects.Text;
  restockBusy?: boolean;
  showTransientHint: (message: string) => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  updateHud: () => void;
  loadSelectedBox: () => void;
  recordRestockCombo: () => void;
  openStore: () => void;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
};

type ScenePrototype = {
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItemLike;
  selectBox: (item: BoxItemLike) => void;
  createCart: () => void;
  handleCartTap: () => void;
  tryRestockSlot: (slot: ShelfSlotLike) => void;
  updateHud: () => void;
};

const CART_HOME = { x: 505, y: 850 };
const CART_SALES = { x: 760, y: 850 };
const WORKER_HOME = { x: 490, y: 565 };
const WORKER_SALES_HOME = { x: 715, y: 755 };
const DOORWAY_X = 690;

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalSpawnBox = prototype.spawnBox;
const originalCreateCart = prototype.createCart;
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

  // Selection must be idempotent. Repeated clicks never change image scale.
  scene.selectedBox = item;
  item.image.setTint(0xfff0a6);
  scene.setWorkerTexture(Assets.characters.workerCarry, 255, 500);
  scene.updateHud();
};

prototype.spawnBox = function spawnBoxWithLogicalDrag(
  productId: ProductId,
  positionIndex: number,
  renewable: boolean
): BoxItemLike {
  const scene = this as unknown as SceneInternals;
  const item = originalSpawnBox.call(this, productId, positionIndex, renewable);
  installBoxDrag(scene, item);
  return item;
};

prototype.createCart = function createCartWithAislePlacement(): void {
  const scene = this as unknown as SceneInternals;
  originalCreateCart.call(this);

  // Clear operating aisle: stock stays left, worker and cart use the right side.
  scene.cart.setPosition(CART_HOME.x, CART_HOME.y);
  scene.worker.setPosition(WORKER_HOME.x, WORKER_HOME.y);
  installCartDrag(scene);
};

prototype.handleCartTap = function handleCartTapWithoutTeleport(): void {
  const scene = this as unknown as SceneInternals;
  if (scene.shiftEnded || scene.movingCart) return;

  if (scene.selectedBox) {
    markCartLoadBusy(scene);
    scene.loadSelectedBox();
    return;
  }

  if (!scene.cartAtShelf && scene.loadedProducts.length >= GAME_RULES.firstMoveRequirement) {
    scene.showTransientHint("Cart ready. Drag it through the doorway to the sales floor.");
    return;
  }

  if (!scene.cartAtShelf) {
    scene.showTransientHint(
      `Load ${GAME_RULES.firstMoveRequirement - scene.loadedProducts.length} more box(es) before moving the cart.`
    );
    return;
  }

  if (scene.loadedProducts.length === 0) {
    scene.showTransientHint("The cart is empty. Bring a reserve box from the backroom.");
  }
};

prototype.tryRestockSlot = function tryRestockWithWorkerMovement(slot: ShelfSlotLike): void {
  const scene = this as unknown as SceneInternals;

  if (scene.shiftEnded || scene.movingCart || !scene.cartAtShelf || scene.restockBusy) return;
  if (slot.product || slot.reservedForCustomer) return;

  const productIndex = scene.loadedProducts.indexOf(slot.productId);
  if (productIndex < 0) {
    scene.showTransientHint(`This slot needs ${PRODUCTS[slot.productId].label}. Bring the matching box.`);
    return;
  }

  scene.restockBusy = true;
  scene.loadedProducts.splice(productIndex, 1);
  scene.cartCountText.setText(`${scene.loadedProducts.length}/${GAME_RULES.cartCapacity}`);

  const product = scene.add.image(scene.cart.x + 20, scene.cart.y - 55, PRODUCTS[slot.productId].productKey)
    .setDepth(31);
  scene.fitImage(product, 72, 112);

  const pickupX = scene.cart.x - 95;
  const pickupY = scene.cart.y - 115;
  const approachX = Phaser.Math.Clamp(slot.hitArea.x - 105, 720, 1080);
  const approachY = Phaser.Math.Clamp(slot.hitArea.y + 185, 525, 760);

  scene.setWorkerTexture(Assets.characters.workerIdle, 235, 470);

  scene.tweens.add({
    targets: scene.worker,
    x: pickupX,
    y: pickupY,
    duration: 180,
    ease: "Sine.Out",
    onComplete: () => {
      scene.setWorkerTexture(Assets.characters.workerCarry, 245, 485);

      scene.tweens.add({
        targets: scene.worker,
        x: approachX,
        y: approachY,
        duration: 430,
        ease: "Sine.InOut"
      });

      scene.tweens.add({
        targets: product,
        x: slot.hitArea.x,
        y: slot.hitArea.y,
        duration: 520,
        ease: "Cubic.Out",
        onComplete: () => {
          slot.product = product;
          slot.missingTag.setVisible(false);
          scene.stocked += 1;
          scene.recordRestockCombo();

          if (scene.stocked >= scene.shelfSlots.length && !scene.storeOpen) {
            scene.openStore();
          }

          scene.setWorkerTexture(Assets.characters.workerIdle, 235, 470);
          scene.tweens.add({
            targets: scene.worker,
            x: WORKER_SALES_HOME.x,
            y: WORKER_SALES_HOME.y,
            duration: 260,
            ease: "Sine.Out"
          });

          scene.restockBusy = false;
          scene.updateHud();
        }
      });
    }
  });
};

prototype.updateHud = function updateHudForLogicalActions(): void {
  originalUpdateHud.call(this);
  const scene = this as unknown as SceneInternals;

  if (scene.shiftEnded) return;

  if (scene.restockBusy) {
    scene.hintText.setText("Worker is restocking the selected shelf slot");
    return;
  }

  if (scene.movingCart && !scene.cartAtShelf) {
    scene.hintText.setText("3. Push the cart through the doorway to the sales floor");
    return;
  }

  if (scene.selectedBox) {
    scene.hintText.setText(`2. Drag ${PRODUCTS[scene.selectedBox.productId].label} onto the cart`);
    return;
  }

  if (!scene.cartAtShelf && scene.loadedProducts.length >= GAME_RULES.firstMoveRequirement) {
    scene.hintText.setText("3. Cart ready · drag it through the doorway");
    return;
  }

  if (!scene.cartAtShelf) {
    scene.hintText.setText(
      `1. Drag boxes onto cart · ${scene.loadedProducts.length}/${GAME_RULES.firstMoveRequirement}`
    );
    return;
  }

  const missingSlots = scene.shelfSlots.filter((slot) => !slot.product).length;
  if (missingSlots > 0) {
    scene.hintText.setText(
      `Tap a matching MISSING slot · ${missingSlots} empty · cart ${scene.loadedProducts.length}/${GAME_RULES.cartCapacity}`
    );
  }
};

function installBoxDrag(scene: SceneInternals, item: BoxItemLike): void {
  const image = item.image;
  if (image.getData("logicalDragReady")) return;

  image.setData("logicalDragReady", true);
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
        Phaser.Math.Clamp(dragX, 45, 850),
        Phaser.Math.Clamp(dragY, 220, 1085)
      );

      // Worker follows with damping so the box never appears to float by itself.
      const targetWorkerX = Phaser.Math.Clamp(image.x + 100, 190, 735);
      const targetWorkerY = Phaser.Math.Clamp(image.y - 55, 360, 930);
      scene.worker.setPosition(
        Phaser.Math.Linear(scene.worker.x, targetWorkerX, 0.38),
        Phaser.Math.Linear(scene.worker.y, targetWorkerY, 0.38)
      );

      scene.cartSprite.setTint(isOverCart(scene, image) ? 0xbff3a8 : 0xffef9f);
    }
  );

  image.on("dragend", () => {
    const blocked = Boolean(image.getData("dragBlocked"));
    image.setData("dragBlocked", false);
    scene.cartSprite.clearTint();

    if (blocked) {
      returnBoxHome(scene, item, false);
      return;
    }

    if (isOverCart(scene, image)) {
      scene.selectedBox = item;
      image.setAlpha(1).setDepth(16);
      markCartLoadBusy(scene);
      scene.loadSelectedBox();
      return;
    }

    returnBoxHome(scene, item, true);
  });
}

function installCartDrag(scene: SceneInternals): void {
  const cart = scene.cart;
  if (cart.getData("logicalCartDragReady")) return;

  cart.setData("logicalCartDragReady", true);
  cart.setData("dragBlocked", false);
  cart.setData("loadBusy", false);
  scene.input.setDraggable(cart);

  cart.on("dragstart", () => {
    const blocked =
      scene.shiftEnded ||
      scene.cartAtShelf ||
      scene.movingCart ||
      Boolean(cart.getData("loadBusy")) ||
      scene.loadedProducts.length < GAME_RULES.firstMoveRequirement;

    cart.setData("dragBlocked", blocked);

    if (blocked) {
      if (!scene.cartAtShelf && scene.loadedProducts.length < GAME_RULES.firstMoveRequirement) {
        scene.showTransientHint(
          `Load ${GAME_RULES.firstMoveRequirement - scene.loadedProducts.length} more box(es) first.`
        );
      }
      return;
    }

    scene.movingCart = true;
    scene.setWorkerTexture(Assets.characters.workerPush, 275, 500);
    scene.worker.setPosition(cart.x - 115, cart.y - 70);
    cart.setDepth(38);
    scene.updateHud();
  });

  cart.on(
    "drag",
    (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (cart.getData("dragBlocked")) return;

      cart.setPosition(
        Phaser.Math.Clamp(dragX, 455, 820),
        Phaser.Math.Clamp(dragY, 760, 930)
      );

      const targetWorkerX = cart.x - 115;
      const targetWorkerY = cart.y - 70;
      scene.worker.setPosition(
        Phaser.Math.Linear(scene.worker.x, targetWorkerX, 0.45),
        Phaser.Math.Linear(scene.worker.y, targetWorkerY, 0.45)
      );
    }
  );

  cart.on("dragend", () => {
    const blocked = Boolean(cart.getData("dragBlocked"));
    cart.setData("dragBlocked", false);

    if (blocked) return;

    if (cart.x >= DOORWAY_X) {
      snapCartToSalesFloor(scene);
    } else {
      returnCartHome(scene);
    }
  });
}

function snapCartToSalesFloor(scene: SceneInternals): void {
  scene.tweens.add({
    targets: scene.cart,
    x: CART_SALES.x,
    y: CART_SALES.y,
    duration: 260,
    ease: "Sine.Out"
  });

  scene.tweens.add({
    targets: scene.worker,
    x: WORKER_SALES_HOME.x,
    y: WORKER_SALES_HOME.y,
    duration: 260,
    ease: "Sine.Out",
    onComplete: () => {
      scene.cart.setDepth(18);
      scene.cartAtShelf = true;
      scene.movingCart = false;
      scene.setWorkerTexture(Assets.characters.workerIdle, 235, 470);
      scene.updateHud();
    }
  });
}

function returnCartHome(scene: SceneInternals): void {
  scene.tweens.add({
    targets: scene.cart,
    x: CART_HOME.x,
    y: CART_HOME.y,
    duration: 220,
    ease: "Sine.Out"
  });

  scene.tweens.add({
    targets: scene.worker,
    x: WORKER_HOME.x,
    y: WORKER_HOME.y,
    duration: 220,
    ease: "Sine.Out",
    onComplete: () => {
      scene.cart.setDepth(18);
      scene.movingCart = false;
      scene.setWorkerTexture(Assets.characters.workerIdle, 250, 490);
      scene.updateHud();
    }
  });
}

function markCartLoadBusy(scene: SceneInternals): void {
  scene.cart.setData("loadBusy", true);
  scene.time.delayedCall(440, () => {
    if (scene.cart?.active) scene.cart.setData("loadBusy", false);
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

function returnBoxHome(scene: SceneInternals, item: BoxItemLike, updateHud: boolean): void {
  const image = item.image;
  const homeX = Number(image.getData("homeX"));
  const homeY = Number(image.getData("homeY"));
  const homeScaleX = Number(image.getData("homeScaleX"));
  const homeScaleY = Number(image.getData("homeScaleY"));

  if (scene.selectedBox === item) scene.selectedBox = undefined;

  image.clearTint().setAlpha(1).setDepth(16);
  scene.setWorkerTexture(
    Assets.characters.workerIdle,
    scene.cartAtShelf ? 235 : 250,
    scene.cartAtShelf ? 470 : 490
  );

  const workerHome = scene.cartAtShelf ? WORKER_SALES_HOME : WORKER_HOME;

  scene.tweens.add({
    targets: image,
    x: homeX,
    y: homeY,
    scaleX: homeScaleX,
    scaleY: homeScaleY,
    duration: 220,
    ease: "Sine.Out"
  });

  scene.tweens.add({
    targets: scene.worker,
    x: workerHome.x,
    y: workerHome.y,
    duration: 220,
    ease: "Sine.Out",
    onComplete: () => {
      if (updateHud) scene.updateHud();
    }
  });
}
