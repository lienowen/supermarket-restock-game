import Phaser from "phaser";
import { GAME_RULES } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { BackStockScene } from "./scenes/BackStockScene";
import { gameSession } from "./systems/GameSession";
import type { ShiftTransition } from "./systems/ShiftManager";

const FINAL_WAVE_SECONDS = 18;

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  soldCount: number;
  stocked: number;
  shelfSlots: unknown[];
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  remainingSeconds: number;
  purchaseEvent?: Phaser.Time.TimerEvent;
  timerEvent?: Phaser.Time.TimerEvent;
  taskText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  __pendingShiftTransition?: ShiftTransition;
  __finalServiceActive?: boolean;
  __finalServiceSeconds?: number;
  __closingTaskReady?: boolean;
  __closeStoreConfirmed?: boolean;
  __closeStoreButton?: Phaser.GameObjects.Container;
  __finalWavePanel?: Phaser.GameObjects.Container;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
  startCustomerLoop: (delay: number) => void;
  updateTimerText: () => void;
  updateHud: () => void;
};

type GamePrototype = {
  advanceBusinessPhase: () => void;
  updateHud: () => void;
  endShift: () => void;
};

type RuntimeBackStockScene = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  panel?: Phaser.GameObjects.Container;
};

type BackStockPrototype = {
  updateVisibility: () => void;
};

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalAdvanceBusinessPhase = gamePrototype.advanceBusinessPhase;
const originalUpdateHud = gamePrototype.updateHud;
const originalEndShift = gamePrototype.endShift;

gamePrototype.advanceBusinessPhase = function advanceWithFinalWave(): void {
  const scene = this as unknown as RuntimeGameScene;
  const transition = scene.__pendingShiftTransition;

  // The first two shifts are tutorials with explicit employee checklists. Once
  // their target is complete, move directly to closing instead of spawning an
  // unexplained extra wave of customers.
  if (transition?.to === "CLOSING" && (gameSession.day === "day01" || gameSession.day === "day02")) {
    originalAdvanceBusinessPhase.call(this);
    scene.__closingTaskReady = true;
    scene.updateHud();
    return;
  }

  if (transition?.to === "CLOSING") {
    scene.__pendingShiftTransition = undefined;
    beginFinalWave(scene);
    return;
  }

  originalAdvanceBusinessPhase.call(this);
};

gamePrototype.updateHud = function updateClosingHud(): void {
  const scene = this as unknown as RuntimeGameScene;
  originalUpdateHud.call(this);

  if (scene.__finalServiceActive) {
    const seconds = Math.max(0, scene.__finalServiceSeconds ?? 0);
    scene.taskText.setText(
      `Final Wave · ${seconds}s · Sales ${scene.soldCount} · Shelf ${scene.stocked}/${scene.shelfSlots.length}`
    );
    scene.hintText.setText(
      scene.restockBusy
        ? "LAST CUSTOMERS · Finish the current restock"
        : "LAST CUSTOMERS · Save requests and fill urgent shelf gaps"
    );
    return;
  }

  if (scene.__closingTaskReady && !scene.shiftEnded) {
    scene.taskText.setText(
      `Close Store · Sales ${scene.soldCount} · Shelf ${scene.stocked}/${scene.shelfSlots.length}`
    );
    scene.hintText.setText(
      scene.cartAtShelf
        ? "FINAL TASK · Return the cart to the BACKROOM"
        : "FINAL TASK COMPLETE · Tap CLOSE STORE"
    );
  }
};

gamePrototype.endShift = function endAfterClosingTasks(): void {
  const scene = this as unknown as RuntimeGameScene;

  if (scene.__finalServiceActive) {
    scene.showTransientHint("The final customer wave is still active.");
    return;
  }

  if (scene.phase === "CLOSING" && scene.__closingTaskReady && !scene.__closeStoreConfirmed) {
    if (scene.cartAtShelf || scene.movingCart || scene.restockBusy) {
      scene.showTransientHint("Return the cart and finish the current task before closing.");
      scene.updateHud();
      return;
    }

    createCloseStoreAction(scene);
    return;
  }

  originalEndShift.call(this);
};

function beginFinalWave(scene: RuntimeGameScene): void {
  if (scene.__finalServiceActive || scene.shiftEnded) return;

  scene.__finalServiceActive = true;
  scene.__closingTaskReady = false;
  scene.__closeStoreConfirmed = false;
  scene.__finalServiceSeconds = FINAL_WAVE_SECONDS;
  scene.timerEvent?.remove(false);
  scene.timerEvent = undefined;
  scene.remainingSeconds = FINAL_WAVE_SECONDS;
  scene.updateTimerText();

  scene.showPhaseBanner("FINAL CUSTOMER WAVE");
  scene.showTransientHint("Target reached. Serve the last customers, then complete the closing tasks.");
  scene.startCustomerLoop(Math.round(GAME_RULES.customerIntervalRushMs * 1.12));
  createFinalWavePanel(scene);
  scene.updateHud();

  const tick = (): void => {
    if (!scene.scene.isActive() || scene.shiftEnded || !scene.__finalServiceActive) return;

    scene.__finalServiceSeconds = Math.max(0, (scene.__finalServiceSeconds ?? 0) - 1);
    scene.remainingSeconds = scene.__finalServiceSeconds;
    scene.updateTimerText();
    updateFinalWavePanel(scene);
    scene.updateHud();

    if ((scene.__finalServiceSeconds ?? 0) > 0) {
      scene.time.delayedCall(1000, tick);
      return;
    }

    finishFinalWave(scene);
  };

  scene.time.delayedCall(1000, tick);
}

function finishFinalWave(scene: RuntimeGameScene): void {
  scene.__finalServiceActive = false;
  scene.__closingTaskReady = true;
  scene.purchaseEvent?.remove(false);
  scene.purchaseEvent = undefined;
  scene.__finalWavePanel?.destroy(true);
  scene.__finalWavePanel = undefined;

  scene.showPhaseBanner("FINAL RESTOCK");
  scene.showTransientHint("Customers have left. Finish the shelf, return the cart, then close the store.");
  scene.updateHud();

  if (!scene.cartAtShelf && !scene.movingCart && !scene.restockBusy) {
    createCloseStoreAction(scene);
  }
}

function createFinalWavePanel(scene: RuntimeGameScene): void {
  scene.__finalWavePanel?.destroy(true);
  const background = scene.add.rectangle(0, 0, 430, 88, 0x7b3f16, 0.96)
    .setStrokeStyle(4, 0xffd75a);
  const title = scene.add.text(-145, -19, "LAST CUSTOMERS", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffeaa0",
    fontStyle: "bold",
    letterSpacing: 2
  });
  const countdown = scene.add.text(145, 0, String(FINAL_WAVE_SECONDS), {
    fontFamily: "Arial",
    fontSize: "42px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#4a2310",
    strokeThickness: 6
  }).setOrigin(0.5).setName("final-wave-countdown");

  scene.__finalWavePanel = scene.add.container(665, 210, [background, title, countdown])
    .setDepth(850)
    .setScale(0.86)
    .setAlpha(0);
  scene.tweens.add({
    targets: scene.__finalWavePanel,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 170,
    ease: "Back.Out"
  });
}

function updateFinalWavePanel(scene: RuntimeGameScene): void {
  const countdown = scene.__finalWavePanel?.getByName("final-wave-countdown") as Phaser.GameObjects.Text | null;
  if (!countdown) return;
  countdown.setText(String(Math.max(0, scene.__finalServiceSeconds ?? 0)));
  scene.tweens.add({
    targets: countdown,
    scaleX: 1.12,
    scaleY: 1.12,
    duration: 90,
    yoyo: true,
    ease: "Sine.Out"
  });
}

function createCloseStoreAction(scene: RuntimeGameScene): void {
  if (scene.__closeStoreButton?.active || scene.shiftEnded) return;

  const background = scene.add.rectangle(0, 0, 360, 88, 0x4a8750, 1)
    .setStrokeStyle(5, 0xd8ed9d)
    .setInteractive({ useHandCursor: true });
  const label = scene.add.text(0, 0, "CLOSE STORE", {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5);
  const button = scene.add.container(665, 1018, [background, label])
    .setDepth(880)
    .setScale(0.9)
    .setAlpha(0);
  scene.__closeStoreButton = button;

  scene.tweens.add({
    targets: button,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 160,
    ease: "Back.Out"
  });

  background.on("pointerover", () => button.setScale(1.025));
  background.on("pointerout", () => button.setScale(1));
  background.on("pointerdown", () => {
    if (scene.__closeStoreConfirmed) return;
    scene.__closeStoreConfirmed = true;
    button.disableInteractive();
    button.destroy(true);
    scene.__closeStoreButton = undefined;
    scene.showPhaseBanner("STORE CLOSED");

    const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x071010, 0)
      .setDepth(890);
    scene.tweens.add({
      targets: shade,
      alpha: 0.62,
      duration: 520,
      ease: "Sine.InOut",
      onComplete: () => {
        shade.destroy();
        originalEndShift.call(scene as unknown as GameScene);
      }
    });
  });
}

const backStockPrototype = BackStockScene.prototype as unknown as BackStockPrototype;
const originalBackStockVisibility = backStockPrototype.updateVisibility;

backStockPrototype.updateVisibility = function showBackStockDuringFinalWave(): void {
  originalBackStockVisibility.call(this);
  const scene = this as unknown as RuntimeBackStockScene;
  if (scene.gameScene?.__finalServiceActive && scene.panel) {
    scene.panel.setVisible(true);
  }
};
