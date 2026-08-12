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
const BATCH_COLUMNS = 3;
const BATCH_BOTTLE_WIDTH = 22;
const BATCH_BOTTLE_HEIGHT = 58;
const BATCH_COLUMN_GAP = 35;
const BATCH_ROW_GAP = 24;

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly cartDestination: { readonly x: number; readonly y: number };
  };
  readonly currentSnapshot?: RestockSceneSnapshot;
}

const isLevelTwo = (): boolean => document.body.dataset.activeLevel === LEVEL_TWO_ID;
const batchName = (index: number): string => `level-two-cart-water-batch-${index}`;

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

/**
 * L2 communicates six restock batches, not eighteen loose bottles. Each visible
 * bottle on the cart represents one 3-unit batch. This keeps the cart readable
 * and lets the shelf placement animation carry the unit-level detail.
 */
function renderCartInventory(
  view: RestockActorInternals,
  snapshot: RestockSceneSnapshot
): void {
  LEGACY_CART_BOTTLE_NAMES.forEach((name) => {
    const legacy = view.scene.children.getByName(name);
    if (legacy instanceof Phaser.GameObjects.Image) legacy.setVisible(false);
  });

  const show = snapshot.step === "restock";
  const carryingBatch = document.body.dataset.levelTwoBatch === "carrying-3";
  const remainingBatches = show
    ? Math.max(0, TOTAL_BATCHES - snapshot.stockedRows - (carryingBatch ? 1 : 0))
    : 0;
  const textureKey = view.scene.textures.exists(NORMALIZED_WATER_KEY)
    ? NORMALIZED_WATER_KEY
    : "restock-cola-bottle-hd-v2";
  const centreX = view.config.cartDestination.x;
  const baselineY = view.config.cartDestination.y - 76;

  for (let index = 0; index < TOTAL_BATCHES; index += 1) {
    const bottle = getOrCreateBatch(view.scene, index, textureKey);
    if (index >= remainingBatches) {
      bottle.setVisible(false);
      continue;
    }

    const column = index % BATCH_COLUMNS;
    const row = Math.floor(index / BATCH_COLUMNS);
    bottle
      .setTexture(textureKey)
      .setOrigin(0.5, 1)
      .setPosition(
        centreX + (column - 1) * BATCH_COLUMN_GAP,
        baselineY - row * BATCH_ROW_GAP
      )
      .setDisplaySize(BATCH_BOTTLE_WIDTH, BATCH_BOTTLE_HEIGHT)
      .setDepth(25.12 - row * 0.015 + column * 0.001)
      .setVisible(true);
  }

  document.body.dataset.levelTwoCartInventory = String(remainingBatches);
  document.body.dataset.levelTwoCartInventoryUnit = "three-bottle-batch";
}

function getOrCreateBatch(
  scene: Phaser.Scene,
  index: number,
  textureKey: string
): Phaser.GameObjects.Image {
  const existing = scene.children.getByName(batchName(index));
  if (existing instanceof Phaser.GameObjects.Image) return existing;
  return scene.add.image(0, 0, textureKey)
    .setOrigin(0.5, 1)
    .setVisible(false)
    .setName(batchName(index));
}
