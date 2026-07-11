import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { customerDemand } from "./systems/CustomerDemand";

type RuntimeSlot = {
  productId: ProductId;
};

type RuntimeWaitingCustomer = {
  slot: RuntimeSlot;
  maxPatienceMs: number;
  resolving: boolean;
  machine: {
    patienceRemainingMs: number;
  };
};

type RuntimeProgressionScene = Phaser.Scene & {
  waitingCustomers: Set<RuntimeWaitingCustomer>;
};

type ProgressionPrototype = {
  spawnWaitingCustomer: (slot: RuntimeSlot) => void;
  updateWaitingCustomers: (delta: number) => void;
  destroyWaitingCustomer: (customer: RuntimeWaitingCustomer) => void;
  detach: () => void;
};

const prototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
const originalSpawn = prototype.spawnWaitingCustomer;
const originalUpdate = prototype.updateWaitingCustomers;
const originalDestroy = prototype.destroyWaitingCustomer;
const originalDetach = prototype.detach;

prototype.spawnWaitingCustomer = function spawnWithDemand(slot: RuntimeSlot): void {
  originalSpawn.call(this, slot);
  syncDemand(this as unknown as RuntimeProgressionScene);
};

prototype.updateWaitingCustomers = function updateDemand(delta: number): void {
  originalUpdate.call(this, delta);
  syncDemand(this as unknown as RuntimeProgressionScene);
};

prototype.destroyWaitingCustomer = function destroyDemand(customer: RuntimeWaitingCustomer): void {
  originalDestroy.call(this, customer);
  syncDemand(this as unknown as RuntimeProgressionScene);
};

prototype.detach = function detachDemand(): void {
  customerDemand.clear();
  originalDetach.call(this);
};

function syncDemand(scene: RuntimeProgressionScene): void {
  const active = [...scene.waitingCustomers]
    .filter((customer) => !customer.resolving)
    .map((customer) => ({
      customer,
      ratio: Phaser.Math.Clamp(
        customer.machine.patienceRemainingMs / Math.max(1, customer.maxPatienceMs),
        0,
        1
      )
    }))
    .sort((left, right) => left.ratio - right.ratio);

  const urgent = active[0];
  if (!urgent) {
    customerDemand.clear();
    return;
  }

  customerDemand.set(urgent.customer.slot.productId, urgent.ratio);
}
