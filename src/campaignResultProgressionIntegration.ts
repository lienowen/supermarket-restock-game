import Phaser from "phaser";
import { StorefrontScene } from "./scenes/StorefrontScene";
import type { ShiftResult } from "./systems/StorefrontProgress";

type StorefrontPrototype = {
  createResultView: (result: ShiftResult) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalResult = prototype.createResultView;

prototype.createResultView = function createResultWithCareerProgress(result: ShiftResult): void {
  originalResult.call(this, result);
  const scene = this as unknown as Phaser.Scene;

  const copy = result.day === "day01"
    ? {
        eyebrow: "ROLE PROGRESSION",
        title: "PROMOTION & CHECKOUT UNLOCKED",
        detail: "Day 2 adds inventory allocation, checkout, returns and damaged goods."
      }
    : result.day === "day02"
      ? {
          eyebrow: "ROLE PROGRESSION",
          title: "SHIFT SUPERVISOR UNLOCKED",
          detail: "Day 3 adds store inspection, service decisions, rush control and equipment recovery."
        }
      : {
          eyebrow: "CORE TRAINING COMPLETE",
          title: "THREE-SHIFT CAMPAIGN MASTERED",
          detail: "Replay with contracts and improve stars without adding unnecessary longer shifts."
        };

  const panel = scene.add.rectangle(665, 115, 1040, 130, 0x10252a, 0.98)
    .setStrokeStyle(5, result.day === "day03" ? 0xffd75a : 0x9bd58f)
    .setDepth(80);
  const eyebrow = scene.add.text(665, 80, copy.eyebrow, {
    fontFamily: "Arial",
    fontSize: "16px",
    color: result.day === "day03" ? "#ffd75a" : "#bceead",
    fontStyle: "bold",
    letterSpacing: 3
  }).setOrigin(0.5).setDepth(81);
  const title = scene.add.text(665, 115, copy.title, {
    fontFamily: "Arial",
    fontSize: "28px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(81);
  const detail = scene.add.text(665, 150, copy.detail, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#d7e6df",
    align: "center",
    wordWrap: { width: 900 }
  }).setOrigin(0.5).setDepth(81);

  scene.tweens.add({
    targets: [panel, eyebrow, title, detail],
    scaleX: 1.025,
    scaleY: 1.025,
    duration: 520,
    yoyo: true,
    repeat: 1,
    ease: "Sine.InOut"
  });
};
