import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeSlot = {
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  hintText: Phaser.GameObjects.Text;
};

type GamePrototype = {
  create: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithMobileTouchTargets(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (!usesCoarsePointer()) return;

  scene.game.canvas.style.touchAction = "none";
  scene.input.dragDistanceThreshold = 0;
  scene.input.dragTimeThreshold = 0;

  for (const slot of scene.shelfSlots) {
    slot.hitArea.setDisplaySize(144, 164);
    slot.missingTag.setInteractive(
      new Phaser.Geom.Rectangle(
        -slot.missingTag.width * 0.18,
        -slot.missingTag.height * 0.3,
        slot.missingTag.width * 1.36,
        slot.missingTag.height * 1.6
      ),
      Phaser.Geom.Rectangle.Contains
    );
    slot.missingTag.on("pointerdown", () => {
      slot.hitArea.emit("pointerdown");
    });
  }

  scene.hintText.setFontSize(25).setWordWrapWidth(760);
};

function usesCoarsePointer(): boolean {
  try {
    return globalThis.matchMedia?.("(pointer: coarse)").matches ?? globalThis.innerWidth <= 900;
  } catch {
    return globalThis.innerWidth <= 900;
  }
}
