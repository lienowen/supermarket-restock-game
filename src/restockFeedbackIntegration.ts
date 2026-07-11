import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeSlot = {
  hitArea: Phaser.GameObjects.Rectangle;
  product?: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  restockBusy: boolean;
  combo: number;
  shiftEnded: boolean;
};

type GameScenePrototype = {
  tryRestockSlot: (slot: RuntimeSlot) => void;
  recordRestockCombo: () => void;
};

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalTryRestockSlot = prototype.tryRestockSlot;
const originalRecordRestockCombo = prototype.recordRestockCombo;

prototype.tryRestockSlot = function tryRestockWithImmediateFeedback(slot: RuntimeSlot): void {
  const scene = this as unknown as RuntimeGameScene;
  const alreadyStocked = Boolean(slot.product);
  originalTryRestockSlot.call(this, slot);

  if (alreadyStocked || !scene.restockBusy) return;

  scene.time.delayedCall(720, () => {
    if (!scene.scene.isActive() || scene.shiftEnded || !slot.product) return;
    showShelfFillFeedback(scene, slot);
  });
};

prototype.recordRestockCombo = function recordRestockComboForResults(): void {
  const scene = this as unknown as RuntimeGameScene;
  originalRecordRestockCombo.call(this);
  gameSession.recordCombo(scene.combo);

  if (scene.combo < 2) return;

  const text = scene.add.text(1015, 255, `RESTOCK COMBO x${scene.combo}`, {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#fff3a6",
    fontStyle: "bold",
    stroke: "#315321",
    strokeThickness: 7
  }).setOrigin(0.5).setDepth(540).setScale(0.78).setAlpha(0);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    y: 235,
    duration: 180,
    ease: "Back.Out",
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        alpha: 0,
        y: 205,
        delay: 520,
        duration: 260,
        ease: "Cubic.In",
        onComplete: () => text.destroy()
      });
    }
  });
};

function showShelfFillFeedback(scene: RuntimeGameScene, slot: RuntimeSlot): void {
  const x = slot.hitArea.x;
  const y = slot.hitArea.y;
  const flash = scene.add.rectangle(x, y, 126, 136, 0xb9ff8a, 0.08)
    .setStrokeStyle(5, 0xd8ffae, 1)
    .setDepth(535)
    .setScale(0.82)
    .setAlpha(0);
  const text = scene.add.text(x, y - 92, "SHELF FILLED", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#eaffd5",
    fontStyle: "bold",
    stroke: "#25451e",
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(536).setAlpha(0);

  scene.tweens.add({
    targets: [flash, text],
    alpha: 1,
    duration: 100,
    ease: "Sine.Out"
  });
  scene.tweens.add({
    targets: flash,
    scaleX: 1.08,
    scaleY: 1.08,
    alpha: 0,
    duration: 460,
    ease: "Cubic.Out",
    onComplete: () => flash.destroy()
  });
  scene.tweens.add({
    targets: text,
    y: text.y - 34,
    alpha: 0,
    delay: 240,
    duration: 420,
    ease: "Cubic.Out",
    onComplete: () => text.destroy()
  });
}
