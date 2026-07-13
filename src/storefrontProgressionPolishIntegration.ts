import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { bestStarsFor } from "./systems/StorefrontProgress";

type RuntimeStorefront = Phaser.Scene & {
  showToast: (message: string) => void;
};

type StorefrontPrototype = {
  createDayCard: (
    day: Extract<LevelId, "day01" | "day02">,
    x: number,
    y: number
  ) => Phaser.GameObjects.Container;
  startShift: (day: LevelId) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalDayCard = prototype.createDayCard;
const originalStartShift = prototype.startShift;

prototype.createDayCard = function createDayCardWithLockState(
  day: Extract<LevelId, "day01" | "day02">,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const scene = this as unknown as RuntimeStorefront;
  const card = originalDayCard.call(this, day, x, y);
  const locked = day === "day02" && bestStarsFor("day01") <= 0;
  if (!locked) return card;

  for (const child of card.list) {
    const interactive = child as Phaser.GameObjects.GameObject & { disableInteractive?: () => void };
    interactive.disableInteractive?.();
  }

  const cover = scene.add.rectangle(0, 0, 300, 300, 0x0b1214, 0.82)
    .setStrokeStyle(4, 0x657174);
  const lock = scene.add.text(0, -38, "LOCKED", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#c6d0d2",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const title = scene.add.text(0, 28, "DAY 2", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const reason = scene.add.text(0, 82, "COMPLETE DAY 1", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffd98a",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, 320, 320, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => scene.showToast("DAY 2 is locked. Complete the full Day 1 shift first."));
  card.add([cover, lock, title, reason, hit]);
  return card;
};

prototype.startShift = function startOnlyUnlockedShift(day: LevelId): void {
  const scene = this as unknown as RuntimeStorefront;
  if (day === "day02" && bestStarsFor("day01") <= 0) {
    scene.showToast("DAY 2 is locked. Complete Day 1, close the store and collect a result first.");
    return;
  }
  originalStartShift.call(this, day);
};
