import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { bestStarsFor, type ShiftResult } from "./systems/StorefrontProgress";

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  showToast: (message: string) => void;
};

type StorefrontPrototype = {
  createLobbyView: () => void;
  createResultView: (result: ShiftResult) => void;
  createDayCard: (
    day: Extract<LevelId, "day01" | "day02">,
    x: number,
    y: number
  ) => Phaser.GameObjects.Container;
  startShift: (day: LevelId) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalLobby = prototype.createLobbyView;
const originalResult = prototype.createResultView;
const originalDayCard = prototype.createDayCard;
const originalStartShift = prototype.startShift;

prototype.createLobbyView = function createLobbyWithProgressState(): void {
  originalLobby.call(this);
  const scene = this as unknown as RuntimeStorefront;
  const activeDay = resolveActiveDay();
  const completed = bestStarsFor(activeDay) > 0;

  const status = scene.add.text(1010, 575, completed
    ? "REPLAY SHIFT · CONTRACTS AND SURPRISE DUTIES ACTIVE"
    : activeDay === "day01"
      ? "NEW EMPLOYEE SHIFT · COMPLETE DAY 1 TO UNLOCK PROMOTIONS"
      : "NEW DEPARTMENT SHIFT · COMPLETE THE PROMOTION TRAINING", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: completed ? "#bfe88a" : "#ffd98a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 480 },
      backgroundColor: "#10252a",
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(14);

  scene.tweens.add({
    targets: status,
    alpha: 0.72,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
};

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
  const lock = scene.add.text(0, -38, "🔒", {
    fontFamily: "Arial",
    fontSize: "48px",
    color: "#c6d0d2"
  }).setOrigin(0.5);
  const title = scene.add.text(0, 28, "DAY 2 LOCKED", {
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

prototype.createResultView = function createResultWithProgressionReward(result: ShiftResult): void {
  originalResult.call(this, result);
  const scene = this as unknown as RuntimeStorefront;
  const unlockedDayTwo = result.day === "day01" && result.stars > 0;

  const panel = scene.add.rectangle(320, 920, 500, 160, unlockedDayTwo ? 0x1f4d36 : 0x173238, 0.98)
    .setStrokeStyle(5, unlockedDayTwo ? 0xbfe88a : 0x729097)
    .setDepth(15);
  const eyebrow = scene.add.text(320, 872, unlockedDayTwo ? "NEW CONTENT UNLOCKED" : "NEXT STORE GOAL", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: unlockedDayTwo ? "#d9f4ad" : "#a9c4c6",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(16);
  const title = scene.add.text(320, 918, unlockedDayTwo ? "DAY 2 · PROMOTION WING" : "IMPROVE YOUR BEST SHIFT", {
    fontFamily: "Arial",
    fontSize: "26px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(16);
  const detail = scene.add.text(320, 965, unlockedDayTwo
    ? "New room · checkout · returns · damaged goods"
    : "Try another contract, earn 3 stars and upgrade delivery handling", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e6df",
      align: "center",
      wordWrap: { width: 440 }
    }).setOrigin(0.5).setDepth(16);

  scene.tweens.add({
    targets: [panel, eyebrow, title, detail],
    scaleX: 1.035,
    scaleY: 1.035,
    duration: 620,
    yoyo: true,
    repeat: unlockedDayTwo ? 2 : 0,
    ease: "Sine.InOut"
  });
};

function resolveActiveDay(): Extract<LevelId, "day01" | "day02"> {
  try {
    return globalThis.localStorage?.getItem("supermarket.activeDay") === "day02" ? "day02" : "day01";
  } catch {
    return "day01";
  }
}
