import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  money: number;
  shiftEnded: boolean;
  __day2BackStockSaves?: number;
  __day2PromoBonusClaimed?: boolean;
  __day2RewardMonitor?: () => void;
  updateHud: () => void;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
};

type GamePrototype = {
  create: () => void;
};

const BONUS_TARGET = 3;
const COMPLETION_BONUS = 30;
const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithSharedDayTwoReward(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day !== "day02") return;

  const monitor = (): void => {
    if (scene.shiftEnded || scene.__day2PromoBonusClaimed) return;
    if ((scene.__day2BackStockSaves ?? 0) < BONUS_TARGET) return;

    scene.__day2PromoBonusClaimed = true;
    scene.money += COMPLETION_BONUS;
    scene.updateHud();
    scene.showPhaseBanner("PROMOTION MASTERED!");
    scene.showTransientHint(
      `Three emergency saves completed across both store rooms. Bonus +${COMPLETION_BONUS} coins.`
    );
  };

  scene.__day2RewardMonitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.__day2RewardMonitor = undefined;
  });
};
