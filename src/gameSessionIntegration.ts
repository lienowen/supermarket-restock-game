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
  stocked: number;
  purchaseEvent?: Phaser.Time.TimerEvent;
  __pendingShiftTransition?: ShiftTransition;
  showPhaseBanner: (text: string) => void;
  showTransientHint: (message: string) => void;
  startCustomerLoop: (delay: number) => void;
  updateHud: () => void;
};

type GameScenePrototype = {
  create: () => void;
  advanceBusinessPhase: () => void;
};

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithCanonicalShiftSession(): void {
  const scene = this as unknown as RuntimeGameScene;

  gameSession.reset(resolveActiveDay());
  installCanonicalShiftAccessors(scene);
  originalCreate.call(this);

  // Money/shelf counts remain presentation metrics for now. Shift state does not:
  // phase, sales and shift-ended are already read from GameSession accessors.
  gameSession.syncPresentation({
    money: scene.money,
    stocked: scene.stocked,
    shiftEnded: scene.shiftEnded
  });
};

prototype.advanceBusinessPhase = function advanceBusinessPhaseFromShiftManager(): void {
  const scene = this as unknown as RuntimeGameScene;
  const transition = scene.__pendingShiftTransition;
  scene.__pendingShiftTransition = undefined;

  if (!transition) return;

  if (transition.to === "RUSH") {
    scene.showPhaseBanner("LUNCH RUSH!");
    scene.showTransientHint("Rush hour: customers arrive faster. Prioritize matching stock.");
    scene.startCustomerLoop(GAME_RULES.customerIntervalRushMs);
    scene.updateHud();
    return;
  }

  if (transition.to === "CLOSING") {
    scene.purchaseEvent?.remove(false);
    scene.showPhaseBanner("CLOSING TIME");
    scene.showTransientHint("Customers are done. Return the cart to the backroom to finish the shift.");
    scene.updateHud();
  }
};

function installCanonicalShiftAccessors(scene: RuntimeGameScene): void {
  // TypeScript class fields create own properties. Remove them before installing
  // accessors so GameScene cannot silently maintain a second copy of shift state.
  delete (scene as unknown as Record<string, unknown>).phase;
  delete (scene as unknown as Record<string, unknown>).soldCount;
  delete (scene as unknown as Record<string, unknown>).shiftEnded;

  Object.defineProperty(scene, "phase", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.phase,
    set: (next: ShiftPhase) => {
      if (next === gameSession.phase) return;

      if (next === "OPEN" && gameSession.phase === "PREPARE") {
        gameSession.openStore();
        return;
      }

      if (next === "RESULT") {
        gameSession.finishShift();
        return;
      }

      // Recovery fallback only. Normal OPEN/RUSH/CLOSING transitions are driven by
      // ShiftManager.openStore()/recordSale()/finishShift().
      gameSession.restoreShiftState(next, gameSession.sales);
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
        return;
      }

      // Used only for restart/save recovery. Normal sales must increment exactly
      // once and pass through ShiftManager.recordSale().
      gameSession.restoreShiftState(gameSession.phase, normalized);
    }
  });

  Object.defineProperty(scene, "shiftEnded", {
    configurable: true,
    enumerable: true,
    get: () => gameSession.snapshot.shiftEnded,
    set: (ended: boolean) => gameSession.setShiftEnded(Boolean(ended))
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

// Keep the import referenced in production bundles; this also makes accidental
// removal of character assets visible to TypeScript during refactors.
void Assets.characters.workerIdle;
