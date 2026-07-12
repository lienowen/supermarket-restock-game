import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";

type RuntimeSlot = {
  productId: ProductId;
};

type RuntimeWaitingCustomer = {
  id: number;
  slot: RuntimeSlot;
  container: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  maxPatienceMs: number;
  machine: {
    extendPatience: (extraMs: number) => void;
  };
};

type RuntimeProgressionScene = Phaser.Scene & {
  currentDay: "day01" | "day02" | "day03";
  waitingCustomers: Set<RuntimeWaitingCustomer>;
  __serviceEventsSpawned?: number;
  __lastServiceEventAt?: number;
};

type ProgressionPrototype = {
  create: () => void;
  spawnWaitingCustomer: (slot: RuntimeSlot) => void;
};

const MAX_DAY3_EVENTS = 3;
const DAY3_EVENT_COOLDOWN_MS = 9_000;
const FINAL_REQUEST_PATIENCE_BONUS_MS = 3_000;

const prototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
const originalCreate = prototype.create;
const originalSpawnWaitingCustomer = prototype.spawnWaitingCustomer;

prototype.create = function createWithServicePacing(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeProgressionScene;
  scene.__serviceEventsSpawned = 0;
  scene.__lastServiceEventAt = -Infinity;
};

prototype.spawnWaitingCustomer = function spawnPacedServiceEvent(slot: RuntimeSlot): void {
  const scene = this as unknown as RuntimeProgressionScene;
  if (scene.currentDay !== "day03") {
    originalSpawnWaitingCustomer.call(this, slot);
    return;
  }

  const spawned = scene.__serviceEventsSpawned ?? 0;
  const lastAt = scene.__lastServiceEventAt ?? -Infinity;
  if (
    spawned >= MAX_DAY3_EVENTS ||
    scene.waitingCustomers.size >= 1 ||
    scene.time.now - lastAt < DAY3_EVENT_COOLDOWN_MS
  ) return;

  const previousIds = new Set([...scene.waitingCustomers].map((customer) => customer.id));
  originalSpawnWaitingCustomer.call(this, slot);
  const customer = [...scene.waitingCustomers].find((candidate) => !previousIds.has(candidate.id));
  if (!customer) return;

  scene.__serviceEventsSpawned = spawned + 1;
  scene.__lastServiceEventAt = scene.time.now;

  if (scene.__serviceEventsSpawned === MAX_DAY3_EVENTS) {
    customer.machine.extendPatience(FINAL_REQUEST_PATIENCE_BONUS_MS);
    customer.maxPatienceMs += FINAL_REQUEST_PATIENCE_BONUS_MS;
    customer.bubbleText.setText(`FINAL REQUEST · ${PRODUCTS[customer.slot.productId].label}`);
    const badge = scene.add.text(0, -395, "SUPERVISOR SERVICE", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#fff0a8",
      fontStyle: "bold",
      backgroundColor: "#7b3f16",
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5);
    customer.container.add(badge);
  }
};
