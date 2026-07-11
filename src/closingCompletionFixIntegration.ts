import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  cart: Phaser.GameObjects.Container;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  hintText: Phaser.GameObjects.Text;
  __closingTaskReady?: boolean;
  __closeStoreConfirmed?: boolean;
  __closeStoreButton?: Phaser.GameObjects.Container;
  __closingGuideGraphics?: Phaser.GameObjects.Graphics;
  __closingGuidePanel?: Phaser.GameObjects.Container;
  __closingGuideText?: Phaser.GameObjects.Text;
  __closingGuidePulse?: Phaser.Tweens.Tween;
  __closingAutoFinishQueued?: boolean;
  __closingCompletionMonitor?: () => void;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
  updateHud: () => void;
  endShift: () => void;
};

type GamePrototype = {
  create: () => void;
  updateHud: () => void;
  endShift: () => void;
};

const WAREHOUSE_COMPLETE_X = 620;
const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalUpdateHud = prototype.updateHud;
const originalEndShift = prototype.endShift;

prototype.create = function createWithReliableClosingCompletion(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;

  scene.__closingAutoFinishQueued = false;
  const monitor = (): void => monitorClosingCompletion(scene);
  scene.__closingCompletionMonitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    destroyClosingGuide(scene);
    scene.__closingCompletionMonitor = undefined;
    scene.__closingAutoFinishQueued = false;
  });
};

prototype.updateHud = function updateHudWithClosingInstruction(): void {
  originalUpdateHud.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (!isClosingTask(scene)) return;

  const cartParked = isCartParkedInWarehouse(scene);
  scene.hintText.setText(
    cartParked
      ? "CART PARKED · Closing store automatically…"
      : "FINAL STEP · Drag the cart LEFT into the BACKROOM"
  );
};

prototype.endShift = function endShiftAfterCartIsParked(): void {
  const scene = this as unknown as RuntimeGameScene;

  if (isClosingTask(scene)) {
    if (!isCartParkedInWarehouse(scene) || scene.movingCart || scene.restockBusy) {
      showClosingGuide(scene);
      scene.showTransientHint("Drag the cart left into the backroom. The shift will finish automatically.");
      scene.updateHud();
      return;
    }

    scene.__closeStoreConfirmed = true;
    scene.__closeStoreButton?.destroy(true);
    scene.__closeStoreButton = undefined;
    destroyClosingGuide(scene);
  }

  originalEndShift.call(this);
};

function monitorClosingCompletion(scene: RuntimeGameScene): void {
  if (!scene.scene.isActive() || !isClosingTask(scene)) {
    destroyClosingGuide(scene);
    scene.__closingAutoFinishQueued = false;
    return;
  }

  // The old button could remain visible after the cart was moved again. Removing it
  // keeps the closing rule unambiguous: park the cart and the game completes itself.
  scene.__closeStoreButton?.destroy(true);
  scene.__closeStoreButton = undefined;

  if (!isCartParkedInWarehouse(scene) || scene.movingCart || scene.restockBusy) {
    scene.__closingAutoFinishQueued = false;
    showClosingGuide(scene);
    updateClosingGuide(scene);
    return;
  }

  destroyClosingGuide(scene);
  if (scene.__closingAutoFinishQueued) return;
  scene.__closingAutoFinishQueued = true;
  scene.__closeStoreConfirmed = true;
  scene.hintText.setText("CART PARKED · Locking the doors…");
  scene.showPhaseBanner("CLOSING STORE");

  scene.time.delayedCall(650, () => {
    if (!scene.scene.isActive() || scene.shiftEnded || !isClosingTask(scene)) return;
    if (!isCartParkedInWarehouse(scene) || scene.movingCart || scene.restockBusy) {
      scene.__closingAutoFinishQueued = false;
      return;
    }
    scene.endShift();
  });
}

function isClosingTask(scene: RuntimeGameScene): boolean {
  return scene.phase === "CLOSING" && Boolean(scene.__closingTaskReady) && !scene.shiftEnded;
}

function isCartParkedInWarehouse(scene: RuntimeGameScene): boolean {
  // Use the actual visual position as the source of truth. This also recovers from
  // any stale cartAtShelf flag left by interrupted drag/snap animations.
  return scene.cart.x <= WAREHOUSE_COMPLETE_X && !scene.cartAtShelf;
}

function showClosingGuide(scene: RuntimeGameScene): void {
  if (!scene.__closingGuideGraphics?.active) {
    scene.__closingGuideGraphics = scene.add.graphics().setDepth(1600);
  }

  if (!scene.__closingGuidePanel?.active) {
    const background = scene.add.rectangle(0, 0, 720, 92, 0x7a3d13, 0.98)
      .setStrokeStyle(5, 0xffd75a);
    const eyebrow = scene.add.text(0, -22, "FINAL STEP", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffe59a",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5);
    const text = scene.add.text(0, 19, "DRAG CART LEFT → BACKROOM", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    scene.__closingGuideText = text;
    scene.__closingGuidePanel = scene.add.container(665, 905, [background, eyebrow, text])
      .setDepth(1601)
      .setScale(0.94);

    scene.__closingGuidePulse?.stop();
    scene.__closingGuidePulse = scene.tweens.add({
      targets: scene.__closingGuidePanel,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }
}

function updateClosingGuide(scene: RuntimeGameScene): void {
  const graphics = scene.__closingGuideGraphics;
  if (!graphics?.active || !scene.cart?.active) return;

  const cartX = scene.cart.x;
  const arrowY = Math.max(560, scene.cart.y - 230);
  const targetX = 535;

  graphics.clear();
  graphics.lineStyle(13, 0xffd75a, 0.98);
  graphics.beginPath();
  graphics.moveTo(cartX - 10, arrowY);
  graphics.lineTo(targetX, arrowY);
  graphics.strokePath();
  graphics.fillStyle(0xffd75a, 1);
  graphics.fillTriangle(targetX - 42, arrowY, targetX + 14, arrowY - 34, targetX + 14, arrowY + 34);

  scene.__closingGuideText?.setText(
    scene.movingCart ? "KEEP DRAGGING LEFT" : "DRAG CART LEFT → BACKROOM"
  );
}

function destroyClosingGuide(scene: RuntimeGameScene): void {
  scene.__closingGuidePulse?.stop();
  scene.__closingGuidePulse = undefined;
  scene.__closingGuideGraphics?.destroy();
  scene.__closingGuideGraphics = undefined;
  scene.__closingGuidePanel?.destroy(true);
  scene.__closingGuidePanel = undefined;
  scene.__closingGuideText = undefined;
}
