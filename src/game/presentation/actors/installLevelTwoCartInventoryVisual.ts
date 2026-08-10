import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { RestockActorView } from "./RestockActorView";

const LEVEL_TWO_ID = "starter-level-002";
const NORMALIZED_WATER_KEY = "level-two-water-bottle-normalized";
const LEGACY_CART_BOTTLE_NAMES = Object.freeze([
  "restock-level-two-water-a",
  "restock-level-two-water-b",
  "restock-level-two-water-c"
]);
const TOTAL_BATCHES = 6;
const UNITS_PER_BATCH = 3;
const CART_BOTTLE_WIDTH = 22;
const CART_BOTTLE_HEIGHT = 56;
const CART_COLUMN_GAP = 31;

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly cartDestination: { readonly x: number; readonly y: number };
  };
  readonly currentSnapshot?: RestockSceneSnapshot;
}

const isLevelTwo = (): boolean => document.body.dataset.activeLevel === LEVEL_TWO_ID;
const stockName = (index: number): string => `level-two-cart-batch-${index}`;

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncLevelTwoCartInventory(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isLevelTwo()) return;
  renderCartInventory(this as unknown as RestockActorInternals, snapshot);
};

const originalUpdate = RestockActorView.prototype.update;
RestockActorView.prototype.update = function updateLevelTwoCartInventory(
  this: RestockActorView,
  deltaMs: number
): void {
  originalUpdate.call(this, deltaMs);
  if (!isLevelTwo()) return;
  const view = this as unknown as RestockActorInternals;
  if (view.currentSnapshot) renderCartInventory(view, view.currentSnapshot);
};

function renderCartInventory(
  view: RestockActorInternals,
  snapshot: RestockSceneSnapshot
): void {
  // Remove the older three-bottle decorative strip. The cart now communicates
  // inventory as six compact 3-bottle batches, matching the six shelf tasks.
  LEGACY_CART_BOTTLE_NAMES.forEach((name) => {
    const legacy = view.scene.children.getByName(name);
    if (legacy instanceof Phaser.GameObjects.Image) legacy.setVisible(false);
  });
  for (let index = TOTAL_BATCHES; index < 18; index += 1) {
    const legacy = view.scene.children.getByName(`level-two-cart-water-${index}`);
    if (legacy instanceof Phaser.GameObjects.Image) legacy.setVisible(false);
  }

  const show = snapshot.step === "restock";
  const carryingBatch = document.body.dataset.levelTwoBatch === "carrying-3";
  const remainingUnits = show
    ? Math.max(0, TOTAL_BATCHES * UNITS_PER_BATCH - snapshot.stockedRows * UNITS_PER_BATCH - (carryingBatch ? UNITS_PER_BATCH : 0))
    : 0;
  const remainingBatches = Math.ceil(remainingUnits / UNITS_PER_BATCH);
  const textureKey = view.scene.textures.exists(NORMALIZED_WATER_KEY)
    ? NORMALIZED_WATER_KEY
    : "restock-cola-bottle-hd-v2";
  const centreX = view.config.cartDestination.x;
  const baselineY = view.config.cartDestination.y - 79;

  for (let index = 0; index < TOTAL_BATCHES; index += 1) {
    const bottle = getOrCreateBottle(view.scene, index, textureKey);
    if (index >= remainingBatches) {
      bottle.setVisible(false);
      continue;
    }

    bottle
      .setTexture(textureKey)
      .setOrigin(0.5, 1)
      .setPosition(
        centreX + (index - (TOTAL_BATCHES - 1) / 2) * CART_COLUMN_GAP,
        baselineY + Math.abs(index - (TOTAL_BATCHES - 1) / 2) * 1.5
      )
      .setDisplaySize(CART_BOTTLE_WIDTH, CART_BOTTLE_HEIGHT)
      .setDepth(25.12 + index * 0.002)
      .setVisible(true);
  }

  document.body.dataset.levelTwoCartInventory = String(remainingUnits);
  document.body.dataset.levelTwoCartInventoryVisual = "six-three-bottle-batches";
}

function getOrCreateBottle(
  scene: Phaser.Scene,
  index: number,
  textureKey: string
): Phaser.GameObjects.Image {
  const existing = scene.children.getByName(stockName(index));
  if (existing instanceof Phaser.GameObjects.Image) return existing;
  return scene.add.image(0, 0, textureKey)
    .setOrigin(0.5, 1)
    .setVisible(false)
    .setName(stockName(index));
}
