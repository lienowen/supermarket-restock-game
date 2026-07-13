import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { bestStarsFor } from "./systems/StorefrontProgress";
import { gameSession } from "./systems/GameSession";

type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
};

type StorefrontPrototype = {
  resolveActiveDay: () => PlayableDay;
  setActiveDay: (day: LevelId) => void;
  openDaySelector: () => void;
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
