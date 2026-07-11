import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeGameScene = Phaser.Scene & {
  __finalServiceActive?: boolean;
  clearGuide: () => void;
};

type GamePrototype = {
  updateHud: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalUpdateHud = prototype.updateHud;

prototype.updateHud = function updateHudWithoutPrematureClosingGuide(): void {
  const scene = this as unknown as RuntimeGameScene;
  originalUpdateHud.call(this);
  if (scene.__finalServiceActive) scene.clearGuide();
};
