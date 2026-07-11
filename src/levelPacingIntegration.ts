import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  remainingSeconds: number;
  updateTimerText: () => void;
  startCustomerLoop: (delay: number) => void;
};

type GamePrototype = {
  create: () => void;
  openStore: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalOpenStore = prototype.openStore;

prototype.create = function createWithLevelTiming(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  const level = LEVELS[gameSession.day];
  scene.remainingSeconds = level.shiftSeconds;
  scene.updateTimerText();
};

prototype.openStore = function openWithLevelCustomerPace(): void {
  originalOpenStore.call(this);
  const scene = this as unknown as RuntimeGameScene;
  scene.startCustomerLoop(LEVELS[gameSession.day].customerIntervalsMs.open);
};
