import Phaser from "phaser";
import { Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { bestStarsFor, clearLastShiftResult, type ShiftResult } from "./systems/StorefrontProgress";
import { gameSession } from "./systems/GameSession";

type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  startShift: (day: LevelId) => void;
};

type StorefrontPrototype = {
  resolveActiveDay: () => PlayableDay;
  setActiveDay: (day: LevelId) => void;
  openDaySelector: () => void;
  createResultView: (result: ShiftResult) => void;
};

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;

prototype.resolveActiveDay = function resolveDayThroughDay3(): PlayableDay {
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
    return "day01";
  } catch {
    return "day01";
  }
};

prototype.setActiveDay = function setPlayableDay(day: LevelId): void {
  const playable: PlayableDay = day === "day03" ? "day03" : day === "day02" ? "day02" : "day01";
  try {
    globalThis.localStorage?.setItem(ACTIVE_DAY_KEY, playable);
  } catch {
    // GameSession still keeps the active day for this browser session.
  }
  gameSession.setActiveDay(playable);
};

prototype.openDaySelector = function openThreeDaySelector(): void {
  const scene = this as unknown as RuntimeStorefront;
  if (scene.modal?.active) return;

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.8)
    .setInteractive()
    .setDepth(100);
  const panel = scene.add.rectangle(665, 570, 1120, 600, 0x10252a, 0.99)
    .setStrokeStyle(6, 0x78a465)
    .setDepth(101);
  const title = scene.add.text(665, 330, "SELECT A SHIFT", {
    fontFamily: "Arial",
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(102);

  const cards = (["day01", "day02", "day03"] as PlayableDay[]).map((day, index) =>
    createDayCard(scene, day, 330 + index * 335, 575)
  );

  const close = scene.add.text(665, 830, "CLOSE", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#34454a",
    padding: { x: 32, y: 13 }
  }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });

  close.on("pointerdown", () => {
    scene.modal?.destroy(true);
    scene.modal = undefined;
  });

  scene.modal = scene.add.container(0, 0, [shade, panel, title, ...cards, close]).setDepth(100);
};

prototype.createResultView = function createCustomerServiceResult(result: ShiftResult): void {
  const scene = this as unknown as RuntimeStorefront;
  const stars = Math.max(0, Math.min(3, result.stars));
  const dayNumber = Number(result.day.slice(-2));

  scene.add.text(100, 210, "STORE CLOSED", {
    fontFamily: "Arial",
    fontSize: "48px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#14222a",
    strokeThickness: 8
  }).setDepth(12);

  scene.add.text(104, 278, `DAY ${dayNumber} COMPLETE`, {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffd98a",
    fontStyle: "bold",
    backgroundColor: "#193144",
    padding: { x: 15, y: 9 }
  }).setDepth(12);

  scene.add.text(104, 345, result.day === "day03"
    ? "The doors are closed. Review service choices, saved customers and missed requests."
    : "The doors are closed. Review the shift, then prepare the next day.", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#e5eef2",
    lineSpacing: 8,
    wordWrap: { width: 470 }
  }).setDepth(12);

  scene.add.image(1005, 625, Assets.storefront.shiftResultPanel)
    .setDisplaySize(610, 650)
    .setDepth(10);
  scene.add.rectangle(1005, 585, 510, 430, 0x102536, 0.95)
    .setStrokeStyle(2, 0x496b7f)
    .setDepth(11);

  scene.add.text(1005, 390, result.title.toUpperCase(), {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#d7e8f3",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(12);

  scene.add.text(1005, 445, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
    fontFamily: "Arial",
    fontSize: "54px",
    color: "#ffcc3f",
    fontStyle: "bold",
    stroke: "#6d4a09",
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(12);

  scene.add.text(815, 515, [
    "SALES",
    "SATISFIED",
    "MISSED SALES",
    "WRONG STOCK",
    "BEST COMBO",
    "WALLET COINS"
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#b8cad4",
    fontStyle: "bold",
    lineSpacing: 13
  }).setOrigin(0, 0).setDepth(12);

  scene.add.text(1195, 515, [
    `${result.soldCount}/${result.salesTarget}`,
    String(result.satisfiedCustomers ?? 0),
    String(result.missedSales),
    String(result.wrongStock),
    `x${result.bestCombo}`,
    String(result.walletCoins)
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "right",
    lineSpacing: 13
  }).setOrigin(1, 0).setDepth(12);

  createAction(scene, 880, 870, 220, 96, "REPLAY", () => {
    clearLastShiftResult();
    scene.startShift(result.day);
  });

  const nextDay: PlayableDay = result.day === "day01"
    ? "day02"
    : result.day === "day02"
      ? "day03"
      : "day03";
  const continueLabel = result.day === "day03" ? "BACK TO STORE" : "CONTINUE";
  createAction(scene, 1115, 870, 270, 96, continueLabel, () => {
    prototype.setActiveDay.call(this, nextDay);
    clearLastShiftResult();
    scene.scene.restart({ showResult: false });
  });
};

function createDayCard(scene: RuntimeStorefront, day: PlayableDay, x: number, y: number): Phaser.GameObjects.Container {
  const level = LEVELS[day];
  const dayNumber = Number(day.slice(-2));
  const stars = bestStarsFor(day);
  const selected = day === prototype.resolveActiveDay.call(scene);

  const background = scene.add.rectangle(0, 0, 290, 320, selected ? 0x315f4b : 0x20343a, 1)
    .setStrokeStyle(4, selected ? 0xc7e78b : 0x6e858b);
  const dayText = scene.add.text(0, -112, `DAY ${dayNumber}`, {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#f7e8a9",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const title = scene.add.text(0, -62, level.title, {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 250 }
  }).setOrigin(0.5);
  const objective = scene.add.text(0, 12, level.objective, {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#dce9e5",
    align: "center",
    wordWrap: { width: 245 }
  }).setOrigin(0.5);
  const starText = scene.add.text(0, 82, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
    fontFamily: "Arial",
    fontSize: "30px",
    color: "#ffcc3f",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const actionText = scene.add.text(0, 126, selected ? "SELECTED" : "SELECT", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: selected ? "#4b7b55" : "#315f7d",
    padding: { x: 20, y: 10 }
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, 310, 340, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const card = scene.add.container(x, y, [background, dayText, title, objective, starText, actionText, hit])
    .setDepth(102);

  hit.on("pointerover", () => card.setScale(1.025));
  hit.on("pointerout", () => card.setScale(1));
  hit.on("pointerdown", () => {
    prototype.setActiveDay.call(scene, day);
    scene.modal?.destroy(true);
    scene.modal = undefined;
    scene.scene.restart({ showResult: false });
  });
  return card;
}

function createAction(
  scene: RuntimeStorefront,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  action: () => void
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, height, 0x315f7d, 1)
    .setStrokeStyle(4, 0xd7ecf4);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width + 24, height + 20, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const button = scene.add.container(x, y, [background, text, hit]).setDepth(14);
  let used = false;

  hit.on("pointerover", () => button.setScale(1.025));
  hit.on("pointerout", () => button.setScale(1));
  hit.on("pointerdown", () => {
    if (used) return;
    used = true;
    button.setScale(0.98);
    action();
  });
  return button;
}
