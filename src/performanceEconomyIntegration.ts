import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { gameSession } from "./systems/GameSession";

type RuntimeSlot = {
  productId: ProductId;
  product?: unknown;
  reservedForCustomer: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  loadedProducts: ProductId[];
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  shiftEnded: boolean;
  combo: number;
  __lastWrongStockAt?: number;
  updateStars: () => void;
  updateHud: () => void;
};

type GameScenePrototype = {
  tryRestockSlot: (slot: RuntimeSlot) => void;
  recordRestockCombo: () => void;
  openStore: () => void;
};

type RuntimeProgressionScene = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
};

type ProgressionPrototype = {
  missWaitingCustomer: (customer: unknown) => void;
};

const gamePrototype = GameScene.prototype as unknown as GameScenePrototype;
const originalTryRestockSlot = gamePrototype.tryRestockSlot;
const originalRecordRestockCombo = gamePrototype.recordRestockCombo;
const originalOpenStore = gamePrototype.openStore;

gamePrototype.tryRestockSlot = function tryRestockSlotWithQualityTracking(slot: RuntimeSlot): void {
  const scene = this as unknown as RuntimeGameScene;
  const wrongAttempt =
    !scene.shiftEnded &&
    !scene.movingCart &&
    scene.cartAtShelf &&
    !scene.restockBusy &&
    !slot.product &&
    !slot.reservedForCustomer &&
    scene.loadedProducts.length > 0 &&
    !scene.loadedProducts.includes(slot.productId);

  if (wrongAttempt) {
    const now = scene.time.now;
    const last = scene.__lastWrongStockAt ?? -Infinity;
    if (now - last >= 350) {
      scene.__lastWrongStockAt = now;
      gameSession.recordWrongStock();
    }
  }

  originalTryRestockSlot.call(this, slot);

  if (wrongAttempt) {
    scene.updateStars();
    scene.updateHud();
  }
};

gamePrototype.recordRestockCombo = function recordComboForRating(): void {
  originalRecordRestockCombo.call(this);
  const scene = this as unknown as RuntimeGameScene;
  gameSession.recordCombo(scene.combo);
  scene.updateStars();
};

gamePrototype.openStore = function openStoreWithRating(): void {
  originalOpenStore.call(this);
  const scene = this as unknown as RuntimeGameScene;
  scene.updateStars();
  scene.updateHud();
};

const progressionPrototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
const originalMissWaitingCustomer = progressionPrototype.missWaitingCustomer;

progressionPrototype.missWaitingCustomer = function missWaitingCustomerWithRating(customer: unknown): void {
  const scene = this as unknown as RuntimeProgressionScene;
  gameSession.recordMissedSale();
  originalMissWaitingCustomer.call(this, customer);
  scene.gameScene?.updateStars();
  scene.gameScene?.updateHud();
};
