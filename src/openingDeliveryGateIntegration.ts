import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";

const DELIVERY_READY_KEY = "supermarket.deliveryReady";
const ACTIVE_DAY_KEY = "supermarket.activeDay";
const PLAYABLE_DAYS: LevelId[] = ["day01", "day02", "day03", "day04", "day05"];

type OpeningPrototype = {
  create: (...args: unknown[]) => void;
  finishOpening: () => void;
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalCreate = prototype.create;
const originalFinish = prototype.finishOpening;

prototype.create = function createWithFreshReceivingGate(...args: unknown[]): void {
  clearDeliveryReady();
  originalCreate.apply(this, args);
};

prototype.finishOpening = function finishOnlyAfterStockIsInside(): void {
  const scene = this as unknown as Phaser.Scene;
  if (!deliveryIsReadyForCurrentDay() && !sceneShowsCompletedReceiving(scene)) return;
  clearDeliveryReady();
  originalFinish.call(this);
};

function deliveryIsReadyForCurrentDay(): boolean {
  try {
    return globalThis.localStorage?.getItem(DELIVERY_READY_KEY) === readActiveDay();
  } catch {
    return false;
  }
}

function sceneShowsCompletedReceiving(scene: Phaser.Scene): boolean {
  return scene.children.list.some((child) =>
    child instanceof Phaser.GameObjects.Text &&
    child.text.includes("STOCK IS IN THE BACKROOM")
  );
}

function clearDeliveryReady(): void {
  try {
    globalThis.localStorage?.removeItem(DELIVERY_READY_KEY);
  } catch {
    // The scene completion state still protects and releases the receiving flow.
  }
}

function readActiveDay(): LevelId {
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
    return isLevelId(stored) ? stored : "day01";
  } catch {
    return "day01";
  }
}

function isLevelId(value: unknown): value is LevelId {
  return typeof value === "string" && PLAYABLE_DAYS.includes(value as LevelId);
}
