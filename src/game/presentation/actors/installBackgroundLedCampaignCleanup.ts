import Phaser from "phaser";
import { GoldenOrderHuntScene } from "../scenes/GoldenOrderHuntScene";

const DUPLICATE_GOLDEN_FIXTURE_NAMES = Object.freeze([
  "golden-order-breakfast-fixture",
  "golden-order-produce-fixture",
  "golden-order-dairy-fixture",
  "golden-order-aux-fixture-1",
  "golden-order-aux-fixture-2"
]);

/**
 * Static departments are already authored into the order-hunt background.
 * Level 5 used to add another breakfast/produce fixture layer on top, which
 * produced the pasted-on shelf look. Remove those duplicates immediately after
 * scene creation; products, basket and worker remain live gameplay objects.
 */
const originalCreate = GoldenOrderHuntScene.prototype.create;
GoldenOrderHuntScene.prototype.create = function createBackgroundLedOrderHunt(
  this: GoldenOrderHuntScene
): void {
  originalCreate.call(this);

  DUPLICATE_GOLDEN_FIXTURE_NAMES.forEach((name) => {
    const object = this.children.getByName(name);
    if (!object) return;
    object.destroy();
  });

  document.body.dataset.goldenStaticFixtures = "background-baked";
  document.body.dataset.goldenSceneComposition = "products-and-actors-only";
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
