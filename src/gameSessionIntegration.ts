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
  // run again, so arrays/counters from Day 1 would otherwise survive into Day 2.
  resetRestartableSceneState(scene);

  // Resolve the day first. GAME_RULES uses runtime getters backed by GameSession,
  // so every subsequent timer/target lookup reflects the actual active day.
  gameSession.reset(resolveActiveDay());
  installCanonicalSessionAccessors(scene);

  // GameScene's class field is initialized before create(), which used to capture
  // Day 1's 180 seconds even after switching to Day 2.
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
    scene.stars = gameSession.performanceStars;
    scene.showPhaseBanner("LUNCH RUSH!");
    scene.showTransientHint("Rush hour: customers arrive faster. Prioritize matching stock.");
    scene.startCustomerLoop(GAME_RULES.customerIntervalRushMs);
    scene.updateHud();
    return;
  }

  if (transition.to === "CLOSING") {
    scene.stars = gameSession.performanceStars;
    scene.purchaseEvent?.remove(false);
    scene.showPhaseBanner("CLOSING TIME");
    scene.showTransientHint("Customers are done. Return the cart to the backroom to finish the shift.");
    scene.updateHud();
  }
};

function resetRestartableSceneState(scene: RuntimeGameScene): void {
  scene.purchaseEvent?.remove(false);
  scene.timerEvent?.remove(false);
  scene.guideTween?.stop();

  if (scene.pauseOverlay?.active) scene.pauseOverlay.destroy(true);

  scene.boxes = [];
  scene.shelfSlots = [];
  scene.loadedProducts = [];
  scene.selectedBox = undefined;
  scene.nextBoxId = 1;

  scene.cartAtShelf = false;
  scene.movingCart = false;
  scene.restockBusy = false;

  // Wallet coins deliberately survive Scene restarts and Day changes.
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
}

function installCanonicalSessionAccessors(scene: RuntimeGameScene): void {
  // TypeScript class fields create own properties. Remove them before installing
  // accessors so GameScene cannot silently maintain a second copy of canonical state.
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

      // Recovery fallback only. Normal OPEN/RUSH/CLOSING transitions are driven by
      // ShiftManager.openStore()/recordSale()/finishShift().
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

      // Used only for restart/save recovery. Normal sales must increment exactly
      // once and pass through ShiftManager.recordSale().
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
  if (queryDay === "2" || queryDay === "day02") return "day02";

  try {
    return localStorage.getItem("supermarket.activeDay") === "day02" ? "day02" : "day01";
  } catch {
    return "day01";
  }
}

void Assets.characters.workerIdle;
