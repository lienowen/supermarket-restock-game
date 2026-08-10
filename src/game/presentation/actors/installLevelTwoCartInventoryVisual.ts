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
const TOTAL_WATER_UNITS = 18;
const CART_COLUMNS = 6;
const CART_BOTTLE_WIDTH = 18;
const CART_BOTTLE_HEIGHT = 48;
const CART_COLUMN_GAP = 27;
const CART_ROW_GAP = 18;

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly cartDestination: { readonly x: number; readonly y: number };
  };
  readonly currentSnapshot?: RestockSceneSnapshot;
}

const isLevelTwo = (): boolean => document.body.dataset.activeLevel === LEVEL_TWO_ID;
const stockName = (index: number): string => `level-two-cart-water-${index}`;

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
  LEGACY_CART_BOTTLE_NAMES.forEach((name) => {
    const legacy = view.scene.children.getByName(name);
    if (legacy instanceof Phaser.GameObjects.Image) legacy.setVisible(false);
  });

  const show = snapshot.step === "restock";
  const carryingBatch = document.body.dataset.levelTwoBatch === "carrying-3";
  const remaining = show
    ? Math.max(0, TOTAL_WATER_UNITS - snapshot.stockedRows * 3 - (carryingBatch ? 3 : 0))
    : 0;
  const textureKey = view.scene.textures.exists(NORMALIZED_WATER_KEY)
    ? NORMALIZED_WATER_KEY
    : "restock-cola-bottle-hd-v2";
  const centreX = view.config.cartDestination.x;
  const baselineY = view.config.cartDestination.y - 82;

  for (let index = 0; index < TOTAL_WATER_UNITS; index += 1) {
    const bottle = getOrCreateBottle(view.scene, index, textureKey);
    if (index >= remaining) {
      bottle.setVisible(false);
      continue;
    }

    const column = index % CART_COLUMNS;
    const row = Math.floor(index / CART_COLUMNS);
    bottle
      .setTexture(textureKey)
      .setOrigin(0.5, 1)
      .setPosition(
        centreX + (column - (CART_COLUMNS - 1) / 2) * CART_COLUMN_GAP,
        baselineY - row * CART_ROW_GAP
      )
      .setDisplaySize(CART_BOTTLE_WIDTH, CART_BOTTLE_HEIGHT)
      .setDepth(25.12 - row * 0.015 + column * 0.001)
      .setVisible(true);
  }

  document.body.dataset.levelTwoCartInventory = String(remaining);
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
