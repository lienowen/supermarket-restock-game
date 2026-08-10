import Phaser from "phaser";
import { createTrimmedTexture } from "../visual/TrimmedTexture";
import { GoldenOrderHuntScene } from "../scenes/GoldenOrderHuntScene";
import { UtilityTaskScene } from "../scenes/UtilityTaskScene";

const DUPLICATE_GOLDEN_FIXTURE_NAMES = Object.freeze([
  "golden-order-breakfast-fixture",
  "golden-order-produce-fixture",
  "golden-order-dairy-fixture",
  "golden-order-aux-fixture-1",
  "golden-order-aux-fixture-2"
]);

const BAKED_DEPARTMENT_PRODUCT_POSITIONS = Object.freeze({
  // Fresh Produce — left foreground display already exists in the authored plate.
  "find-item-apple": Object.freeze({ x: 350, y: 515 }),
  "find-decoy-banana": Object.freeze({ x: 120, y: 430 }),
  "find-decoy-grapes": Object.freeze({ x: 445, y: 475 }),

  // Grocery — central shelves.
  "find-item-cereal-box": Object.freeze({ x: 675, y: 390 }),
  "find-decoy-oats": Object.freeze({ x: 735, y: 435 }),
  "find-decoy-peanut-butter": Object.freeze({ x: 930, y: 375 }),

  // Dairy — right refrigerator wall.
  "find-item-milk-bottle": Object.freeze({ x: 1435, y: 395 }),
  "find-decoy-yogurt": Object.freeze({ x: 1325, y: 350 })
});

const SIMPLE_ORDER_PRODUCT_POSITIONS = Object.freeze({
  "find-item-apple": BAKED_DEPARTMENT_PRODUCT_POSITIONS["find-item-apple"],
  "find-item-cereal-box": BAKED_DEPARTMENT_PRODUCT_POSITIONS["find-item-cereal-box"],
  "find-item-milk-bottle": BAKED_DEPARTMENT_PRODUCT_POSITIONS["find-item-milk-bottle"]
});

const moveNamedProducts = (
  scene: Phaser.Scene,
  positions: Readonly<Record<string, { readonly x: number; readonly y: number }>>
): void => {
  Object.entries(positions).forEach(([name, point]) => {
    const object = scene.children.getByName(name);
    if (!(object instanceof Phaser.GameObjects.Image)) return;
    object
      .setPosition(point.x, point.y)
      .setDepth(12 + point.y / 1000);
  });
};

const trimSimpleOrderProducts = (scene: Phaser.Scene): void => {
  Object.keys(SIMPLE_ORDER_PRODUCT_POSITIONS).forEach((name) => {
    const object = scene.children.getByName(name);
    if (!(object instanceof Phaser.GameObjects.Image)) return;
    const width = object.displayWidth;
    const height = object.displayHeight;
    const sourceKey = object.texture.key;
    const trimmedKey = createTrimmedTexture(scene, sourceKey, {
      alphaThreshold: 10,
      suffix: "--priority-order-trimmed",
      padding: 1
    });
    object
      .setTexture(trimmedKey)
      .setDisplaySize(width, height);
  });
};

/**
 * A simple three-item order has no decoys. Its products still belong on the
 * authored Produce/Grocery/Dairy shelves rather than floating in the aisle.
 * This is derived from the live scene shape instead of branching on a level ID.
 */
const originalUtilityCreate = UtilityTaskScene.prototype.create;
UtilityTaskScene.prototype.create = function createBackgroundLedUtility(
  this: UtilityTaskScene
): void {
  originalUtilityCreate.call(this);
  if (document.body.dataset.activeMode !== "find-items") return;

  const children = this.children.getChildren();
  const requested = children.filter((object) => (
    typeof object.name === "string" && object.name.startsWith("find-item-")
  ));
  const decoys = children.filter((object) => (
    typeof object.name === "string" && object.name.startsWith("find-decoy-")
  ));
  if (requested.length !== 3 || decoys.length !== 0) return;

  trimSimpleOrderProducts(this);
  moveNamedProducts(this, SIMPLE_ORDER_PRODUCT_POSITIONS);
  document.body.dataset.findItemsProductPlacement = "baked-departments-v2";
  document.body.dataset.findItemsProductCut = "trimmed-v2";
};

/**
 * Static departments are already authored into the order-hunt background.
 * The golden search scene used to add another breakfast/produce fixture layer
 * and then place products in the open aisle. Keep only live products/actors and
 * anchor products to the real Fresh Produce, Grocery and Dairy shelves.
 */
const originalGoldenCreate = GoldenOrderHuntScene.prototype.create;
GoldenOrderHuntScene.prototype.create = function createBackgroundLedOrderHunt(
  this: GoldenOrderHuntScene
): void {
  originalGoldenCreate.call(this);

  DUPLICATE_GOLDEN_FIXTURE_NAMES.forEach((name) => {
    this.children.getByName(name)?.destroy();
  });

  moveNamedProducts(this, BAKED_DEPARTMENT_PRODUCT_POSITIONS);

  document.body.dataset.goldenStaticFixtures = "background-baked";
  document.body.dataset.goldenSceneComposition = "baked-departments-live-products";
  document.body.dataset.goldenProductPlacement = "produce-grocery-dairy-v2";
};

// Defensive cleanup for hot reload / cached scene instances.
const originalGoldenUpdate = GoldenOrderHuntScene.prototype.update;
GoldenOrderHuntScene.prototype.update = function updateBackgroundLedOrderHunt(
  this: GoldenOrderHuntScene,
  time: number,
  delta: number
): void {
  originalGoldenUpdate.call(this, time, delta);
  DUPLICATE_GOLDEN_FIXTURE_NAMES.forEach((name) => {
    const object = this.children.getByName(name);
    if (object instanceof Phaser.GameObjects.Image) object.setVisible(false);
  });
};
