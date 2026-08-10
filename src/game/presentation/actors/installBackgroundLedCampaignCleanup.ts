import Phaser from "phaser";
import { GoldenOrderHuntScene } from "../scenes/GoldenOrderHuntScene";

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

/**
 * Static departments are already authored into the order-hunt background.
 * Level 5 used to add another breakfast/produce fixture layer on top and then
 * placed products in the open aisle. Keep only live products/actors and anchor
 * the products to the real Fresh Produce, Grocery and Dairy shelves in the plate.
 */
const originalCreate = GoldenOrderHuntScene.prototype.create;
GoldenOrderHuntScene.prototype.create = function createBackgroundLedOrderHunt(
  this: GoldenOrderHuntScene
): void {
  originalCreate.call(this);

  DUPLICATE_GOLDEN_FIXTURE_NAMES.forEach((name) => {
    this.children.getByName(name)?.destroy();
  });

  Object.entries(BAKED_DEPARTMENT_PRODUCT_POSITIONS).forEach(([name, point]) => {
    const object = this.children.getByName(name);
    if (!(object instanceof Phaser.GameObjects.Image)) return;
    object
      .setPosition(point.x, point.y)
      .setDepth(12 + point.y / 1000);
  });

  document.body.dataset.goldenStaticFixtures = "background-baked";
  document.body.dataset.goldenSceneComposition = "baked-departments-live-products";
  document.body.dataset.goldenProductPlacement = "produce-grocery-dairy-v2";
};

// Defensive cleanup for hot reload / cached scene instances.
const originalUpdate = GoldenOrderHuntScene.prototype.update;
GoldenOrderHuntScene.prototype.update = function updateBackgroundLedOrderHunt(
  this: GoldenOrderHuntScene,
  time: number,
  delta: number
): void {
  originalUpdate.call(this, time, delta);
  DUPLICATE_GOLDEN_FIXTURE_NAMES.forEach((name) => {
    const object = this.children.getByName(name);
    if (object instanceof Phaser.GameObjects.Image) object.setVisible(false);
  });
};
