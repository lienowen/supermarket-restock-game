import Phaser from "phaser";
import { OpeningScene } from "./scenes/OpeningScene";

type OpeningPrototype = {
  create: () => void;
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalCreate = prototype.create;

prototype.create = function createWithDayTwoAreaUnlock(): void {
  originalCreate.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (resolveDay() !== "day02") return;

  const background = scene.add.rectangle(665, 700, 860, 112, 0x9a4e1a, 0.97)
    .setStrokeStyle(5, 0xffd75a)
    .setDepth(80);
  const eyebrow = scene.add.text(665, 672, "THE STORE IS GETTING BIGGER", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#ffe5a1",
    fontStyle: "bold",
    letterSpacing: 3
  }).setOrigin(0.5).setDepth(81);
  const title = scene.add.text(665, 711, "NEW ROOM UNLOCKED · PROMOTION WING", {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(81);
  const subtitle = scene.add.text(665, 745, "Move through the store doorway and manage stock across two separate spaces.", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#fff0c4",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(81);
  const badge = scene.add.container(0, 0, [background, eyebrow, title, subtitle])
    .setDepth(80)
    .setAlpha(0)
    .setScale(0.9);

  scene.tweens.add({
    targets: badge,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 260,
    delay: 420,
    ease: "Back.Out"
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => badge.destroy(true));
};

function resolveDay(): "day01" | "day02" | "day03" {
  const queryDay = new URLSearchParams(window.location.search).get("day");
  if (queryDay === "3" || queryDay === "day03") return "day03";
  if (queryDay === "2" || queryDay === "day02") return "day02";
  try {
    const stored = localStorage.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
  } catch {
    // Fall back to Day 1 when storage is blocked.
  }
  return "day01";
}
