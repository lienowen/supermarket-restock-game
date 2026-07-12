import Phaser from "phaser";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";

type RuntimeProgressionScene = Phaser.Scene & {
  currentDay: "day01" | "day02" | "day03";
};

type ProgressionPrototype = {
  trySpawnWaitingCustomer: () => void;
};

const prototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
const originalTrySpawn = prototype.trySpawnWaitingCustomer;

prototype.trySpawnWaitingCustomer = function spawnOnlyCampaignAppropriateServiceCustomers(): void {
  const scene = this as unknown as RuntimeProgressionScene;

  // Day 2 uses the scripted Promotion Wing flow:
  // checkout 3 → return → checkout 2 → damaged item → final checkout.
  // The legacy waiting-customer loop would create unrelated service prompts.
  if (scene.currentDay === "day02") return;

  originalTrySpawn.call(this);
};
