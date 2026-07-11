import Phaser from "phaser";
import { Assets } from "./assets";
import type { LevelId, ShiftPhase } from "./domain/gameTypes";
import { GAME_RULES } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import type { ShiftTransition } from "./systems/ShiftManager";

type RuntimeGameScene = Phaser.Scene & {
  phase: ShiftPhase;
  soldCount: number;
  shiftEnded: boolean;
  money: number;
  stars: number;
  stocked: number;
  combo: number;
  comboDeadline: number;
  remainingSeconds: number;
  customerSequence: number;
  reserveStockStarted: boolean;

  boxes: unknown[];
  shelfSlots: unknown[];
  selectedBox?: unknown;
  loadedProducts: unknown[];
  nextBoxId: number;

  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;

  guideMode: string;
  guideTween?: Phaser.Tweens.Tween;
  highlightedMissing?: Phaser.GameObjects.Image;
  highlightedMissingScale?: { x: number; y: number };
  pauseOverlay?: Phaser.GameObjects.Container;

  purchaseEvent?: Phaser.Time.TimerEvent;
  timerEvent?: Phaser.Time.TimerEvent;
  __pendingShiftTransition?: ShiftTransition;
  __rushPreparing?: boolean;
  __rushCountdown?: Phaser.GameObjects.Container;

  showPhaseBanner: (text: string) => void;
  showTransientHint: (message: string) => void;
  startCustomerLoop: (delay: number) => void;
  updateHud: () => void;
};

type GameScenePrototype = {
  create: () => void;
  advanceBusinessPhase: () => void;
  updateStars: () => void;
};

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithCanonicalShiftSession(): void {
  const scene = this as unknown as RuntimeGameScene;

  // Phaser restarts reuse the same Scene instance. Class field initializers are NOT
  // run again, so arrays/counters from the previous day must be cleared explicitly.
  resetRestartableSceneState(scene);

  gameSession.reset(resolveActiveDay());
  installCanonicalSessionAccessors(scene);
  scene.remainingSeconds = GAME_RULES.shiftSeconds;

  originalCreate.call(this);
  scene.stars = gameSession.performanceStars;

  gameSession.syncPresentation({
    money: scene.money,
    stocked: scene.stocked,
    shiftEnded: scene.shiftEnded
  });
};

prototype.updateStars = function updatePerformanceStars(): void {
  const scene = this as unknown as RuntimeGameScene;
  scene.stars = gameSession.performanceStars;
};

prototype.advanceBusinessPhase = function advanceBusinessPhaseFromShiftManager(): void {
  const scene = this as unknown as RuntimeGameScene;
  const transition = scene.__pendingShiftTransition;
  scene.__pendingShiftTransition = undefined;

  if (!transition) return;

  if (transition.to === "RUSH") {
    beginRushPreparation(scene);
    return;
  }

  if (transition.to === "CLOSING") {
    scene.__rushPreparing = false;
    scene.__rushCountdown?.destroy(true);
    scene.__rushCountdown = undefined;
    scene.stars = gameSession.performanceStars;
    scene.purchaseEvent?.remove(false);
    scene.showPhaseBanner("CLOSING TIME");
    scene.showTransientHint("Customers are done. Return the cart to the backroom to finish the shift.");
    scene.updateHud();
  }
};

function beginRushPreparation(scene: RuntimeGameScene): void {
  if (scene.__rushPreparing || scene.shiftEnded) return;

  scene.__rushPreparing = true;
  scene.purchaseEvent?.remove(false);
  scene.stars = gameSession.performanceStars;
  scene.showTransientHint("Lunch rush starts in 8 seconds. Fill urgent gaps and prepare Back Stock now.");
  scene.updateHud();

  scene.__rushCountdown?.destroy(true);
  const background = scene.add.rectangle(665, 300, 560, 118, 0x7b3f16, 0.96)
    .setStrokeStyle(5, 0xffd75a);
  const title = scene.add.text(665, 272, "RUSH PREPARATION", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#fff2bd",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5);
  const countdown = scene.add.text(665, 318, "RUSH IN 8", {
    fontFamily: "Arial",
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#4b2410",
    strokeThickness: 6
  }).setOrigin(0.5);

  scene.__rushCountdown = scene.add.container(0, 0, [background, title, countdown])
    .setDepth(860)
    .setScale(0.88)
    .setAlpha(0);

  scene.tweens.add({
    targets: scene.__rushCountdown,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 180,
    ease: "Back.Out"
  });

  let seconds = 8;
  const tick = (): void => {
    if (!scene.scene.isActive() || scene.shiftEnded || !scene.__rushPreparing) {
      scene.__rushCountdown?.destroy(true);
      scene.__rushCountdown = undefined;
      return;
    }

    seconds -= 1;
    if (seconds > 0) {
      countdown.setText(`RUSH IN ${seconds}`);
      scene.tweens.add({
        targets: countdown,
        scaleX: 1.12,
        scaleY: 1.12,
        duration: 90,
        yoyo: true,
        ease: "Sine.Out"
      });
      scene.time.delayedCall(1000, tick);
      return;
    }

    scene.__rushPreparing = false;
    scene.__rushCountdown?.destroy(true);
    scene.__rushCountdown = undefined;
    scene.showPhaseBanner("LUNCH RUSH!");
    scene.showTransientHint("Rush hour: customers arrive faster. Prioritize waiting requests and matching stock.");
    scene.startCustomerLoop(GAME_RULES.customerIntervalRushMs);
    scene.updateHud();
  };

  scene.time.delayedCall(1000, tick);
}

function resetRestartableSceneState(scene: RuntimeGameScene): void {
  scene.purchaseEvent?.remove(false);
  scene.timerEvent?.remove(false);
  scene.guideTween?.stop();
  scene.__rushCountdown?.destroy(true);

  if (scene.pauseOverlay?.active) scene.pauseOverlay.destroy(true);

  scene.boxes = [];
  scene.shelfSlots = [];
  scene.loadedProducts = [];
  scene.selectedBox = undefined;
  scene.nextBoxId = 1;

  scene.cartAtShelf = false;
  scene.movingCart = false;
  scene.restockBusy = false;

  scene.stars = 0;
  scene.stocked = 0;
  scene.combo = 0;
  scene.comboDeadline = 0;
  scene.customerSequence = 0;
  scene.reserveStockStarted = false;

  scene.guideMode = "NONE";
  scene.guideTween = undefined;
  scene.highlightedMissing = undefined;
  scene.highlightedMissingScale = undefined;
  scene.pauseOverlay = undefined;
  scene.purchaseEvent = undefined;
  scene.timerEvent = undefined;
  scene.__pendingShiftTransition = undefined;
  scene.__rushPreparing = false;
  scene.__rushCountdown = undefined;
}

function installCanonicalSessionAccessors(scene: RuntimeGameScene): void {
  delete (scene as unknown as Record<string, unknown>).phase;
  delete (scene as unknown as Record<string, unknown>).soldCount;
  delete (scene as unknown as Record<string, unknown>).shiftEnded;
  delete (scene as unknown as Record<string, unknown>).money;

  Object.defineProperty(scene, "phase", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.phase,
    set: (next: ShiftPhase) => {
      if (next === gameSession.phase) return;

      if (next === "OPEN" && gameSession.phase === "PREPARE") {
        gameSession.openStore();
        scene.stars = gameSession.performanceStars;
        return;
      }

      if (next === "RESULT") {
        gameSession.finishShift();
        scene.stars = gameSession.performanceStars;
        return;
      }

      gameSession.restoreShiftState(next, gameSession.sales);
      scene.stars = gameSession.performanceStars;
    }
  });

  Object.defineProperty(scene, "soldCount", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.sales,
    set: (next: number) => {
      const normalized = Math.max(0, Math.floor(next));
      const current = gameSession.sales;
      if (normalized === current) return;

      if (normalized === current + 1) {
        scene.__pendingShiftTransition = gameSession.recordSale();
        scene.stars = gameSession.performanceStars;
        return;
      }

      gameSession.restoreShiftState(gameSession.phase, normalized);
      scene.stars = gameSession.performanceStars;
    }
  });

  Object.defineProperty(scene, "shiftEnded", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.snapshot.shiftEnded,
    set: (ended: boolean) => gameSession.setShiftEnded(Boolean(ended))
  });

  Object.defineProperty(scene, "money", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.coins,
    set: (coins: number) => gameSession.setCoins(coins)
  });
}

function resolveActiveDay(): LevelId {
  const queryDay = new URLSearchParams(window.location.search).get("day");
  if (queryDay === "3" || queryDay === "day03") return "day03";
  if (queryDay === "2" || queryDay === "day02") return "day02";

  try {
    const stored = localStorage.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
    return "day01";
  } catch {
    return "day01";
  }
}

void Assets.characters.workerIdle;
