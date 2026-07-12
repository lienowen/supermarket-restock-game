import Phaser from "phaser";
import { OpeningScene } from "./scenes/OpeningScene";

type RuntimeOpening = Phaser.Scene & {
  __campaignBriefing?: Phaser.GameObjects.Container;
};

type OpeningPrototype = {
  create: (...args: unknown[]) => void;
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalCreate = prototype.create;

prototype.create = function createWithDistinctBriefingAndClockIn(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeOpening;
  const briefing = scene.__campaignBriefing;
  if (!briefing?.active) return;

  const dutyButton = briefing.list.find((child) =>
    child instanceof Phaser.GameObjects.Container &&
    child.list.some((item) => item instanceof Phaser.GameObjects.Text && item.text.includes("CLOCK IN"))
  );
  if (!(dutyButton instanceof Phaser.GameObjects.Container)) return;

  const label = dutyButton.list.find((item) => item instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
  const background = dutyButton.list.find((item) => item instanceof Phaser.GameObjects.Rectangle) as Phaser.GameObjects.Rectangle | undefined;
  if (!label || !background) return;

  label.setText("ACCEPT DUTY PLAN");
  background.on("pointerdown", () => label.setText("DUTY PLAN ACCEPTED"));
};
