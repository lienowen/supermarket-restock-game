import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeGameScene = Phaser.Scene & {
  timerEvent?: Phaser.Time.TimerEvent;
  updateTimerText: () => void;
};

type GamePrototype = {
  startShiftTimer: () => void;
  startCustomerLoop: (delay: number) => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalStartShiftTimer = prototype.startShiftTimer;
const originalStartCustomerLoop = prototype.startCustomerLoop;

prototype.startShiftTimer = function deferOperatingTimerUntilOpening(): void {
  const scene = this as unknown as RuntimeGameScene;
  scene.timerEvent?.remove(false);
  scene.timerEvent = undefined;
  scene.updateTimerText();
};

prototype.startCustomerLoop = function startCustomersAndOperatingClock(delay: number): void {
  const scene = this as unknown as RuntimeGameScene;
  if (!scene.timerEvent) originalStartShiftTimer.call(this);
  originalStartCustomerLoop.call(this, delay);
};
