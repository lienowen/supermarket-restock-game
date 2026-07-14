import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import type { ProductId } from "./gameConfig";

type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
type CartDestination = "WAREHOUSE" | "SALES";

type RuntimeGame = Phaser.Scene & {
  phase: ShiftPhase;
  shiftEnded: boolean;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  loadedProducts: ProductId[];
  departureRequirement: () => number;
  snapCart: (destination: CartDestination) => void;
  clearGuide: () => void;
  updateCartCount: () => void;
  updateHud: () => void;
  showTransientHint: (message: string) => void;
  __day3BusySince?: number;
  __day3MovingSince?: number;
  __day3MovingPosition?: { x: number; y: number };
  __day3RecoveryHintShown?: boolean;
  __day3CartReadyAction?: Phaser.GameObjects.Text;
  __day3RecoveryMonitor?: () => void;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    __DAY3_DEADLOCK_TEST__?: {
      prepare: () => void;
      state: () => {
        restockBusy: boolean;
        movingCart: boolean;
        cartAtShelf: boolean;
        loadedCount: number;
      };
    };
  }
}

const BUSY_RECOVERY_MS = 2_800;
const MOVEMENT_RECOVERY_MS = 1_500;
const DOORWAY_X = 690;
const CART_HOME = { x: 505, y: 850 };

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithDayThreeDeadlockRecovery(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day03") return;

  installCartTapFallback(scene);
  createCartReadyAction(scene);
  installRecoveryMonitor(scene);
  installRegressionHook(scene);
};

function installCartTapFallback(scene: RuntimeGame): void {
  const cart = scene.cart;
  if (!cart?.active) return;

  cart.setSize(470, 430);
  cart.setInteractive(
    new Phaser.Geom.Rectangle(-235, -350, 470, 430),
    Phaser.Geom.Rectangle.Contains
  );
  scene.input.setDraggable(cart);

  cart.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    cart.setData("day3TapStartX", pointer.x);
    cart.setData("day3TapStartY", pointer.y);
  });

  cart.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    const startX = Number(cart.getData("day3TapStartX") ?? pointer.x);
    const startY = Number(cart.getData("day3TapStartY") ?? pointer.y);
    const distance = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
    if (distance > 18) return;

    // immediateCartDrag uses a zero movement threshold, so a plain click can fire
    // dragstart/dragend and schedule a snap back to the warehouse. Run after those
    // listeners, cancel their tween, reset movement state and treat the gesture as
    // the intended full-cart click.
    scene.time.delayedCall(0, () => {
      if (!scene.scene.isActive()) return;
      scene.tweens.killTweensOf(scene.cart);
      scene.tweens.killTweensOf(scene.worker);
      scene.movingCart = false;
      scene.cart.setData("immediateDragBlocked", false);
      scene.cart.setData("dragBlocked", false);
      moveReadyCartToSales(scene);
    });
  });
}

function createCartReadyAction(scene: RuntimeGame): void {
  const action = scene.add.text(600, 965, "FULL CART · DRAG OR TAP TO MOVE →", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#315f4b",
    padding: { x: 15, y: 9 }
  })
    .setOrigin(0.5)
    .setDepth(96)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });

  action.on("pointerdown", () => moveReadyCartToSales(scene));
  scene.__day3CartReadyAction = action;
}

function installRecoveryMonitor(scene: RuntimeGame): void {
  let lastCheck = -Infinity;
  const monitor = (): void => {
    if (scene.time.now - lastCheck < 120) return;
    lastCheck = scene.time.now;

    recoverStaleRestock(scene);
    recoverStaleMovement(scene);
    syncReadyAction(scene);

    if (scene.cartAtShelf && !scene.restockBusy && !scene.movingCart) {
      document.body.dataset.day3DeadlockRecovery = "ready";
    }
  };

  scene.__day3RecoveryMonitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.__day3CartReadyAction?.destroy();
    scene.__day3CartReadyAction = undefined;
    scene.__day3RecoveryMonitor = undefined;
    delete document.body.dataset.day3DeadlockRecovery;
    if (window.__DAY3_DEADLOCK_TEST__) delete window.__DAY3_DEADLOCK_TEST__;
  });
}

function recoverStaleRestock(scene: RuntimeGame): void {
  if (!scene.restockBusy) {
    scene.__day3BusySince = undefined;
    scene.__day3RecoveryHintShown = false;
    return;
  }

  scene.__day3BusySince ??= scene.time.now;
  if (scene.time.now - scene.__day3BusySince < BUSY_RECOVERY_MS) return;

  scene.restockBusy = false;
  scene.cart.setData("immediateDragBlocked", false);
  scene.cart.setData("dragBlocked", false);
  scene.__day3BusySince = undefined;
  scene.updateHud();

  if (!scene.__day3RecoveryHintShown) {
    scene.__day3RecoveryHintShown = true;
    scene.showTransientHint("Cart controls restored. Drag or tap the loaded cart to continue.");
  }
}

function recoverStaleMovement(scene: RuntimeGame): void {
  if (!scene.movingCart) {
    scene.__day3MovingSince = undefined;
    scene.__day3MovingPosition = undefined;
    return;
  }

  const position = scene.__day3MovingPosition;
  if (!position || Math.abs(position.x - scene.cart.x) > 2 || Math.abs(position.y - scene.cart.y) > 2) {
    scene.__day3MovingSince = scene.time.now;
    scene.__day3MovingPosition = { x: scene.cart.x, y: scene.cart.y };
    return;
  }

  scene.__day3MovingSince ??= scene.time.now;
  if (scene.time.now - scene.__day3MovingSince < MOVEMENT_RECOVERY_MS) return;

  scene.movingCart = false;
  scene.cart.setData("immediateDragBlocked", false);
  scene.cart.setData("dragBlocked", false);
  scene.snapCart(scene.cart.x >= DOORWAY_X ? "SALES" : "WAREHOUSE");
  scene.__day3MovingSince = undefined;
  scene.__day3MovingPosition = undefined;
}

function syncReadyAction(scene: RuntimeGame): void {
  const required = Math.max(1, scene.departureRequirement());
  const ready =
    !scene.shiftEnded &&
    !scene.cartAtShelf &&
    !scene.movingCart &&
    scene.loadedProducts.length >= required;

  scene.__day3CartReadyAction?.setVisible(ready);
}

function moveReadyCartToSales(scene: RuntimeGame): void {
  if (scene.time.paused || scene.shiftEnded || scene.cartAtShelf || scene.movingCart) return;

  const required = Math.max(1, scene.departureRequirement());
  if (scene.loadedProducts.length < required) {
    scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more box(es) before leaving.`);
    return;
  }

  if (scene.restockBusy) {
    const busySince = scene.__day3BusySince ?? scene.time.now;
    if (scene.time.now - busySince < BUSY_RECOVERY_MS) {
      scene.showTransientHint("Finishing the current shelf action. Try again in a moment.");
      return;
    }
    scene.restockBusy = false;
  }

  scene.clearGuide();
  scene.movingCart = true;
  scene.cart.setData("immediateDragBlocked", false);
  scene.cart.setData("dragBlocked", false);
  scene.snapCart("SALES");
  scene.updateHud();
}

function installRegressionHook(scene: RuntimeGame): void {
  if (new URLSearchParams(globalThis.location?.search ?? "").get("test") !== "1") return;

  window.__DAY3_DEADLOCK_TEST__ = {
    prepare: () => {
      scene.phase = "OPEN";
      scene.shiftEnded = false;
      scene.cartAtShelf = false;
      scene.movingCart = false;
      scene.restockBusy = true;
      scene.__day3BusySince = scene.time.now - BUSY_RECOVERY_MS - 100;
      scene.cart.setPosition(CART_HOME.x, CART_HOME.y);
      scene.loadedProducts.splice(0, scene.loadedProducts.length, "cola", "water", "milk", "cola", "water", "milk");
      scene.updateCartCount();
      scene.updateHud();
      delete document.body.dataset.day3DeadlockRecovery;

      // Execute the same recovery routine deterministically for the browser test.
      // The POST_UPDATE watchdog above remains responsible for real gameplay.
      recoverStaleRestock(scene);
      syncReadyAction(scene);
    },
    state: () => ({
      restockBusy: scene.restockBusy,
      movingCart: scene.movingCart,
      cartAtShelf: scene.cartAtShelf,
      loadedCount: scene.loadedProducts.length
    })
  };
}
