import Phaser from "phaser";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { gameSession } from "./systems/GameSession";
import { saveShiftResult } from "./systems/StorefrontProgress";

type RuntimeGameScene = Phaser.Scene & {
  shiftEnded: boolean;
  pauseOverlay?: Phaser.GameObjects.Container;
};

type GameScenePrototype = {
  endShift: () => void;
};

type ProgressionPrototype = {
  showNextDayButton: () => void;
};

const gamePrototype = GameScene.prototype as unknown as GameScenePrototype;
const originalEndShift = gamePrototype.endShift;

// StorefrontScene owns progression now. Suppress the old floating Day 1 button.
const progressionPrototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
progressionPrototype.showNextDayButton = function suppressLegacyNextDayButton(): void {
  // Intentionally empty.
};

gamePrototype.endShift = function endShiftThroughStorefront(): void {
  const scene = this as unknown as RuntimeGameScene;
  const alreadyEnded = scene.shiftEnded;

  originalEndShift.call(this);
  if (alreadyEnded || !scene.shiftEnded) return;

  const snapshot = gameSession.snapshot;
  const level = LEVELS[snapshot.activeDay];
  saveShiftResult(snapshot, level.title, level.salesTargets.rushToClosing);

  // Remove the prototype-era in-scene popup immediately. Results now live outside
  // the store against the nighttime storefront background.
  scene.pauseOverlay?.destroy(true);
  scene.pauseOverlay = undefined;
  scene.input.enabled = false;
  scene.tweens.resumeAll();
  scene.time.paused = false;

  scene.cameras.main.fadeOut(260, 7, 16, 18);
  scene.time.delayedCall(280, () => {
    scene.scene.start("storefront", { showResult: true });
  });
};
