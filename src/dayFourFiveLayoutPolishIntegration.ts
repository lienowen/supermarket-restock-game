import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type BatchDay = "day04" | "day05";

type RuntimeSlot = {
  index: number;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  productBottomY: number;
};

type BatchFixture = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lowOverlay: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
};

type RuntimeGame = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  __batchFixtures?: BatchFixture[];
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithPolishedBatchLayout(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (!isBatchDay(gameSession.day)) return;

  removeRedundantCartLabels(scene);
  if (gameSession.day === "day05") polishWeekendFloor(scene);
};

function polishWeekendFloor(scene: RuntimeGame): void {
  moveFixture(scene, "promo", { x: 700, y: 825, width: 230, height: 220 });
  moveFixture(scene, "front", { x: 985, y: 825, width: 230, height: 220 });
}

function moveFixture(
  scene: RuntimeGame,
  id: string,
  position: { x: number; y: number; width: number; height: number }
): void {
  const fixtures = scene.__batchFixtures ?? [];
  const index = fixtures.findIndex((fixture) => fixture.id === id);
  if (index < 0) return;

  const fixture = fixtures[index];
  Object.assign(fixture, position);
  fixture.lowOverlay
    .setPosition(position.x, position.y)
    .setDisplaySize(position.width - 8, position.height - 8);
  fixture.outline
    .setPosition(position.x, position.y)
    .setDisplaySize(position.width, position.height);
  fixture.status.setPosition(position.x, position.y + position.height / 2 - 27);

  const label = scene.children.list.find((child): child is Phaser.GameObjects.Text =>
    child instanceof Phaser.GameObjects.Text &&
    child.active &&
    child.text === fixture.label
  );
  label?.setPosition(position.x, position.y - position.height / 2 + 22);

  const slot = scene.shelfSlots[index];
  if (!slot) return;
  slot.hitArea
    .setPosition(position.x, position.y)
    .setDisplaySize(position.width, position.height);
  slot.missingTag.setPosition(position.x, position.y);
  slot.typeLabel.setPosition(-2000, -2000);
  slot.productBottomY = position.y + position.height * 0.2;
}

function removeRedundantCartLabels(scene: Phaser.Scene): void {
  for (const child of [...scene.children.list]) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const label = child.text.trim().toUpperCase();
    if (label === "EMPTY" || label === "NO STOCK") child.destroy();
  }
}

function isBatchDay(value: unknown): value is BatchDay {
  return value === "day04" || value === "day05";
}
